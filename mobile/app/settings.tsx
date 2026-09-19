import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  TextInput,
  StatusBar,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { theme } from "../src/theme";
import { getSession, clearSession } from "../src/storage";
import { AppLanguage, useI18n } from "../src/i18n";

const SETTINGS_ADDR_KEY = "artisan_saved_delivery_address";
const SETTINGS_NOTIFS_KEY = "artisan_notifications_settings";

export default function SettingsScreen() {
  const { language, setLanguage, t } = useI18n();
  const [session, setSession] = useState<{
    token: string | null;
    domain: "STUDIO" | "MARKETPLACE" | null;
    user: any;
  }>({ token: null, domain: null, user: null });

  const [savedAddress, setSavedAddress] = useState<string>("");
  const [editingAddress, setEditingAddress] = useState<boolean>(false);
  const [tempAddress, setTempAddress] = useState<string>("");

  const [orderNotifs, setOrderNotifs] = useState<boolean>(true);
  const [promoNotifs, setPromoNotifs] = useState<boolean>(true);
  const [aiTipsNotifs, setAiTipsNotifs] = useState<boolean>(true);

  const [cacheClearedToast, setCacheClearedToast] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    try {
      const sess = await getSession();
      setSession(sess);

      const addr = await AsyncStorage.getItem(SETTINGS_ADDR_KEY);
      if (addr) {
        setSavedAddress(addr);
        setTempAddress(addr);
      }

      const notifs = await AsyncStorage.getItem(SETTINGS_NOTIFS_KEY);
      if (notifs) {
        const parsed = JSON.parse(notifs);
        setOrderNotifs(parsed.order ?? true);
        setPromoNotifs(parsed.promo ?? true);
        setAiTipsNotifs(parsed.aiTips ?? true);
      }
    } catch (e) {
      console.warn("Failed to load settings:", e);
    }
  };

  const handleSelectLanguage = async (lang: AppLanguage) => {
    await setLanguage(lang);
  };

  const handleSaveAddress = async () => {
    setSavedAddress(tempAddress);
    await AsyncStorage.setItem(SETTINGS_ADDR_KEY, tempAddress);
    setEditingAddress(false);
    Alert.alert("Saved", "Your default delivery address has been updated.");
  };

  const toggleNotif = async (key: "order" | "promo" | "aiTips", val: boolean) => {
    let nextOrder = orderNotifs;
    let nextPromo = promoNotifs;
    let nextAi = aiTipsNotifs;

    if (key === "order") {
      setOrderNotifs(val);
      nextOrder = val;
    } else if (key === "promo") {
      setPromoNotifs(val);
      nextPromo = val;
    } else if (key === "aiTips") {
      setAiTipsNotifs(val);
      nextAi = val;
    }

    await AsyncStorage.setItem(
      SETTINGS_NOTIFS_KEY,
      JSON.stringify({ order: nextOrder, promo: nextPromo, aiTips: nextAi })
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      "Clear Local Cache?",
      "This will refresh product listings and clear temporary app data. Your login session will remain active.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Now",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("artisan_cached_marketplace_products");
              setCacheClearedToast(true);
              setTimeout(() => setCacheClearedToast(false), 3000);
            } catch (e) {
              Alert.alert("Error", "Could not clear cache");
            }
          }
        }
      ]
    );
  };

  const isLoggedIn = Boolean(
    session.token &&
    session.token !== "guest_buyer_token" &&
    session.user
  );
  const user = session.user;
  const isSeller = session.domain === "STUDIO";
  const userInitials = isLoggedIn
    ? (user?.full_name || user?.name || (isSeller ? "Artisan" : "Buyer"))
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out from Artisan AI?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await clearSession();
          setSession({ token: null, domain: null, user: null });
          Alert.alert("Signed Out", "You have been signed out successfully.");
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF6F0" />
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/buyer");
          }}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.pageTitle}>Settings & Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      {cacheClearedToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>✓ Local cache cleared successfully</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, !isLoggedIn && { backgroundColor: "#8C7E72" }]}>
            <Text style={styles.avatarText}>{isLoggedIn ? userInitials : "👤"}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {isLoggedIn
                ? (user?.full_name || user?.name || (isSeller ? "Artisan Maker" : "Customer"))
                : "Not Logged In"}
            </Text>
            <Text style={styles.profileEmail}>
              {isLoggedIn
                ? (user?.email || "Active Session")
                : "Guest Visitor"}
            </Text>
            <View style={[
              styles.roleBadge,
              !isLoggedIn
                ? styles.guestBadge
                : isSeller
                ? styles.sellerBadge
                : styles.buyerBadge
            ]}>
              <Text style={[
                styles.roleBadgeText,
                !isLoggedIn
                  ? styles.guestBadgeText
                  : isSeller
                  ? styles.sellerBadgeText
                  : styles.buyerBadgeText
              ]}>
                {!isLoggedIn
                  ? "🔒 Guest Mode"
                  : isSeller
                  ? "🎨 Artisan Studio (Seller)"
                  : "🛍️ Heritage Marketplace (Buyer)"}
              </Text>
            </View>
          </View>
        </View>

        {!isLoggedIn && (
          <Pressable
            style={styles.signInCardBtn}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.signInCardBtnText}>✨ Sign In to Artisan AI</Text>
            <Text style={styles.signInCardBtnSub}>Access orders, saved wishlist & direct artisan enquiries</Text>
          </Pressable>
        )}

        {/* Quick Nav Switcher */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>WORKSPACE / NAVIGATION</Text>
          <View style={styles.cardBox}>
            {isSeller ? (
              <Pressable
                style={styles.menuRow}
                onPress={() => router.push("/buyer")}
              >
                <View style={styles.menuIconBox}>
                  <Text style={styles.menuEmoji}>🛍️</Text>
                </View>
                <View style={styles.menuTextBox}>
                  <Text style={styles.menuTitle}>Switch to Marketplace</Text>
                  <Text style={styles.menuDesc}>Browse artisan collections as a buyer</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={styles.menuRow}
                  onPress={() => router.push("/buyer-orders")}
                >
                  <View style={styles.menuIconBox}>
                    <Text style={styles.menuEmoji}>📦</Text>
                  </View>
                  <View style={styles.menuTextBox}>
                    <Text style={styles.menuTitle}>My Orders & Tracking</Text>
                    <Text style={styles.menuDesc}>View live ONDC dispatch status</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>

                <View style={styles.divider} />

                <Pressable
                  style={styles.menuRow}
                  onPress={() => router.push("/buyer-cart")}
                >
                  <View style={styles.menuIconBox}>
                    <Text style={styles.menuEmoji}>🛒</Text>
                  </View>
                  <View style={styles.menuTextBox}>
                    <Text style={styles.menuTitle}>Shopping Bag</Text>
                    <Text style={styles.menuDesc}>Review cart and checkout items</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>

                <View style={styles.divider} />

                <Pressable
                  style={styles.menuRow}
                  onPress={() => router.push("/buyer-assistant")}
                >
                  <View style={styles.menuIconBox}>
                    <Text style={styles.menuEmoji}>✨</Text>
                  </View>
                  <View style={styles.menuTextBox}>
                    <Text style={styles.menuTitle}>Gemini Craft Assistant</Text>
                    <Text style={styles.menuDesc}>AI Heritage & art recommendation chat</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Preferences: Language */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t("preferences").toUpperCase()}</Text>
          <View style={styles.cardBox}>
            <Text style={styles.settingLabel}>{t("appLanguage")}</Text>
            <Text style={styles.settingSub}>{t("selectInterfaceLanguage")}</Text>
            <View style={styles.langGrid}>
              {[
                { label: t("english"), code: "en" as AppLanguage },
                { label: t("telugu"), code: "te" as AppLanguage },
                { label: t("hindi"), code: "hi" as AppLanguage }
              ].map(item => {
                const active = language === item.code;
                return (
                  <Pressable
                    key={item.code}
                    onPress={() => handleSelectLanguage(item.code)}
                    style={[styles.langChip, active && styles.langChipActive]}
                  >
                    <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Saved Delivery Address */}
            <View style={styles.addressHeader}>
              <View>
                <Text style={styles.settingLabel}>{t("savedDeliveryAddress")}</Text>
                <Text style={styles.settingSub}>{t("usedForCheckout")}</Text>
              </View>
              <Pressable
                onPress={() => setEditingAddress(!editingAddress)}
                style={styles.editBtn}
              >
                <Text style={styles.editBtnText}>{editingAddress ? t("cancel") : t("edit")}</Text>
              </Pressable>
            </View>

            {editingAddress ? (
              <View style={styles.editAddressBox}>
                <TextInput
                  style={styles.addressInput}
                  value={tempAddress}
                  onChangeText={setTempAddress}
                  placeholder="Enter house no, street, landmark, city, pincode"
                  multiline
                />
                <Pressable onPress={handleSaveAddress} style={styles.saveAddressBtn}>
                  <Text style={styles.saveAddressBtnText}>{t("saveAddress")}</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.addressDisplay}>
                {savedAddress || "No default address saved yet. Tap 'Edit' to add one."}
              </Text>
            )}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
          <View style={styles.cardBox}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={styles.settingLabel}>Order Status Alerts</Text>
                <Text style={styles.settingSub}>Instant updates when artisans ship your craft</Text>
              </View>
              <Switch
                value={orderNotifs}
                onValueChange={v => toggleNotif("order", v)}
                trackColor={{ false: "#E2D9CC", true: theme.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={styles.settingLabel}>Heritage Craft Specials</Text>
                <Text style={styles.settingSub}>Exclusive GI-tagged product drops</Text>
              </View>
              <Switch
                value={promoNotifs}
                onValueChange={v => toggleNotif("promo", v)}
                trackColor={{ false: "#E2D9CC", true: theme.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={styles.settingLabel}>AI Assistant Advice</Text>
                <Text style={styles.settingSub}>Proactive pricing insights & craft care guides</Text>
              </View>
              <Switch
                value={aiTipsNotifs}
                onValueChange={v => toggleNotif("aiTips", v)}
                trackColor={{ false: "#E2D9CC", true: theme.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* System & Cache */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SYSTEM & DATA</Text>
          <View style={styles.cardBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Cloud Backend</Text>
              <View style={styles.badgeRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.infoValue}>CloudFront Live</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>AI Model</Text>
              <Text style={styles.infoValue}>Google Gemini 2.5 Flash</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Version</Text>
              <Text style={styles.infoValue}>v1.0.0 (Production)</Text>
            </View>

            <View style={styles.divider} />

            <Pressable style={styles.cacheBtn} onPress={handleClearCache}>
              <Text style={styles.cacheBtnText}>🧹 Clear Local Cache</Text>
            </Pressable>
          </View>
        </View>

        {/* Sign Out / Sign In Action */}
        {isLoggedIn ? (
          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out from Artisan AI</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.signInBottomBtn} onPress={() => router.push("/login")}>
            <Text style={styles.signInBottomText}>Sign In / Create Account</Text>
          </Pressable>
        )}

        <Text style={styles.footerNote}>
          Artisan AI · Empowering Indian Heritage Artisans with GenAI & ONDC
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAF6F0"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 10 : 14,
    paddingBottom: 14,
    backgroundColor: "#FAF6F0",
    borderBottomWidth: 1,
    borderBottomColor: "#EAE2D5"
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  backText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.accent
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.ink
  },
  toast: {
    backgroundColor: "#2E7D32",
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center"
  },
  toastText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAE2D5",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#B85D19",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff"
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 2
  },
  profileEmail: {
    fontSize: 13,
    color: theme.muted,
    marginBottom: 8
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  sellerBadge: {
    backgroundColor: "#FCEEE3"
  },
  buyerBadge: {
    backgroundColor: "#E8F5E9"
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "800"
  },
  sellerBadgeText: {
    color: "#B85D19"
  },
  buyerBadgeText: {
    color: "#2E7D32"
  },
  section: {
    marginBottom: 20
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.muted,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4
  },
  cardBox: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EAE2D5",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FAF6F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14
  },
  menuEmoji: {
    fontSize: 20
  },
  menuTextBox: {
    flex: 1
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.ink
  },
  menuDesc: {
    fontSize: 12,
    color: theme.muted,
    marginTop: 2
  },
  chevron: {
    fontSize: 20,
    color: "#BDBDBD",
    fontWeight: "700",
    marginLeft: 8
  },
  divider: {
    height: 1,
    backgroundColor: "#F2ECE1",
    marginVertical: 12
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.ink
  },
  settingSub: {
    fontSize: 12,
    color: theme.muted,
    marginTop: 2,
    marginBottom: 8
  },
  langGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#FAF6F0",
    borderWidth: 1,
    borderColor: "#EAE2D5"
  },
  langChipActive: {
    backgroundColor: "#B85D19",
    borderColor: "#B85D19"
  },
  langChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.ink
  },
  langChipTextActive: {
    color: "#fff"
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#FAF6F0",
    borderWidth: 1,
    borderColor: "#EAE2D5"
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.accent
  },
  addressDisplay: {
    fontSize: 13,
    color: theme.ink,
    lineHeight: 18,
    marginTop: 6,
    fontStyle: "italic"
  },
  editAddressBox: {
    marginTop: 8
  },
  addressInput: {
    backgroundColor: "#FAF6F0",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EAE2D5",
    padding: 10,
    fontSize: 13,
    color: theme.ink,
    minHeight: 60,
    textAlignVertical: "top"
  },
  saveAddressBtn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 8
  },
  saveAddressBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  switchTextCol: {
    flex: 1,
    paddingRight: 10
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4
  },
  infoLabel: {
    fontSize: 14,
    color: theme.muted,
    fontWeight: "600"
  },
  infoValue: {
    fontSize: 14,
    color: theme.ink,
    fontWeight: "700"
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E7D32",
    marginRight: 6
  },
  cacheBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FAF6F0",
    borderWidth: 1,
    borderColor: "#EAE2D5",
    alignItems: "center",
    marginTop: 4
  },
  cacheBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.accent
  },
  signOutBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#DC2626"
  },
  guestBadge: {
    backgroundColor: "#F0EBE1",
    borderColor: "#DCD2C6"
  },
  guestBadgeText: {
    color: "#6B5B51",
    fontWeight: "700"
  },
  signInCardBtn: {
    backgroundColor: "#FAF6F0",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: theme.accent,
    marginBottom: 20,
    alignItems: "center"
  },
  signInCardBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.accent
  },
  signInCardBtnSub: {
    fontSize: 12,
    color: "#796A5F",
    marginTop: 4,
    textAlign: "center"
  },
  signInBottomBtn: {
    backgroundColor: theme.accent,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
  signInBottomText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  footerNote: {
    textAlign: "center",
    fontSize: 11,
    color: theme.muted,
    marginTop: 20,
    lineHeight: 16
  }
});
