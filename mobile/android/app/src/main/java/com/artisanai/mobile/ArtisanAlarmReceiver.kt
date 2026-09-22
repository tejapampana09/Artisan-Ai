package com.artisanai.mobile

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class ArtisanAlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ArtisanAlarmReceiver"
        const val PREFS_NAME = "artisan_bg_prefs"
        const val KEY_TOKEN = "bg_token"
        const val KEY_DOMAIN = "bg_domain"
        const val KEY_BASE_URL = "bg_base_url"
        const val KEY_KNOWN_IDS = "bg_known_notif_ids"
        const val KEY_FIRST_RUN = "bg_first_run"

        const val ORDERS_CHANNEL_ID = "orders_channel"
        const val ACTION_CHECK = "com.artisanai.mobile.CHECK_NOTIFICATIONS"
        private const val ALARM_REQUEST_CODE = 8801
        private const val CHECK_INTERVAL_MS = 45_000L // 45 seconds

        fun scheduleNextCheck(context: Context, delayMs: Long = CHECK_INTERVAL_MS) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, ArtisanAlarmReceiver::class.java).apply {
                action = ACTION_CHECK
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                ALARM_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val triggerAt = SystemClock.elapsedRealtime() + delayMs
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
                } else {
                    alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
                }
                Log.d(TAG, "Scheduled next background notification check in ${delayMs / 1000}s")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to schedule background alarm: " + e.message)
            }
        }

        fun cancelSchedule(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, ArtisanAlarmReceiver::class.java).apply {
                action = ACTION_CHECK
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                ALARM_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent)
            Log.d(TAG, "Cancelled background notification alarm schedule")
        }

        fun ensureNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
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
                manager?.createNotificationChannel(ordersChannel)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                checkAndNotify(context)
            } catch (e: Exception) {
                Log.w(TAG, "Error checking background notifications: " + e.message)
            } finally {
                // Re-arm next check if token is still valid
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val token = prefs.getString(KEY_TOKEN, null)
                if (!token.isNullOrEmpty() && token != "guest_buyer_token") {
                    scheduleNextCheck(context)
                }
                pendingResult.finish()
            }
        }
    }

    private fun checkAndNotify(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_TOKEN, null)
        val baseUrl = prefs.getString(KEY_BASE_URL, "https://dd8bq7j24onss.cloudfront.net")
            ?.trim()?.removeSuffix("/") ?: "https://dd8bq7j24onss.cloudfront.net"

        if (token.isNullOrEmpty() || token == "guest_buyer_token") {
            return
        }

        ensureNotificationChannel(context)

        val endpoint = "$baseUrl/api/notifications"
        val url = URL(endpoint)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 7000
            readTimeout = 7000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/json")
        }

        try {
            val responseCode = conn.responseCode
            if (responseCode == 200) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val responseText = reader.readText()
                reader.close()

                val jsonArray = JSONArray(responseText)
                processNotifications(context, jsonArray, prefs)
            } else {
                Log.d(TAG, "Backend returned HTTP $responseCode")
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun processNotifications(context: Context, jsonArray: JSONArray, prefs: SharedPreferences) {
        val knownIds = prefs.getStringSet(KEY_KNOWN_IDS, HashSet<String>())?.toMutableSet() ?: mutableSetOf()
        val isFirstRun = prefs.getBoolean(KEY_FIRST_RUN, true)

        if (isFirstRun && knownIds.isEmpty()) {
            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.optJSONObject(i) ?: continue
                val id = item.optInt("id", -1)
                if (id != -1) knownIds.add(id.toString())
            }
            prefs.edit()
                .putStringSet(KEY_KNOWN_IDS, knownIds)
                .putBoolean(KEY_FIRST_RUN, false)
                .apply()
            return
        }
        prefs.edit().putBoolean(KEY_FIRST_RUN, false).apply()

        for (i in 0 until jsonArray.length()) {
            val item = jsonArray.optJSONObject(i) ?: continue
            val id = item.optInt("id", -1)
            val isRead = item.optBoolean("is_read", false)
            val title = item.optString("title", "Artisan AI Alert")
            val message = item.optString("message", "")
            val type = item.optString("type", "GENERAL")

            val idStr = id.toString()
            if (id != -1 && !isRead && !knownIds.contains(idStr)) {
                showHeadsUpNotification(context, id, title, message, type)
                knownIds.add(idStr)
            }
        }

        prefs.edit().putStringSet(KEY_KNOWN_IDS, knownIds).apply()
    }

    private fun showHeadsUpNotification(context: Context, id: Int, title: String, message: String, type: String) {
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("notification_id", id)
            putExtra("notification_type", type)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            id,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, ORDERS_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        try {
            val manager = NotificationManagerCompat.from(context)
            manager.notify(id, builder.build())
            Log.i(TAG, "Delivered instant heads-up alert for notification #$id: $title")
        } catch (e: SecurityException) {
            Log.w(TAG, "Notification permission not granted: " + e.message)
        }
    }
}
