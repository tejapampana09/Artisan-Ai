import { NativeModules, Platform } from "react-native";
import { BASE_URL } from "./api";
import type { AuthDomain } from "./storage";

const { ArtisanNotificationModule } = NativeModules;

export async function startNativeForegroundService(domainOverride?: AuthDomain): Promise<boolean> {
  if (Platform.OS !== "android" || !ArtisanNotificationModule) {
    return false;
  }

  try {
    const { getSession } = require("./storage");
    const session = await getSession(domainOverride);
    const token = session?.token;
    if (!token || token === "guest_buyer_token") {
      return false;
    }

    const domain = session.domain || "MARKETPLACE";
    await ArtisanNotificationModule.startForegroundService(token, domain, BASE_URL);
    console.log(`[ForegroundService] Started persistent AWS notification service for ${domain}`);
    return true;
  } catch (err) {
    console.warn("[ForegroundService] Failed to start native foreground service:", err);
    return false;
  }
}

export async function stopNativeForegroundService(): Promise<void> {
  if (Platform.OS !== "android" || !ArtisanNotificationModule) {
    return;
  }

  try {
    await ArtisanNotificationModule.stopForegroundService();
    console.log("[ForegroundService] Stopped native foreground service");
  } catch (err) {
    console.warn("[ForegroundService] Failed to stop native foreground service:", err);
  }
}

export async function updateNativeForegroundSession(token: string, domain: AuthDomain): Promise<void> {
  if (Platform.OS !== "android" || !ArtisanNotificationModule) {
    return;
  }

  try {
    await ArtisanNotificationModule.updateSession(token, domain);
  } catch (err) {
    console.warn("[ForegroundService] Failed to update session in native foreground service:", err);
  }
}
