import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { theme } from "../src/theme";

export default function NotFoundScreen() {
  const params = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    if (params.code) {
      router.replace({ pathname: "/oauth2redirect", params: { code: params.code } });
      return;
    }
    const timer = setTimeout(() => {
      router.replace("/buyer");
    }, 1200);
    return () => clearTimeout(timer);
  }, [params.code]);

  return (
    <>
      <Stack.Screen options={{ title: "Page Not Found", headerShown: false }} />
      <View style={styles.container}>
        <Text style={styles.title}>Redirecting to Marketplace…</Text>
        <Text style={styles.subtitle}>Returning you safely to Artisan AI</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/buyer")}>
          <Text style={styles.buttonText}>Go to Marketplace</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6F0",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.muted,
    marginBottom: 20,
  },
  button: {
    backgroundColor: theme.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
