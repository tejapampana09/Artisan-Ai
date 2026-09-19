package com.artisanai.mobile

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class ArtisanNotificationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ArtisanNotificationModule"

    @ReactMethod
    fun startForegroundService(token: String, domain: String, baseUrl: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, ArtisanNotificationService::class.java).apply {
                action = ArtisanNotificationService.ACTION_START
                putExtra("token", token)
                putExtra("domain", domain)
                putExtra("baseUrl", baseUrl)
            }
            ContextCompat.startForegroundService(context, intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopForegroundService(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, ArtisanNotificationService::class.java).apply {
                action = ArtisanNotificationService.ACTION_STOP
            }
            context.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun updateSession(token: String, domain: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                ArtisanNotificationService.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            prefs.edit()
                .putString(ArtisanNotificationService.KEY_TOKEN, token)
                .putString(ArtisanNotificationService.KEY_DOMAIN, domain)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_SESSION_ERROR", e.message, e)
        }
    }
}
