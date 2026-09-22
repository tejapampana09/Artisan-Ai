import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, BASE_URL } from "../api";

export const CURRENT_APP_VERSION = "1.0.0";
export const CURRENT_APP_VERSION_CODE = 1;

const DISMISSED_UPDATE_KEY = "artisan_ai_dismissed_update_code";
export const DEFAULT_APK_RELEASE_URL =
  "https://github.com/tejapampana09/Artisan-Ai/releases/download/latest/ArtisanAI-Release.apk";

export interface AppUpdateInfo {
  version: string;
  version_code: number;
  release_url: string;
  release_notes?: string;
  release_notes_te?: string;
  release_notes_hi?: string;
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  updateInfo: AppUpdateInfo | null;
}

/**
 * Checks if a newer version of the mobile app is available.
 * 1. Queries backend /api/app/version (fast, no rate-limits via CloudFront).
 * 2. Fallbacks to GitHub Releases API if backend is unavailable.
 */
export async function checkForAppUpdate(silent: boolean = false): Promise<CheckUpdateResult> {
  try {
    // 1. Try Backend API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${BASE_URL}/api/app/version`, {
      signal: controller.signal
    }).catch(() => null);
    clearTimeout(timeout);

    if (response && response.ok) {
      const data: AppUpdateInfo = await response.json();
      if (data.version_code > CURRENT_APP_VERSION_CODE) {
        if (silent) {
          const dismissedCode = await AsyncStorage.getItem(DISMISSED_UPDATE_KEY);
          if (dismissedCode && Number(dismissedCode) >= data.version_code) {
            return { hasUpdate: false, updateInfo: null };
          }
        }
        return { hasUpdate: true, updateInfo: data };
      }
      return { hasUpdate: false, updateInfo: null };
    }

    // 2. Fallback to GitHub Releases API
    const ghRes = await fetch(
      "https://api.github.com/repos/tejapampana09/Artisan-Ai/releases/latest",
      { headers: { Accept: "application/vnd.github.v3+json" } }
    ).catch(() => null);

    if (ghRes && ghRes.ok) {
      const release = await ghRes.json();
      const tagName = release.tag_name || "";
      // If tag is not current version e.g. "v1.0.1" or has release assets
      const apkAsset = release.assets?.find((a: any) =>
        a.name?.endsWith(".apk")
      );
      const downloadUrl = apkAsset?.browser_download_url || DEFAULT_APK_RELEASE_URL;

      const ghUpdateInfo: AppUpdateInfo = {
        version: tagName.replace(/^v/, "") || "1.0.1",
        version_code: CURRENT_APP_VERSION_CODE + 1,
        release_url: downloadUrl,
        release_notes: release.body || "New features, bug fixes, and AI assistant improvements.",
        release_notes_te: "కొత్త ఫీచర్లు మరియు AI అసిస్టెంట్ అప్‌డేట్‌లు అందుబాటులో ఉన్నాయి.",
        release_notes_hi: "नई सुविधाएं और AI असिस्टेंट सुधार उपलब्ध हैं।"
      };

      return { hasUpdate: true, updateInfo: ghUpdateInfo };
    }
  } catch (err) {
    // Non-blocking: update check errors should never disrupt the app
    if (!silent) {
      console.warn("App update check warning:", err);
    }
  }

  return { hasUpdate: false, updateInfo: null };
}

/**
 * Dismisses an update for the current version so user isn't spammed on every launch.
 */
export async function dismissUpdateForNow(versionCode: number): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_UPDATE_KEY, String(versionCode));
  } catch {}
}

/**
 * Opens the APK download link directly in the browser/installer.
 */
export async function openAppUpdate(releaseUrl?: string): Promise<boolean> {
  const url = releaseUrl || DEFAULT_APK_RELEASE_URL;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
  } catch (e) {
    console.error("Failed to open update URL:", e);
  }
  return false;
}
