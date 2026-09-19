import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { resetNotificationHistory } from "./notifications";

const STUDIO_TOKEN_KEY = "artisan_ai_studio_token";
const MARKETPLACE_TOKEN_KEY = "artisan_ai_marketplace_token";
const ACTIVE_DOMAIN_KEY = "artisan_ai_active_domain";
const STUDIO_USER_KEY = "artisan_ai_studio_user";
const MARKETPLACE_USER_KEY = "artisan_ai_marketplace_user";

export type AuthDomain = "STUDIO" | "MARKETPLACE";

export interface UserSession {
  token: string | null;
  domain: AuthDomain | null;
  user: any | null;
}

export async function saveSession(
  token: string,
  domain: AuthDomain,
  user: unknown
): Promise<void> {
  resetNotificationHistory();
  if (domain === "STUDIO") {
    // Purge any opposing marketplace/buyer session (strict mutual exclusion)
    await SecureStore.deleteItemAsync(MARKETPLACE_TOKEN_KEY).catch(() => {});
    await AsyncStorage.removeItem(MARKETPLACE_USER_KEY).catch(() => {});

    await SecureStore.setItemAsync(STUDIO_TOKEN_KEY, token);
    await AsyncStorage.setItem(STUDIO_USER_KEY, JSON.stringify(user ?? null));
  } else {
    // Purge any opposing studio/seller session (strict mutual exclusion)
    await SecureStore.deleteItemAsync(STUDIO_TOKEN_KEY).catch(() => {});
    await AsyncStorage.removeItem(STUDIO_USER_KEY).catch(() => {});

    await SecureStore.setItemAsync(MARKETPLACE_TOKEN_KEY, token);
    await AsyncStorage.setItem(MARKETPLACE_USER_KEY, JSON.stringify(user ?? null));
  }
  await AsyncStorage.setItem(ACTIVE_DOMAIN_KEY, domain);
}

export async function getSession(requestedDomain?: AuthDomain): Promise<UserSession> {
  const activeDomain = (await AsyncStorage.getItem(ACTIVE_DOMAIN_KEY)) as AuthDomain | null;
  const targetDomain = requestedDomain || activeDomain || "MARKETPLACE";

  if (targetDomain === "STUDIO") {
    const token = await SecureStore.getItemAsync(STUDIO_TOKEN_KEY);
    const rawUser = await AsyncStorage.getItem(STUDIO_USER_KEY);
    return {
      token,
      domain: "STUDIO",
      user: rawUser ? JSON.parse(rawUser) : null
    };
  } else {
    const token = await SecureStore.getItemAsync(MARKETPLACE_TOKEN_KEY);
    const rawUser = await AsyncStorage.getItem(MARKETPLACE_USER_KEY);
    return {
      token,
      domain: "MARKETPLACE",
      user: rawUser ? JSON.parse(rawUser) : null
    };
  }
}

export async function setActiveDomain(domain: AuthDomain): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_DOMAIN_KEY, domain);
}

export async function clearSession(domain?: AuthDomain): Promise<void> {
  resetNotificationHistory();
  if (!domain || domain === "STUDIO") {
    await SecureStore.deleteItemAsync(STUDIO_TOKEN_KEY).catch(() => {});
    await AsyncStorage.removeItem(STUDIO_USER_KEY).catch(() => {});
  }
  if (!domain || domain === "MARKETPLACE") {
    await SecureStore.deleteItemAsync(MARKETPLACE_TOKEN_KEY).catch(() => {});
    await AsyncStorage.removeItem(MARKETPLACE_USER_KEY).catch(() => {});
  }
  if (!domain) {
    await AsyncStorage.removeItem(ACTIVE_DOMAIN_KEY).catch(() => {});
  } else {
    const activeDomain = await AsyncStorage.getItem(ACTIVE_DOMAIN_KEY);
    if (activeDomain === domain) {
      await AsyncStorage.removeItem(ACTIVE_DOMAIN_KEY).catch(() => {});
    }
  }
}

/**
 * Strict role and view boundary enforcement:
 * - When targetRole is "seller":
 *   - Auto-logouts any buyer/marketplace session.
 *   - Checks for active, valid STUDIO token with ARTISAN/ADMIN role.
 *   - If not authenticated, redirects strictly to /login?role=seller.
 * - When targetRole is "buyer":
 *   - Auto-logouts any active STUDIO/seller session on view change.
 */
export async function enforceRoleBoundary(
  targetRole: "seller" | "buyer",
  routerInstance: any
): Promise<boolean> {
  try {
    if (targetRole === "seller") {
      // Auto logout any buyer session
      await clearSession("MARKETPLACE");

      const studioSess = await getSession("STUDIO");
      if (!studioSess.token) {
        routerInstance.replace({ pathname: "/login", params: { role: "seller" } });
        return false;
      }

      const role = (studioSess.user?.role || "").toUpperCase();
      if (role && role !== "ARTISAN" && role !== "ADMIN" && role !== "SELLER") {
        await clearSession("STUDIO");
        routerInstance.replace({ pathname: "/login", params: { role: "seller" } });
        return false;
      }
      return true;
    } else {
      // Auto logout any seller session when switching to buyer view
      const studioSess = await getSession("STUDIO");
      if (studioSess.token) {
        console.log("[RoleBoundary] Switched to buyer view: auto-logging out seller session");
        await clearSession("STUDIO");
      }
      return true;
    }
  } catch (err) {
    console.warn("[RoleBoundary] Error enforcing role boundary:", err);
    return true;
  }
}
