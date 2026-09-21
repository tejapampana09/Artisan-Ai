import "./init";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
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
const SHOWN_NOTIFS_KEY = "artisan_shown_notification_ids";

// Persistent deduplication set to guarantee notifications NEVER fire twice
const shownNotificationIds = new Set<number>();
AsyncStorage.getItem(SHOWN_NOTIFS_KEY).then((raw) => {
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const id of arr) {
          shownNotificationIds.add(Number(id));
        }
      }
    } catch {}
  }
}).catch(() => {});

async function recordNotificationShown(id: number) {
  shownNotificationIds.add(id);
  const arr = Array.from(shownNotificationIds).slice(-200);
  await AsyncStorage.setItem(SHOWN_NOTIFS_KEY, JSON.stringify(arr)).catch(() => {});
}

// Listen for notifications delivered directly via Expo Push Server (app active/background)
Notifications.addNotificationReceivedListener((notification) => {
  const data = notification?.request?.content?.data as any;
  const notifId = data?.notification_id || data?.id;
  if (notifId) {
    const num = Number(notifId);
    recordNotificationShown(num);
    for (const d of ["STUDIO", "MARKETPLACE"] as AuthDomain[]) {
      domainCaches[d].knownIds.add(num);
    }
  }
});

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
let activeDomain: AuthDomain = "MARKETPLACE";

interface DomainCache {
  items: NotificationItem[];
  unreadCount: number;
  knownIds: Set<number>;
  hasInitializedHistory: boolean;
}

const domainCaches: Record<AuthDomain, DomainCache> = {
  STUDIO: {
    items: [],
    unreadCount: 0,
    knownIds: new Set<number>(),
    hasInitializedHistory: false
  },
  MARKETPLACE: {
    items: [],
    unreadCount: 0,
    knownIds: new Set<number>(),
    hasInitializedHistory: false
  }
};

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: any = null;

export function resetNotificationHistory(targetDomain?: AuthDomain): void {
  if (targetDomain) {
    domainCaches[targetDomain] = {
      items: [],
      unreadCount: 0,
      knownIds: new Set<number>(),
      hasInitializedHistory: false
    };
  } else {
    for (const d of ["STUDIO", "MARKETPLACE"] as AuthDomain[]) {
      domainCaches[d] = {
        items: [],
        unreadCount: 0,
        knownIds: new Set<number>(),
        hasInitializedHistory: false
      };
    }
  }
  notifyListeners();
}

