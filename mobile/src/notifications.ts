import "./init";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { getSession, AuthDomain } from "./storage";

export function addNotificationResponseReceivedListener(
  listener: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const PUSH_TOKEN_KEY = "artisan_push_token";
const NOTIFICATIONS_CACHE_KEY = "artisan_cached_notifications";

// Configure how incoming notifications appear while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

// Listeners for in-app reactive updates
type NotificationListener = (items: NotificationItem[], unreadCount: number) => void;
let listeners: NotificationListener[] = [];
let cachedNotifications: NotificationItem[] = [];
let cachedUnreadCount = 0;
let knownIds = new Set<number>();
let hasInitializedHistory = false;
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: any = null;

export function subscribeNotifications(listener: NotificationListener) {
  listeners.push(listener);
  // Immediately dispatch current cache to new listener
  listener(cachedNotifications, cachedUnreadCount);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  cachedUnreadCount = cachedNotifications.filter((n) => !n.is_read).length;
  for (const listener of listeners) {
    try {
      listener(cachedNotifications, cachedUnreadCount);
    } catch (e) {
      console.warn("Notification listener error:", e);
    }
  }
}

/**
 * Configure Android notification channels and request permission
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Artisan AI Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#9F3C16",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
        enableLights: true
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    // Try fetching device push token if supported (not in Expo Go on Android)
    try {
      const { isRunningInExpoGo } = require("expo");
      if (!isRunningInExpoGo()) {
        const tokenData = await Notifications.getDevicePushTokenAsync();
        if (tokenData?.data) {
          await AsyncStorage.setItem(PUSH_TOKEN_KEY, tokenData.data);
          return tokenData.data;
        }
      }
    } catch {
      // Benign fallback on emulators or development environments
    }

    return null;
  } catch (err) {
    console.warn("Push notification registration failed:", err);
    return null;
  }
}

/**
 * Send an immediate local notification with heads-up banner, sound, and vibration
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: "default",
        vibrate: [0, 250, 250, 250],
        priority: Notifications.AndroidNotificationPriority.MAX
      },
      trigger: null // triggers immediately
    });
  } catch (err) {
    console.warn("Could not schedule local notification:", err);
  }
}

/**
 * Fetch notifications from the backend for the current user session
 */
export async function fetchNotifications(domainOverride?: AuthDomain): Promise<NotificationItem[]> {
  try {
    let domain = domainOverride;
    if (!domain) {
      const session = await getSession();
      domain = session.domain || "MARKETPLACE";
    }

    const res = await api.notifications(domain);
    if (Array.isArray(res)) {
      // Check if new unread items appeared compared to previous cache
      const newlyReceived = res.filter((n) => !n.is_read && !knownIds.has(n.id));

      cachedNotifications = res;
      notifyListeners();

      // Trigger native notifications for new arrivals if session is already active
      if (hasInitializedHistory && newlyReceived.length > 0) {
        for (const item of newlyReceived) {
          let allowLocal = true;
          try {
            const rawSettings = await AsyncStorage.getItem("artisan_notifications_settings");
            if (rawSettings) {
              const settings = JSON.parse(rawSettings);
              const t = (item.type || "").toUpperCase();
              if ((t.includes("ORDER") || t.includes("STATUS")) && settings.order === false) {
                allowLocal = false;
              } else if (
                (t.includes("TIP") || t.includes("PRICE") || t.includes("OPPORTUNITY")) &&
                settings.aiTips === false
              ) {
                allowLocal = false;
              } else if (t.includes("PROMO") && settings.promo === false) {
                allowLocal = false;
              }
            }
          } catch {}

          if (allowLocal) {
            await sendLocalNotification(item.title, item.message, {
              id: item.id,
              type: item.type
            });
          }
        }
      }

      // Mark all current IDs as known
      for (const item of res) {
        knownIds.add(item.id);
      }
      hasInitializedHistory = true;

      await AsyncStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(res));
      return res;
    }
    return cachedNotifications;
  } catch (err) {
    // Return cached list if offline
    if (cachedNotifications.length === 0) {
      try {
        const local = await AsyncStorage.getItem(NOTIFICATIONS_CACHE_KEY);
        if (local) {
          cachedNotifications = JSON.parse(local);
          for (const item of cachedNotifications) {
            knownIds.add(item.id);
          }
          hasInitializedHistory = true;
          notifyListeners();
        }
      } catch {}
    }
    return cachedNotifications;
  }
}

/**
 * Start periodic real-time polling for notifications while the app is running
 */
export function startNotificationPolling(intervalMs: number = 4000): () => void {
  // Initial immediate fetch
  fetchNotifications().catch(() => {});

  if (pollingTimer) {
    clearInterval(pollingTimer);
  }

  pollingTimer = setInterval(() => {
    fetchNotifications().catch(() => {});
  }, intervalMs);

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        fetchNotifications().catch(() => {});
        if (!pollingTimer) {
          pollingTimer = setInterval(() => {
            fetchNotifications().catch(() => {});
          }, intervalMs);
        }
      } else if (nextState === "background") {
        // Clear tight interval while in background to save battery
        if (pollingTimer) {
          clearInterval(pollingTimer);
          pollingTimer = null;
        }
      }
    });
  }

  return () => {
    stopNotificationPolling();
  };
}

export function stopNotificationPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}

/**
 * Mark a specific notification as read
 */
export async function markAsRead(notificationId: number, domainOverride?: AuthDomain): Promise<boolean> {
  try {
    let domain = domainOverride;
    if (!domain) {
      const session = await getSession();
      domain = session.domain || "MARKETPLACE";
    }

    // Optimistically update in memory
    cachedNotifications = cachedNotifications.map((item) =>
      item.id === notificationId ? { ...item, is_read: true } : item
    );
    notifyListeners();

    await api.markNotificationRead(notificationId, domain);
    await AsyncStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cachedNotifications));
    return true;
  } catch (err) {
    console.warn("Failed to mark notification read:", err);
    return false;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(domainOverride?: AuthDomain): Promise<void> {
  const unreadItems = cachedNotifications.filter((n) => !n.is_read);
  // Optimistically set all to read
  cachedNotifications = cachedNotifications.map((n) => ({ ...n, is_read: true }));
  notifyListeners();

  await Promise.allSettled(
    unreadItems.map((item) => markAsRead(item.id, domainOverride))
  );
}

export function getCachedUnreadCount(): number {
  return cachedUnreadCount;
}