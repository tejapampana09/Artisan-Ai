package com.artisanai.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED || intent?.action == "android.intent.action.QUICKBOOT_POWERON") {
            val prefs = context.getSharedPreferences(
                ArtisanNotificationService.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            val token = prefs.getString(ArtisanNotificationService.KEY_TOKEN, null)
            if (!token.isNullOrEmpty() && token != "guest_buyer_token") {
                val serviceIntent = Intent(context, ArtisanNotificationService::class.java).apply {
                    action = ArtisanNotificationService.ACTION_START
                }
                ContextCompat.startForegroundService(context, serviceIntent)
            }
        }
    }
}
