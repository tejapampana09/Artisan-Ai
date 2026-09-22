import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, BASE_URL } from "../api";

export const CURRENT_APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || "1.0.0";
export const CURRENT_APP_VERSION_CODE = process.env.EXPO_PUBLIC_APP_VERSION_CODE
  ? Number(process.env.EXPO_PUBLIC_APP_VERSION_CODE)
  : 1;
export const CURRENT_BUILD_TIMESTAMP = new Date("2026-09-22T18:55:00Z").getTime();
export const CURRENT_RELEASE_ID = 394025111;

const DISMISSED_UPDATE_KEY = "artisan_ai_dismissed_update_code";
const DISMISSED_RELEASE_ID_KEY = "artisan_ai_dismissed_release_id";
export const DEFAULT_APK_RELEASE_URL =
  "https://github.com/tejapampana09/Artisan-Ai/releases/download/latest/ArtisanAI-Release.apk";
export const VERSION_METADATA_URL =
  "https://github.com/tejapampana09/Artisan-Ai/releases/download/latest/version.json";

export interface AppUpdateInfo {
  version: string;
  version_code: number;
  release_id?: number;
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
 * 2. Fallbacks to GitHub Releases version.json static CDN asset.
 * 3. Fallbacks to GitHub Releases API.
 */
export async function checkForAppUpdate(silent: boolean = false): Promise<CheckUpdateResult> {
  try {
    const dismissedCode = await AsyncStorage.getItem(DISMISSED_UPDATE_KEY);
    const dismissedReleaseId = await AsyncStorage.getItem(DISMISSED_RELEASE_ID_KEY);

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
        if (silent && dismissedCode && Number(dismissedCode) >= data.version_code) {
          return { hasUpdate: false, updateInfo: null };
        }
        return { hasUpdate: true, updateInfo: data };
      }
      return { hasUpdate: false, updateInfo: null };
    }

    // 2. Direct GitHub Release version.json check (CDN asset, no API rate-limits)
    const vRes = await fetch(VERSION_METADATA_URL).catch(() => null);
    if (vRes && vRes.ok) {
      const data: AppUpdateInfo = await vRes.json();
      if (data.version_code > CURRENT_APP_VERSION_CODE) {
        if (silent && dismissedCode && Number(dismissedCode) >= data.version_code) {
          return { hasUpdate: false, updateInfo: null };
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
      const tagName = (release.tag_name || "").trim();
      const releaseId = release.id ? Number(release.id) : 0;
      const publishedTime = release.published_at ? new Date(release.published_at).getTime() : 0;
      const apkAsset = release.assets?.find((a: any) =>
        a.name?.endsWith(".apk")
      );
      const assetUpdatedTime = apkAsset?.updated_at ? new Date(apkAsset.updated_at).getTime() : 0;
      const latestReleaseTime = Math.max(publishedTime, assetUpdatedTime);

      // Only prompt if there is an actual newer release than the current build
      const isNewer =
        (releaseId > CURRENT_RELEASE_ID && latestReleaseTime > CURRENT_BUILD_TIMESTAMP) ||
        (tagName && tagName !== "latest" && tagName !== `v${CURRENT_APP_VERSION}` && tagName !== CURRENT_APP_VERSION && latestReleaseTime > CURRENT_BUILD_TIMESTAMP);

      if (!isNewer) {
        return { hasUpdate: false, updateInfo: null };
      }

      if (silent && dismissedReleaseId && Number(dismissedReleaseId) === releaseId) {
        return { hasUpdate: false, updateInfo: null };
      }

      const downloadUrl = apkAsset?.browser_download_url || DEFAULT_APK_RELEASE_URL;

      const ghUpdateInfo: AppUpdateInfo = {
        version: tagName && tagName !== "latest" ? tagName.replace(/^v/, "") : "1.0.1",
        version_code: CURRENT_APP_VERSION_CODE + 1,
        release_id: releaseId,
        release_url: downloadUrl,
        release_notes: release.body || "New features, bug fixes, and AI assistant improvements.",
        release_notes_te: "కొత్త ఫీచర్లు మరియు AI అసిస్టెంట్ అప్‌డేట్‌లు అందుబాటులో ఉన్నాయి.",
        release_notes_hi: "नई सुविधाएं और AI असिस्टेंट सुधार उपलब्ध हैं।"
      };

      return { hasUpdate: true, updateInfo: ghUpdateInfo };
    }
  } catch (err) {
    if (!silent) {
      console.warn("App update check warning:", err);
    }
  }

  return { hasUpdate: false, updateInfo: null };
}

/**
 * Dismisses an update for the current version so user isn't spammed on every launch.
 */
export async function dismissUpdateForNow(versionCode?: number, releaseId?: number): Promise<void> {
  try {
    if (versionCode) {
      await AsyncStorage.setItem(DISMISSED_UPDATE_KEY, String(versionCode));
    }
    if (releaseId) {
      await AsyncStorage.setItem(DISMISSED_RELEASE_ID_KEY, String(releaseId));
    }
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
