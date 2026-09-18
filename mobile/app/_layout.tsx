import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { theme } from "../src/theme";

export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.ink,
        contentStyle: { backgroundColor: theme.bg }
      }} />
    </SafeAreaProvider>
  );
}
