import "../src/init";
import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { theme } from "../src/theme";
import { I18nProvider } from "../src/i18n";
import {
  registerForPushNotificationsAsync,
  startNotificationPolling,
  addNotificationResponseReceivedListener,
  syncPushTokenWithBackend
} from "../src/notifications";
import { getSession } from "../src/storage";
import { startNativeForegroundService } from "../src/nativeForegroundService";
import { CustomAlertModal, AppUpdateModal } from "../src/components";
import { checkForAppUpdate, AppUpdateInfo } from "../src/services/appUpdater";

let lastHandledNotificationId: string | number | null = null;

export default function Layout() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  useEffect(() => {
    // Register push notification permissions & Android channels
    registerForPushNotificationsAsync().catch(() => {});
    syncPushTokenWithBackend().catch(() => {});
    startNativeForegroundService().catch(() => {});
    
    // Start real-time notification polling (every 4s)
    const stopPolling = startNotificationPolling(4000);

    // Listen for user interaction with notifications (taps)
    const responseSubscription = addNotificationResponseReceivedListener(async (response) => {
      try {
        const data: any = response?.notification?.request?.content?.data;
        if (!data || !data.type) return;

        // Deduplicate handling of the exact same notification response
        const notifId = data.id || response.notification.request.identifier;
        if (notifId && notifId === lastHandledNotificationId) {
          return;
        }
        lastHandledNotificationId = notifId;

        const type = String(data.type).toUpperCase();
        const role = data.role ? String(data.role).toLowerCase() : null;

        const session = await getSession();
        const isStudio = role === "seller" || (!role && session?.domain === "STUDIO");

        if (type.includes("ENQUIRY")) {
          if (isStudio) {
            router.push("/seller-enquiries");
          } else {
            router.push("/buyer-enquiries");
          }
        } else if (type.includes("ORDER")) {
          if (isStudio) {
            router.push("/seller-orders");
          } else {
            router.push("/buyer-orders");
          }
        } else if (type.includes("REVIEW")) {
          if (isStudio) {
            router.push("/seller-products");
          }
        }
      } catch (err) {
        console.warn("Notification navigation error:", err);
      }
    });

    // Non-intrusive update check 2.5 seconds after launch
    const updateTimer = setTimeout(() => {
      checkForAppUpdate(true)
        .then((res) => {
          if (res.hasUpdate && res.updateInfo) {
            setUpdateInfo(res.updateInfo);
            setShowUpdateModal(true);
          }
        })
        .catch(() => {});
    }, 2500);

    return () => {
      clearTimeout(updateTimer);
      stopPolling();
      responseSubscription.remove();
    };
  }, []);

  return (
    <I18nProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.ink,
          contentStyle: { backgroundColor: theme.bg }
        }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="buyer" options={{ headerShown: false }} />
          <Stack.Screen name="seller" options={{ headerShown: false }} />
          <Stack.Screen name="oauth2redirect" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
        <CustomAlertModal />
        <AppUpdateModal
          visible={showUpdateModal}
          updateInfo={updateInfo}
          onClose={() => setShowUpdateModal(false)}
        />
      </SafeAreaProvider>
    </I18nProvider>
  );
}

