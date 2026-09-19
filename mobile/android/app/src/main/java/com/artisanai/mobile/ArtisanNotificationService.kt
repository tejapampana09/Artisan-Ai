package com.artisanai.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class ArtisanNotificationService : Service() {

    companion object {
        private const val TAG = "ArtisanBgService"
        const val PREFS_NAME = "artisan_bg_prefs"
        const val KEY_TOKEN = "bg_token"
        const val KEY_DOMAIN = "bg_domain"
        const val KEY_BASE_URL = "bg_base_url"
        const val KEY_KNOWN_IDS = "bg_known_notif_ids"

        const val FOREGROUND_NOTIFICATION_ID = 9001
        const val SYNC_CHANNEL_ID = "artisan_sync_channel"
        const val ORDERS_CHANNEL_ID = "orders_channel"

        const val ACTION_START = "com.artisanai.mobile.START_SERVICE"
        const val ACTION_STOP = "com.artisanai.mobile.STOP_SERVICE"
    }

    private var serviceJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO)
    private var isFirstRun = true

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForegroundService()
            return START_NOT_STICKY
        }

        // Save incoming intent parameters if provided
        intent?.let {
            val token = it.getStringExtra("token")
            val domain = it.getStringExtra("domain")
            val baseUrl = it.getStringExtra("baseUrl")

            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val editor = prefs.edit()
            if (!token.isNullOrEmpty()) editor.putString(KEY_TOKEN, token)
            if (!domain.isNullOrEmpty()) editor.putString(KEY_DOMAIN, domain)
            if (!baseUrl.isNullOrEmpty()) editor.putString(KEY_BASE_URL, baseUrl)
            editor.apply()
        }

        startAsForeground()
        startPollingLoop()

        return START_STICKY
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // 1. Silent persistent channel for the foreground service
            val syncChannel = NotificationChannel(
                SYNC_CHANNEL_ID,
                "Artisan AI Background Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps Artisan AI connected to AWS for live order alerts"
                setShowBadge(false)
            }
            manager.createNotificationChannel(syncChannel)

            // 2. High-priority Heads-Up channel for order alerts
            val ordersChannel = NotificationChannel(
                ORDERS_CHANNEL_ID,
                "Orders & Enquiries",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Instant notifications for orders and customer messages"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 250, 250)
                enableLights(true)
                lightColor = 0xFF9F3C16.toInt()
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(ordersChannel)
        }
    }

    private fun startAsForeground() {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, SYNC_CHANNEL_ID)
            .setContentTitle("Artisan AI Live")
            .setContentText("Listening for incoming orders & customer updates")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                FOREGROUND_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(FOREGROUND_NOTIFICATION_ID, notification)
        }
    }

    private fun startPollingLoop() {
        if (serviceJob?.isActive == true) return

        serviceJob = scope.launch {
            Log.d(TAG, "Started persistent AWS notification polling loop")
            while (isActive) {
                try {
                    pollAwsNotifications()
                } catch (e: Exception) {
                    Log.w(TAG, "Polling tick error: " + e.message)
                }
                // Check AWS backend every 12 seconds
                delay(12000)
            }
        }
    }

    private fun pollAwsNotifications() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_TOKEN, null)
        val baseUrl = prefs.getString(KEY_BASE_URL, "https://dd8bq7j24onss.cloudfront.net")
            ?.trim()?.removeSuffix("/") ?: "https://dd8bq7j24onss.cloudfront.net"

        if (token.isNullOrEmpty() || token == "guest_buyer_token") {
            return
        }

        val endpoint = baseUrl + "/api/notifications"
        val url = URL(endpoint)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 8000
            setRequestProperty("Authorization", "Bearer " + token)
            setRequestProperty("Accept", "application/json")
        }

        try {
            val responseCode = conn.responseCode
            if (responseCode == 200) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val responseText = reader.readText()
                reader.close()

                val jsonArray = JSONArray(responseText)
                processNotifications(jsonArray, prefs)
            } else {
                Log.d(TAG, "Backend returned HTTP " + responseCode)
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun processNotifications(jsonArray: JSONArray, prefs: SharedPreferences) {
        val knownIds = prefs.getStringSet(KEY_KNOWN_IDS, HashSet<String>())?.toMutableSet() ?: mutableSetOf()

        // If this is the initial cold launch of the service, seed existing notifications without spamming
        if (isFirstRun && knownIds.isEmpty()) {
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.optJSONObject(i) ?: continue
                val id = item.optInt("id", -1)
                if (id != -1) knownIds.add(id.toString())
            }
            prefs.edit().putStringSet(KEY_KNOWN_IDS, knownIds).apply()
            isFirstRun = false
            return
        }
        isFirstRun = false

        for (i in 0 until jsonArray.length()) {
            val item = jsonArray.optJSONObject(i) ?: continue
            val id = item.optInt("id", -1)
            val isRead = item.optBoolean("is_read", false)
            val title = item.optString("title", "Artisan AI Alert")
            val message = item.optString("message", "")
            val type = item.optString("type", "GENERAL")

            val idStr = id.toString()
            if (id != -1 && !isRead && !knownIds.contains(idStr)) {
                // Trigger instant native heads-up notification with sound & vibration
                showHeadsUpNotification(id, title, message, type)
                knownIds.add(idStr)
            }
        }

        prefs.edit().putStringSet(KEY_KNOWN_IDS, knownIds).apply()
    }

    private fun showHeadsUpNotification(id: Int, title: String, message: String, type: String) {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("notification_id", id)
            putExtra("notification_type", type)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            id,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, ORDERS_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        try {
            val manager = NotificationManagerCompat.from(this)
            manager.notify(id, builder.build())
            Log.i(TAG, "Delivered instant heads-up alert for notification #" + id + ": " + title)
        } catch (e: SecurityException) {
            Log.w(TAG, "Notification permission not granted: " + e.message)
        }
    }

    private fun stopForegroundService() {
        serviceJob?.cancel()
        serviceJob = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        serviceJob?.cancel()
        serviceJob = null
        super.onDestroy()
    }
}
