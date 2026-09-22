package com.artisanai.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED || intent?.action == "android.intent.action.QUICKBOOT_POWERON") {
            val prefs = context.getSharedPreferences(
                ArtisanAlarmReceiver.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            val token = prefs.getString(ArtisanAlarmReceiver.KEY_TOKEN, null)
            if (!token.isNullOrEmpty() && token != "guest_buyer_token") {
                ArtisanAlarmReceiver.ensureNotificationChannel(context)
                ArtisanAlarmReceiver.scheduleNextCheck(context, delayMs = 10_000L)
            }
        }
    }
}
