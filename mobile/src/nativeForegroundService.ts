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
    await ArtisanNotificationModule.startBackgroundSync(token, domain, BASE_URL);
    console.log(`[BackgroundSync] Started silent background notification sync for ${domain}`);
    return true;
  } catch (err) {
    console.warn("[BackgroundSync] Failed to start native background sync:", err);
    return false;
  }
}

export async function stopNativeForegroundService(): Promise<void> {
  if (Platform.OS !== "android" || !ArtisanNotificationModule) {
    return;
  }

  try {
    await ArtisanNotificationModule.stopBackgroundSync();
    console.log("[BackgroundSync] Stopped native background sync");
  } catch (err) {
    console.warn("[BackgroundSync] Failed to stop native background sync:", err);
  }
}

export async function updateNativeForegroundSession(token: string, domain: AuthDomain): Promise<void> {
  if (Platform.OS !== "android" || !ArtisanNotificationModule) {
    return;
  }

  try {
    await ArtisanNotificationModule.updateSession(token, domain);
  } catch (err) {
    console.warn("[BackgroundSync] Failed to update session in native background sync:", err);
  }
}

export async function recordNativeShownId(id: number): Promise<void> {
  if (Platform.OS !== "android" || !ArtisanNotificationModule?.recordShownId) {
    return;
  }

  try {
    await ArtisanNotificationModule.recordShownId(id);
  } catch (err) {
    console.warn("[BackgroundSync] Failed to record shown ID in native:", err);
  }
}

export async function getNativeShownIds(): Promise<number[]> {
  if (Platform.OS !== "android" || !ArtisanNotificationModule?.getShownIds) {
    return [];
  }

  try {
    const ids = await ArtisanNotificationModule.getShownIds();
    return Array.isArray(ids) ? ids.map((n: any) => Number(n)) : [];
  } catch (err) {
    console.warn("[BackgroundSync] Failed to get shown IDs from native:", err);
    return [];
  }
}
