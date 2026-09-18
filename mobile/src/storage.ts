import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "artisan_ai_mobile_token";
const DOMAIN_KEY = "artisan_ai_mobile_domain";
const USER_KEY = "artisan_ai_mobile_user";

export async function saveSession(token: string, domain: "STUDIO" | "MARKETPLACE", user: unknown) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await AsyncStorage.setItem(DOMAIN_KEY, domain);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user ?? null));
}

export async function getSession() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const domain = await AsyncStorage.getItem(DOMAIN_KEY);
  const rawUser = await AsyncStorage.getItem(USER_KEY);
  return {
    token,
    domain: domain as "STUDIO" | "MARKETPLACE" | null,
    user: rawUser ? JSON.parse(rawUser) : null
  };
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await AsyncStorage.multiRemove([DOMAIN_KEY, USER_KEY]);
}
