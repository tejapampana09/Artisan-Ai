import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  StatusBar,
  Modal
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { saveSession } from "../src/storage";
import { theme } from "../src/theme";

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  "";
const WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  "";


let cachedNativeAuth: { GoogleSignin: any; statusCodes: any } | null | undefined = undefined;

function getNativeGoogleSignin(): { GoogleSignin: any; statusCodes: any } | null {
  if (cachedNativeAuth !== undefined) {
    return cachedNativeAuth;
  }
  try {
    const { TurboModuleRegistry, NativeModules } = require("react-native");
    const isAvailable =
      (TurboModuleRegistry?.get && TurboModuleRegistry.get("RNGoogleSignin")) ||
      NativeModules?.RNGoogleSignin;

    if (!isAvailable) {
      cachedNativeAuth = null;
      return null;
    }

    const module = require("@react-native-google-signin/google-signin");
    if (module?.GoogleSignin) {
      module.GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        scopes: ["openid", "profile", "email"],
      });
      cachedNativeAuth = {
        GoogleSignin: module.GoogleSignin,
        statusCodes: module.statusCodes || {},
      };
      return cachedNativeAuth;
    }
  } catch {
    // Module not registered or running in Expo Go
  }
  cachedNativeAuth = null;
  return null;
}

export default function Login() {
  const params = useLocalSearchParams<{ role?: string; redirect?: string }>();
  const [activeRole, setActiveRole] = useState<"seller" | "buyer">(
    params.role === "seller" ? "seller" : "buyer"
  );
  const isSeller = activeRole === "seller";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSellerAuth = async () => {
    setErrorMessage("");
    if (!email.trim() || !password) {
      setErrorMessage("Please enter your artisan email/phone and password.");
      return;
    }

    setBusy(true);
    try {
      const data = await api.loginSeller(email.trim(), password);
      if (!data?.access_token) {
        throw new Error("No access token returned by server.");
      }

      await saveSession(data.access_token, "STUDIO", data.user);
      router.replace("/seller");
    } catch (err: any) {
      setErrorMessage(
        err?.detail || err?.message || "Sign-in failed. Please check your credentials."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    const nativeAuth = getNativeGoogleSignin();
    if (nativeAuth) {
      // --- 1. NATIVE GOOGLE PLAY SERVICES (Standalone APK) ---
      setGoogleBusy(true);
      try {
        await nativeAuth.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        // Force account chooser prompt by signing out any cached Google session
        await nativeAuth.GoogleSignin.signOut().catch(() => {});
        const result = await nativeAuth.GoogleSignin.signIn();

        if (result.type !== "success" || !result.data?.idToken) {
          return;
        }

        const data = await api.googleLoginBuyer({ token: result.data.idToken });
        if (!data?.access_token) {
          throw new Error("Server could not verify Google account.");
        }

        await saveSession(data.access_token, "MARKETPLACE", data.user);
        router.replace(params.redirect ? (params.redirect as any) : "/buyer");
        return;
      } catch (err: any) {
        if (
          err?.code === "SIGN_IN_CANCELLED" ||
          err?.code === "ERR_REQUEST_CANCELED" ||
          err?.message?.includes("cancelled") ||
          err?.message?.includes("dismissed")
        ) {
          return;
        }
        setErrorMessage(
          err?.message ||
            "Google sign-in failed. Verify this app's package name and SHA-1 in Google Cloud Console."
        );
      } finally {
        setGoogleBusy(false);
      }
      return;
    }

    setErrorMessage(
      "Google sign-in requires an installed Android build with Google Play Services. Please use email/password to sign in."
    );
  };

  const handleGuestExplore = async () => {
    await saveSession("guest_buyer_token", "MARKETPLACE", {
      name: "Guest Explorer",
      email: "guest@artisanai.in",
      role: "BUYER"
    });
    router.replace("/buyer");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF6F0" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF6F0" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Nav */}
          <View style={styles.topNav}>
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else if (params.redirect) {
                  router.replace(params.redirect as any);
                } else {
                  router.replace("/buyer");
                }
              }}
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color={theme.ink} />
            </Pressable>
            <View style={styles.brandRow}>
              <Image
                source={require("../assets/clean-logo-mark.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.brandName}>ARTISAN AI</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          {/* Role Switcher Tabs (Matching Web AuthModal) */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tab, !isSeller && styles.tabActive]}
              onPress={() => {
                setActiveRole("buyer");
                setErrorMessage("");
              }}
            >
              <Ionicons
                name="bag-handle-outline"
                size={16}
                color={!isSeller ? theme.accent : theme.muted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, !isSeller && styles.tabTextActive]}>
                Customer Sign In
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tab, isSeller && styles.tabActive]}
              onPress={() => {
                setActiveRole("seller");
                setErrorMessage("");
              }}
            >
              <Ionicons
                name="storefront-outline"
                size={16}
                color={isSeller ? theme.accent : theme.muted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, isSeller && styles.tabTextActive]}>
                Artisan Studio
              </Text>
            </Pressable>
          </View>

          {/* Header Card (Exact match to Web AuthModal Header) */}
          <View style={styles.headerCard}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {isSeller ? "🎨 SELLER STUDIO PORTAL" : "🛍️ CUSTOMER SIGN IN"}
              </Text>
            </View>
            <Text style={styles.headerTitle}>
              {isSeller ? "Seller Studio Login" : "Welcome to Artisan AI"}
            </Text>
            <Text style={styles.headerSub}>
              {isSeller
                ? "Official access portal for verified master artisans, heritage craft clusters, and weaver cooperatives."
                : "Shop authentic Indian handicrafts directly from master artisans with zero middleman markups."}
            </Text>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#D32F2F" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* ─── CUSTOMER VIEW: EXACT MATCH TO WEB AUTHMODAL ─── */}
          {!isSeller ? (
            <View style={styles.card}>
              {/* Primary 1-Click Google Sign In */}
              <Pressable
                style={styles.googleBtn}
                onPress={handleGoogleLogin}
                disabled={googleBusy}
              >
                {googleBusy ? (
                  <View style={styles.rowCenter}>
                    <ActivityIndicator color="#EA4335" size="small" style={{ marginRight: 10 }} />
                    <Text style={styles.googleBtnText}>Signing in with Google…</Text>
                  </View>
                ) : (
                  <View style={styles.rowCenter}>
                    <AntDesign name="google" size={20} color="#EA4335" style={{ marginRight: 10 }} />
                    <Text style={styles.googleBtnText}>
                      Continue with Google
                    </Text>
                  </View>
                )}
              </Pressable>
              <Text style={styles.googleHelper}>
                1-Click Instant Sign In • No password required
              </Text>

              {/* Mobile OTP Coming Soon Box (From Web) */}
              <View style={styles.otpBox}>
                <View style={styles.otpIconBox}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#B85D19" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.otpHeaderRow}>
                    <Text style={styles.otpTitle}>Mobile OTP Sign-In</Text>
                    <View style={styles.comingSoonTag}>
                      <Text style={styles.comingSoonText}>Coming Soon</Text>
                    </View>
                  </View>
                  <Text style={styles.otpDesc}>
                    Direct phone number + OTP login is arriving soon. In the meantime, please sign in with 1-click Google or explore directly.
                  </Text>
                </View>
              </View>

              {/* Direct Guest Explore */}
              <Pressable style={styles.guestBtn} onPress={handleGuestExplore}>
                <Ionicons name="sparkles" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.guestBtnText}>Explore Marketplace Directly</Text>
              </Pressable>

              {/* Customer Account Perks (Exact Match to Web) */}
              <View style={styles.perksBox}>
                <Text style={styles.perksTitle}>CUSTOMER ACCOUNT PERKS</Text>
                <View style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#2E7D32" style={{ marginRight: 8 }} />
                  <Text style={styles.perkText}>Real-time tracking of handloom & craft orders</Text>
                </View>
                <View style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#2E7D32" style={{ marginRight: 8 }} />
                  <Text style={styles.perkText}>Direct WhatsApp & voice enquiries to verified artisans</Text>
                </View>
                <View style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#2E7D32" style={{ marginRight: 8 }} />
                  <Text style={styles.perkText}>Secure UPI, Card & Cash on Delivery checkout</Text>
                </View>
              </View>

              {/* Switch to Seller Link */}
              <Pressable
                onPress={() => {
                  setActiveRole("seller");
                  setErrorMessage("");
                }}
                style={styles.switchLink}
              >
                <Text style={styles.switchLinkText}>
                  Are you an artisan seller? <Text style={{ color: theme.accent, fontWeight: "800" }}>Switch to Artisan Studio</Text>
                </Text>
              </Pressable>
            </View>
          ) : (
            /* ─── ARTISAN STUDIO VIEW ─── */
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Artisan Email or Phone</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={18} color={theme.muted} style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="artisan@domain.in or phone"
                    placeholderTextColor="#A89F95"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.muted} style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter your password"
                    placeholderTextColor="#A89F95"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={19}
                      color={theme.muted}
                    />
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={[styles.submitBtn, busy && { opacity: 0.7 }]}
                onPress={handleSellerAuth}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Enter Artisan Studio</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setActiveRole("buyer");
                  setErrorMessage("");
                }}
                style={styles.switchLink}
              >
                <Text style={styles.switchLinkText}>
                  Shopping as a customer? <Text style={{ color: theme.accent, fontWeight: "800" }}>Switch to Customer Login</Text>
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>



    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 6 : 14,
    paddingBottom: 40
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.border
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  logo: {
    width: 26,
    height: 26,
    marginRight: 8
  },
  brandName: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    color: theme.accent
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#EDE5D8",
    padding: 4,
    borderRadius: 16,
    marginBottom: 20
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 13
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.muted
  },
  tabTextActive: {
    color: theme.ink
  },
  headerCard: {
    marginBottom: 20
  },
  headerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FCEEE3",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.accent,
    letterSpacing: 1
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 6
  },
  headerSub: {
    fontSize: 13,
    color: theme.muted,
    lineHeight: 19
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFCDD2"
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#D32F2F",
    fontWeight: "600"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  googleBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: "#E0D6C8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2A1E17"
  },
  googleHelper: {
    textAlign: "center",
    fontSize: 11,
    color: theme.muted,
    marginTop: 8,
    marginBottom: 16
  },
  otpBox: {
    flexDirection: "row",
    backgroundColor: "#FAF6F0",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EAE2D5",
    marginBottom: 16
  },
  otpIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FCEEE3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10
  },
  otpHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  otpTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.ink
  },
  comingSoonTag: {
    backgroundColor: "#FCEEE3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.accent
  },
  otpDesc: {
    fontSize: 11,
    color: theme.muted,
    lineHeight: 16
  },
  guestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accent,
    borderRadius: 16,
    paddingVertical: 15,
    marginBottom: 18
  },
  guestBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800"
  },
  perksBox: {
    backgroundColor: "#FAF6F0",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EAE2D5",
    marginBottom: 16
  },
  perksTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: theme.muted,
    marginBottom: 8
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6
  },
  perkText: {
    fontSize: 11,
    color: theme.ink,
    flex: 1
  },
  switchLink: {
    alignItems: "center",
    paddingVertical: 8
  },
  switchLinkText: {
    fontSize: 12,
    color: theme.muted
  },
  inputGroup: {
    marginBottom: 14
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.ink,
    marginBottom: 6
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF6F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.border
  },
  inputField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.ink
  },
  submitBtn: {
    backgroundColor: theme.accent,
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 14
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800"
  }
});