export function subscribeNotifications(listener: NotificationListener) {
  listeners.push(listener);
  // Immediately dispatch current cache to new listener
  const current = domainCaches[activeDomain];
  listener(current.items, current.unreadCount);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  const current = domainCaches[activeDomain];
  for (const listener of listeners) {
    try {
      listener(current.items, current.unreadCount);
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

      await Notifications.setNotificationChannelAsync("orders_channel", {
        name: "Orders & Enquiries",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#9F3C16",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
        enableLights: true
      });

      await Notifications.setNotificationChannelAsync("artisan_general", {
        name: "Artisan Updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 200],
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

    // Try fetching push token (Expo Push Token or native Device/FCM Token)
    let token: string | null = null;
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        (Constants as any)?.easConfig?.projectId;
      const expoToken = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      if (expoToken?.data) {
        token = expoToken.data;
      }
    } catch {
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        if (deviceToken?.data) {
          token = String(deviceToken.data);
        }
      } catch {}
    }

    if (token) {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      const session = await getSession();
      if (session?.token) {
        try {
          await api.registerPushToken(token, session.domain || "MARKETPLACE");
          console.log("[Push] Registered device push token with backend:", token);
        } catch (regErr) {
          console.warn("[Push] Could not sync push token with backend:", regErr);
        }
      }
      return token;
    }

    return null;
  } catch (err) {
    console.warn("Push notification registration failed:", err);
    return null;
  }
}

/**
 * Synchronize registered push token with backend for current or specified domain
 */
export async function syncPushTokenWithBackend(domainOverride?: AuthDomain): Promise<boolean> {
  try {
    let domain = domainOverride;
    if (!domain) {
      const session = await getSession();
      if (!session || !session.token) {
        return false;
      }
      domain = session.domain || "MARKETPLACE";
    }

    let token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) {
      token = await registerForPushNotificationsAsync();
    }

    if (token) {
      await api.registerPushToken(token, domain);
      console.log(`[Push] Successfully registered push token for domain ${domain}:`, token);
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[Push] Error syncing push token with backend:", err);
    return false;
  }
}

/**
 * Send an immediate local notification with heads-up banner, sound, and vibration.
 * Uses deterministic identifier and persistent deduplication to guarantee notifications NEVER trigger twice.
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  notificationId?: number | string
) {
  try {
    if (notificationId) {
      const numId = Number(notificationId);
      if (shownNotificationIds.has(numId)) {
        return; // Already shown or received! Never alert twice.
      }
      await recordNotificationShown(numId);
    }
    const identifier = notificationId ? `artisan_notif_${notificationId}` : undefined;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        data: data || {},
        sound: "default",
        vibrate: [0, 250, 250, 250],
        priority: Notifications.AndroidNotificationPriority.MAX
      },
      trigger: {
        channelId: "orders_channel"
      }
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
      if (!session || !session.token) {
        return domainCaches[activeDomain].items;
      }
      domain = session.domain || "MARKETPLACE";
    }
    activeDomain = domain;
    const cache = domainCaches[domain];

    // Seed knownIds from local cache on cold start before network fetch
    if (!cache.hasInitializedHistory && cache.knownIds.size === 0) {
      try {
        const local = await AsyncStorage.getItem(`${NOTIFICATIONS_CACHE_KEY}_${domain.toLowerCase()}`);
        if (local) {
          const parsed: NotificationItem[] = JSON.parse(local);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              cache.knownIds.add(item.id);
            }
          }
        }
      } catch {}
    }

    const res = await api.notifications(domain);
    if (Array.isArray(res)) {
      // Check if new unread items appeared compared to previous cache
      const newlyReceived = res.filter((n) => !n.is_read && !cache.knownIds.has(n.id));

      cache.items = res;
      cache.unreadCount = res.filter((n) => !n.is_read).length;
      notifyListeners();

      // Trigger native notifications for new arrivals if session is already active
      if (cache.hasInitializedHistory && newlyReceived.length > 0) {
        for (const item of newlyReceived) {
          // Never trigger if push notification already presented this to user
          if (shownNotificationIds.has(item.id)) {
            continue;
          }
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
            await sendLocalNotification(
              item.title,
              item.message,
              {
                id: item.id,
                type: item.type,
                role: domain === "STUDIO" ? "seller" : "buyer"
              },
              item.id
            );
          }
        }
      }

      // Mark all current IDs as known
      for (const item of res) {
        cache.knownIds.add(item.id);
      }
      cache.hasInitializedHistory = true;

      await AsyncStorage.setItem(`${NOTIFICATIONS_CACHE_KEY}_${domain.toLowerCase()}`, JSON.stringify(res));
      return res;
    }
    return cache.items;
  } catch (err) {
    const cache = domainCaches[activeDomain];
    // Return cached list if offline
    if (cache.items.length === 0) {
      try {
        const local = await AsyncStorage.getItem(`${NOTIFICATIONS_CACHE_KEY}_${activeDomain.toLowerCase()}`);
        if (local) {
          cache.items = JSON.parse(local);
          cache.unreadCount = cache.items.filter((n) => !n.is_read).length;
          for (const item of cache.items) {
            cache.knownIds.add(item.id);
          }
          cache.hasInitializedHistory = true;
          notifyListeners();
        }
      } catch {}
    }
    return cache.items;
  }
}

/**
 * Start periodic real-time polling for notifications while the app is running (foreground & background)
 * Defaults to 20s fallback polling rate, with immediate fetch on app active events.
 */
export function startNotificationPolling(intervalMs: number = 20000): () => void {
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
      // Immediate fetch when app transitions to active
      if (nextState === "active") {
        fetchNotifications().catch(() => {});
      }
      // Ensure continuous polling across background & active so background updates are delivered in real time
      if (!pollingTimer) {
        pollingTimer = setInterval(() => {
          fetchNotifications().catch(() => {});
        }, intervalMs);
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
      domain = session.domain || activeDomain;
    }
    const cache = domainCaches[domain];

    // Optimistically update in domain cache
    cache.items = cache.items.map((item) =>
      item.id === notificationId ? { ...item, is_read: true } : item
    );
    cache.unreadCount = cache.items.filter((n) => !n.is_read).length;
    notifyListeners();

    await api.markNotificationRead(notificationId, domain);
    await AsyncStorage.setItem(`${NOTIFICATIONS_CACHE_KEY}_${domain.toLowerCase()}`, JSON.stringify(cache.items));
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
  let domain = domainOverride;
  if (!domain) {
    const session = await getSession();
    domain = session.domain || activeDomain;
  }
  const cache = domainCaches[domain];
  const unreadItems = cache.items.filter((n) => !n.is_read);

  // Optimistically set all to read
  cache.items = cache.items.map((n) => ({ ...n, is_read: true }));
  cache.unreadCount = 0;
  notifyListeners();

  await Promise.allSettled(
    unreadItems.map((item) => markAsRead(item.id, domain))
  );
}

export function getCachedUnreadCount(): number {
  return domainCaches[activeDomain].unreadCount;
}