package com.artisanai.mobile

import android.app.NotificationManager
import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ArtisanNotificationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ArtisanNotificationModule"

    @ReactMethod
    fun startBackgroundSync(token: String, domain: String, baseUrl: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(ArtisanAlarmReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(ArtisanAlarmReceiver.KEY_TOKEN, token)
                .putString(ArtisanAlarmReceiver.KEY_DOMAIN, domain)
                .putString(ArtisanAlarmReceiver.KEY_BASE_URL, baseUrl)
                .apply()

            // Dismiss any old legacy sticky notification from previous foreground services
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.cancel(9001)

            ArtisanAlarmReceiver.ensureNotificationChannel(context)
            ArtisanAlarmReceiver.scheduleNextCheck(context, delayMs = 2000L) // First check in 2 seconds
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_SYNC_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopBackgroundSync(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(ArtisanAlarmReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .remove(ArtisanAlarmReceiver.KEY_TOKEN)
                .apply()

            ArtisanAlarmReceiver.cancelSchedule(context)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_SYNC_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun recordShownId(id: Double, promise: Promise) {
        try {
            val intId = id.toLong().toString()
            val prefs = reactApplicationContext.getSharedPreferences(ArtisanAlarmReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            val knownIds = prefs.getStringSet(ArtisanAlarmReceiver.KEY_KNOWN_IDS, HashSet<String>())?.toMutableSet() ?: mutableSetOf()
            knownIds.add(intId)
            prefs.edit().putStringSet(ArtisanAlarmReceiver.KEY_KNOWN_IDS, knownIds).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RECORD_ID_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getShownIds(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(ArtisanAlarmReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            val knownIds = prefs.getStringSet(ArtisanAlarmReceiver.KEY_KNOWN_IDS, emptySet()) ?: emptySet()
            val arr = Arguments.createArray()
            for (idStr in knownIds) {
                idStr.toDoubleOrNull()?.let { arr.pushDouble(it) }
            }
            promise.resolve(arr)
        } catch (e: Exception) {
            promise.reject("GET_IDS_ERROR", e.message, e)
        }
    }

    // Keep legacy method names for backward compatibility if called anywhere
    @ReactMethod
    fun startForegroundService(token: String, domain: String, baseUrl: String, promise: Promise) {
        startBackgroundSync(token, domain, baseUrl, promise)
    }

    @ReactMethod
    fun stopForegroundService(promise: Promise) {
        stopBackgroundSync(promise)
    }

    @ReactMethod
    fun updateSession(token: String, domain: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(ArtisanAlarmReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(ArtisanAlarmReceiver.KEY_TOKEN, token)
                .putString(ArtisanAlarmReceiver.KEY_DOMAIN, domain)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_SESSION_ERROR", e.message, e)
        }
    }
}
