import "../src/init";
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { theme } from "../src/theme";
import { I18nProvider } from "../src/i18n";
import {
  registerForPushNotificationsAsync,
  fetchNotifications,
  addNotificationResponseReceivedListener
} from "../src/notifications";

export default function Layout() {
  useEffect(() => {
    // Register push notification permissions & Android channels
    registerForPushNotificationsAsync().catch(() => {});
    fetchNotifications().catch(() => {});

    // Listen for user interaction with notifications (taps)
    const responseSubscription = addNotificationResponseReceivedListener((response) => {
      try {
        const data: any = response.notification.request.content.data;
        const type = (data?.type || "").toUpperCase();

        if (type.includes("ENQUIRY")) {
          router.push("/seller-enquiries");
        } else if (type.includes("ORDER")) {
          router.push("/seller-orders");
        } else {
          router.push("/notifications");
        }
      } catch (err) {
        console.warn("Notification navigation error:", err);
      }
    });

    return () => {
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
      </SafeAreaProvider>
    </I18nProvider>
  );
}

