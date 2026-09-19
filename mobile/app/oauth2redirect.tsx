import React, { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../src/api";
import { saveSession, getSession } from "../src/storage";

export default function OAuth2RedirectScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();

  useEffect(() => {
    let isMounted = true;

    async function finishAuth() {
      // 1. Signal WebBrowser to complete the active auth session
      try {
        WebBrowser.maybeCompleteAuthSession();
      } catch (e) {
        console.warn("maybeCompleteAuthSession error:", e);
      }

      // 2. Allow a brief frame for login.tsx promptAsync to handle if still alive
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (!isMounted) return;

      const session = await getSession();
      if (session?.token && session.token !== "guest_buyer_token") {
        router.replace("/buyer");
        return;
      }

      // 3. Fallback: If login.tsx was unmounted by Android during browser switch,
      // exchange the authorization code directly here using persisted PKCE verifier
      if (params.code) {
        try {
          const codeVerifier = await AsyncStorage.getItem("google_oauth_code_verifier");
          const savedClientId = await AsyncStorage.getItem("google_oauth_client_id");
          const savedRedirectUri = await AsyncStorage.getItem("google_oauth_redirect_uri");

          const clientId =
            savedClientId ||
            process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
            process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
            "";

          const redirectUri = savedRedirectUri || "artisanai://oauth2redirect";

          const bodyParams: Record<string, string> = {
            client_id: clientId,
            code: params.code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          };
          if (codeVerifier) {
            bodyParams.code_verifier = codeVerifier;
          }

          const formBody = Object.keys(bodyParams)
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(bodyParams[k])}`)
            .join("&");

          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formBody,
          });
          const tokenData = await tokenRes.json();

          if (tokenData.access_token || tokenData.id_token) {
            const data = await api.googleLoginBuyer({
              access_token: tokenData.access_token,
              token: tokenData.id_token,
            });

            if (data?.access_token) {
              await saveSession(data.access_token, "MARKETPLACE", data.user);
            }
          }

          await AsyncStorage.removeItem("google_oauth_code_verifier");
          await AsyncStorage.removeItem("google_oauth_client_id");
          await AsyncStorage.removeItem("google_oauth_redirect_uri");
        } catch (exchangeErr) {
          console.warn("OAuth redirect token exchange fallback error:", exchangeErr);
        }
      }

      // 4. Navigate back to buyer marketplace
      if (isMounted) {
        router.replace("/buyer");
      }
    }

    finishAuth();

    return () => {
      isMounted = false;
    };
  }, [params.code]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#9F3C16" />
      <Text style={styles.title}>Completing Sign-In…</Text>
      <Text style={styles.subtitle}>Connecting you to Artisan AI Marketplace</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6F0",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: "800",
    color: "#2A1E17",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#796A5F",
    textAlign: "center",
  },
});
