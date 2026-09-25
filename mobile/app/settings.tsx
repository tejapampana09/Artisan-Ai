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
  Platform,
  Modal,
  ActivityIndicator,
  Image
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { theme } from "../src/theme";
import { getSession, clearSession, getUserProfilePhoto, setUserProfilePhoto } from "../src/storage";
import { AppLanguage, useI18n } from "../src/i18n";
import { AppUpdateModal } from "../src/components";
import {
  checkForAppUpdate,
  AppUpdateInfo,
  CURRENT_APP_VERSION
} from "../src/services/appUpdater";

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
  const [detectingGps, setDetectingGps] = useState<boolean>(false);

  const [orderNotifs, setOrderNotifs] = useState<boolean>(true);
  const [promoNotifs, setPromoNotifs] = useState<boolean>(true);
  const [aiTipsNotifs, setAiTipsNotifs] = useState<boolean>(true);

  const [showSignOutModal, setShowSignOutModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showCouponsModal, setShowCouponsModal] = useState<boolean>(false);

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);

  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [manualUpdateInfo, setManualUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [showManualUpdateModal, setShowManualUpdateModal] = useState<boolean>(false);

  const handlePickFromGallery = async () => {
    setShowPhotoModal(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow gallery access to select your profile picture.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        setProfilePhoto(uri);
        await setUserProfilePhoto(uri);
      }
    } catch (e) {
      console.warn("Gallery pick error:", e);
    }
  };

  const handleTakePhoto = async () => {
    setShowPhotoModal(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow camera access to take a profile picture.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        setProfilePhoto(uri);
        await setUserProfilePhoto(uri);
      }
    } catch (e) {
      console.warn("Camera capture error:", e);
    }
  };

  const handleRemovePhoto = async () => {
    setShowPhotoModal(false);
    setProfilePhoto(null);
    await setUserProfilePhoto(null);
  };

  const handleManualCheckUpdate = async () => {
    setCheckingUpdate(true);
    const res = await checkForAppUpdate(false);
    setCheckingUpdate(false);
    if (res.hasUpdate && res.updateInfo) {
      setManualUpdateInfo(res.updateInfo);
      setShowManualUpdateModal(true);
    } else {
      Alert.alert(
        language === "te" ? "తాజా వెర్షన్!" : language === "hi" ? "नवीनतम संस्करण!" : "Up to Date!",
        language === "te"
          ? "మీరు Artisan AI తాజా వెర్షన్‌ను ఉపయోగిస్తున్నారు."
          : language === "hi"
          ? "आप Artisan AI का नवीनतम संस्करण उपयोग कर रहे हैं।"
          : "You are already using the latest version of Artisan AI."
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    try {
      const sess = await getSession();
      setSession(sess);

      const savedPhoto = await getUserProfilePhoto();
      if (savedPhoto) {
        setProfilePhoto(savedPhoto);
      } else if (sess?.user?.avatar_url) {
        setProfilePhoto(sess.user.avatar_url);
      }

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
    if (!tempAddress.trim()) {
      Alert.alert("Address Empty", "Please enter a valid delivery address.");
      return;
    }
    setSavedAddress(tempAddress.trim());
    await AsyncStorage.setItem(SETTINGS_ADDR_KEY, tempAddress.trim());
    setEditingAddress(false);
    Alert.alert("Saved", "Your delivery address has been updated.");
  };

  const handleDetectSettingsGps = async () => {
    setDetectingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat: number | null = null;
      let lng: number | null = null;

      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      if (lat === null || lng === null) {
        Alert.alert("Permission Required", "Please allow location access to auto-fill address.");
        setDetectingGps(false);
        return;
      }

      let detStreet = "";
      let detDistrict = "";
      let detCity = "";
      let detState = "";
      let detPincode = "";

      try {
        const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (rev && rev.length > 0) {
          const item = rev[0];
          detStreet = [item.name, item.street].filter(Boolean).join(", ");
          detDistrict = item.district || item.subregion || "";
          detCity = item.city || "";
          detState = item.region || "";
          detPincode = item.postalCode || "";
        }
      } catch (_) {}

      if (!detPincode || (!detDistrict && !detCity)) {
        try {
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en", "User-Agent": "ArtisanAI-Mobile/1.0" } }
          );
          if (osmRes.ok) {
            const data = await osmRes.json();
            const addr = data.address || {};
            if (!detStreet) detStreet = [addr.road || addr.pedestrian || addr.suburb, addr.neighbourhood].filter(Boolean).join(", ");
            if (!detCity) detCity = addr.city || addr.town || addr.village || "";
            if (!detDistrict) detDistrict = addr.state_district || addr.county || detCity || "";
            if (!detState) detState = addr.state || "";
            if (!detPincode) detPincode = addr.postcode || "";
          }
        } catch (_) {}
      }

      const cleanPin = detPincode ? detPincode.replace(/\D/g, "").slice(0, 6) : "";
      const cityDistrict = detCity && detDistrict && detCity !== detDistrict ? `${detCity}, ${detDistrict}` : (detCity || detDistrict);
      const fullAddress = [detStreet, cityDistrict, detState, cleanPin].filter(Boolean).join(", ");

      if (fullAddress) {
        setTempAddress(fullAddress);
      }
      setDetectingGps(false);
    } catch (_) {
      setDetectingGps(false);
    }
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Myntra-style Top App Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/buyer");
          }}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color="#282C3F" />
        </Pressable>
        <Text style={styles.topBarTitle}>
          {language === "te" ? "ప్రొఫైల్ & ఖాతా" : "Profile"}
        </Text>
        <Pressable
          onPress={() => router.push("/buyer-cart")}
          style={styles.cartIconBtn}
          hitSlop={10}
        >
          <Ionicons name="bag-outline" size={22} color="#282C3F" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* 1. Myntra Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.profileTopRow}>
            <Pressable
              style={styles.avatarWrapper}
              onPress={() => setShowPhotoModal(true)}
              hitSlop={8}
              accessibilityLabel="Change profile picture"
            >
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
              ) : (
                <View style={styles.defaultAvatarContainer}>
                  <Ionicons name="person" size={32} color="#8C7A6B" />
                </View>
              )}
              <View style={styles.avatarCameraBadge}>
                <Ionicons name="camera" size={13} color="#FFFFFF" />
              </View>
            </Pressable>
            <View style={styles.profileDetailsCol}>
              <Text style={styles.profileUserName} numberOfLines={1}>
                {isLoggedIn
                  ? user?.full_name || user?.name || (isSeller ? "Master Artisan" : "Verified Customer")
                  : "Welcome to Artisan AI"}
              </Text>
              <Text style={styles.profileUserContact} numberOfLines={1}>
                {isLoggedIn
                  ? user?.email || user?.phone || "Active Member"
                  : "Sign in for the best handcrafted shopping"}
              </Text>

              {isLoggedIn ? (
                <View style={styles.badgeRow}>
                  <View style={[styles.rolePill, isSeller ? styles.rolePillSeller : styles.rolePillBuyer]}>
                    <Text style={[styles.rolePillText, isSeller ? styles.rolePillTextSeller : styles.rolePillTextBuyer]}>
                      {isSeller ? "Verified Artisan Studio" : "Verified Buyer"}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {/* Not logged in CTA */}
          {!isLoggedIn && (
            <Pressable
              style={styles.loginBannerBtn}
              onPress={() => router.push("/login")}
            >
              <Text style={styles.loginBannerBtnText}>LOG IN / SIGN UP</Text>
            </Pressable>
          )}
        </View>

        {/* 2. Myntra Top 4 Quick Actions Grid */}
        <View style={styles.quickGridCard}>
          <Pressable
            style={styles.quickGridItem}
            onPress={() => {
              if (isSeller) router.push("/seller-orders");
              else router.push("/buyer-orders");
            }}
          >
            <View style={[styles.quickGridIconCircle, { backgroundColor: "#FFF1F2" }]}>
              <Ionicons name="cube-outline" size={22} color="#E11D48" />
            </View>
            <Text style={styles.quickGridLabel}>Orders</Text>
          </Pressable>

          <Pressable
            style={styles.quickGridItem}
            onPress={() => router.push("/buyer")}
          >
            <View style={[styles.quickGridIconCircle, { backgroundColor: "#FFF7ED" }]}>
              <Ionicons name="heart-outline" size={22} color="#EA580C" />
            </View>
            <Text style={styles.quickGridLabel}>Wishlist</Text>
          </Pressable>

          <Pressable
            style={styles.quickGridItem}
            onPress={() => setShowCouponsModal(true)}
          >
            <View style={[styles.quickGridIconCircle, { backgroundColor: "#FEFCE8" }]}>
              <Ionicons name="pricetag-outline" size={22} color="#CA8A04" />
            </View>
            <Text style={styles.quickGridLabel}>Coupons</Text>
          </Pressable>

          <Pressable
            style={styles.quickGridItem}
            onPress={() => setShowHelpModal(true)}
          >
            <View style={[styles.quickGridIconCircle, { backgroundColor: "#F0FDF4" }]}>
              <Ionicons name="headset-outline" size={22} color="#16A34A" />
            </View>
            <Text style={styles.quickGridLabel}>Help Center</Text>
          </Pressable>
        </View>

        {/* 3. Artisan Studio Section (If Seller) */}
        {isSeller && (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>ARTISAN STUDIO TOOLS</Text>
            <View style={styles.groupCard}>
              <Pressable
                style={styles.menuItem}
                onPress={() => router.push("/seller-products")}
              >
                <View style={[styles.menuItemIconCircle, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="grid-outline" size={18} color="#D97706" />
                </View>
                <View style={styles.menuItemTextCol}>
                  <Text style={styles.menuItemTitle}>Craft Catalog & Stock</Text>
                  <Text style={styles.menuItemDesc}>Add crafts, manage prices, and stock inventory</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </Pressable>

              <View style={styles.menuSeparator} />

              <Pressable
                style={styles.menuItem}
                onPress={() => router.push("/seller-orders")}
              >
                <View style={[styles.menuItemIconCircle, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="bicycle-outline" size={18} color="#7C3AED" />
                </View>
                <View style={styles.menuItemTextCol}>
                  <Text style={styles.menuItemTitle}>Customer Orders & Dispatch</Text>
                  <Text style={styles.menuItemDesc}>View packing list and update ONDC dispatch</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </Pressable>

              <View style={styles.menuSeparator} />

              <Pressable
                style={styles.menuItem}
                onPress={() => router.push("/seller-business")}
              >
                <View style={[styles.menuItemIconCircle, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons name="trending-up-outline" size={18} color="#15803D" />
                </View>
                <View style={styles.menuItemTextCol}>
                  <Text style={styles.menuItemTitle}>Artisan Market Intelligence</Text>
                  <Text style={styles.menuItemDesc}>Customer demand, pricing advice & trend forecast</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </Pressable>
            </View>
          </View>
        )}

        {/* 4. Account Settings */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>ACCOUNT SETTINGS</Text>
          <View style={styles.groupCard}>

            {/* Saved Delivery Address */}
            <Pressable
              style={styles.menuItem}
              onPress={() => setEditingAddress(!editingAddress)}
            >
              <View style={[styles.menuItemIconCircle, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="location-outline" size={18} color="#2563EB" />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>{t("savedDeliveryAddress")}</Text>
                <Text style={styles.menuItemDesc} numberOfLines={1}>
                  {savedAddress ? savedAddress : "Add your home or studio delivery address"}
                </Text>
              </View>
              <Text style={styles.editLinkText}>{editingAddress ? "Cancel" : (savedAddress ? "Edit" : "Add")}</Text>
            </Pressable>

            {/* Inline Address Edit Form */}
            {editingAddress && (
              <View style={styles.inlineAddressBox}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#4B5563" }}>Delivery Location</Text>
                  <Pressable
                    onPress={handleDetectSettingsGps}
                    disabled={detectingGps}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#EFF6FF",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: "#BFDBFE"
                    }}
                  >
                    {detectingGps ? (
                      <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 4 }} />
                    ) : (
                      <Ionicons name="locate" size={13} color="#2563EB" style={{ marginRight: 4 }} />
                    )}
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#2563EB" }}>
                      {detectingGps ? "Detecting GPS..." : "Auto-Fill GPS"}
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.addressTextInput}
                  value={tempAddress}
                  onChangeText={setTempAddress}
                  placeholder="Flat / House No, Street, Landmark, City, PIN code"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
                <Pressable onPress={handleSaveAddress} style={styles.saveAddressButton}>
                  <Text style={styles.saveAddressButtonText}>SAVE ADDRESS</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.menuSeparator} />

            {/* Language Selector */}
            <View style={styles.menuItemNoNav}>
              <View style={[styles.menuItemIconCircle, { backgroundColor: "#FDF2F8" }]}>
                <Ionicons name="language-outline" size={18} color="#DB2777" />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>{t("appLanguage")}</Text>
                <Text style={styles.menuItemDesc}>{t("selectInterfaceLanguage")}</Text>
                <View style={styles.langPillsRow}>
                  {[
                    { label: "English", code: "en" as AppLanguage },
                    { label: "తెలుగు", code: "te" as AppLanguage },
                    { label: "हिन्दी", code: "hi" as AppLanguage },
                    { label: "தமிழ்", code: "ta" as AppLanguage },
                    { label: "বাংলা", code: "bn" as AppLanguage }
                  ].map((item) => {
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
              </View>
            </View>

            <View style={styles.menuSeparator} />

            {/* Heritage Craft Map of India */}
            <Pressable
              style={styles.menuItem}
              onPress={() => router.push("/craft-map" as any)}
            >
              <View style={[styles.menuItemIconCircle, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="map-outline" size={18} color="#D97706" />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>Heritage Craft Map of India</Text>
                <Text style={styles.menuItemDesc}>Explore GI craft clusters, artisan studio pins & directions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </Pressable>

            <View style={styles.menuSeparator} />

            {/* Direct AI Craft Assistant */}
            <Pressable
              style={styles.menuItem}
              onPress={() => router.push("/buyer-assistant")}
            >
              <View style={[styles.menuItemIconCircle, { backgroundColor: "#F3E8FF" }]}>
                <Ionicons name="sparkles" size={18} color="#9333EA" />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>Gemini AI Craft Assistant</Text>
                <Text style={styles.menuItemDesc}>Voice & text heritage art recommendation</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </Pressable>
          </View>
        </View>

        {/* 5. Notifications & Alerts */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>ALERTS & NOTIFICATIONS</Text>
          <View style={styles.groupCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchTitle}>Order Status Alerts</Text>
                <Text style={styles.switchDesc}>Get updates when artisan packs & ships craft</Text>
              </View>
              <Switch
                value={orderNotifs}
                onValueChange={(v) => toggleNotif("order", v)}
                trackColor={{ false: "#E5E7EB", true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.menuSeparator} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchTitle}>Heritage Craft Specials</Text>
                <Text style={styles.switchDesc}>New handcrafted artisan craft arrivals and discounts</Text>
              </View>
              <Switch
                value={promoNotifs}
                onValueChange={(v) => toggleNotif("promo", v)}
                trackColor={{ false: "#E5E7EB", true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.menuSeparator} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchTitle}>AI Heritage Advice</Text>
                <Text style={styles.switchDesc}>Care guides & historical stories for your collection</Text>
              </View>
              <Switch
                value={aiTipsNotifs}
                onValueChange={(v) => toggleNotif("aiTips", v)}
                trackColor={{ false: "#E5E7EB", true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* 6. Legal & Support */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>HELP & LEGAL</Text>
          <View style={styles.groupCard}>
            <Pressable style={styles.menuItem} onPress={() => setShowHelpModal(true)}>
              <View style={[styles.menuItemIconCircle, { backgroundColor: "#F1F5F9" }]}>
                <Ionicons name="help-circle-outline" size={18} color="#475569" />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>FAQs & Customer Care</Text>
                <Text style={styles.menuItemDesc}>Frequently asked questions & 24x7 support</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </Pressable>

            <View style={styles.menuSeparator} />

            <Pressable
              style={styles.menuItem}
              onPress={() =>
                Alert.alert(
                  "Terms of Use",
                  "Artisan AI connects verified Indian craftspeople directly with buyers through fair-trade principles and ONDC standards."
                )
              }
            >
              <View style={[styles.menuItemIconCircle, { backgroundColor: "#F1F5F9" }]}>
                <Ionicons name="document-text-outline" size={18} color="#475569" />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>Terms of Use</Text>
                <Text style={styles.menuItemDesc}>Fair trade, buyer protection & artisan policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </Pressable>

            <View style={styles.menuSeparator} />

            <Pressable
              style={styles.menuItem}
              onPress={() =>
                Alert.alert(
                  "Privacy Policy",
                  "We prioritize your privacy. Your personal information and addresses are encrypted and never shared with third parties without consent."
                )
              }
            >
              <View style={[styles.menuItemIconCircle, { backgroundColor: "#F1F5F9" }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#475569" />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>Privacy Policy</Text>
                <Text style={styles.menuItemDesc}>Data security & privacy compliance</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </Pressable>
          </View>
        </View>

        {/* 7. Myntra-style Bottom Action: LOG OUT or LOG IN */}
        {isLoggedIn ? (
          <Pressable style={styles.myntraLogoutBtn} onPress={() => setShowSignOutModal(true)}>
            <Text style={styles.myntraLogoutBtnText}>LOG OUT</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.myntraLoginBtn} onPress={() => router.push("/login")}>
            <Text style={styles.myntraLoginBtnText}>LOG IN / SIGN UP</Text>
          </Pressable>
        )}

        {/* Brand App Version Footer */}
        <View style={styles.footerWrap}>
          <Pressable
            style={styles.checkUpdateBtn}
            onPress={handleManualCheckUpdate}
            disabled={checkingUpdate}
          >
            {checkingUpdate ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="sparkles" size={14} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={styles.checkUpdateBtnText}>
                  {language === "te"
                    ? "అప్‌డేట్‌లు పరిశీలించండి"
                    : language === "hi"
                    ? "अपडेट जांचें"
                    : "Check for App Updates"}
                </Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.footerVersion}>App Version {CURRENT_APP_VERSION} (Build 1)</Text>
          <Text style={styles.footerTagline}>
            Made with ❤️ for Indian Heritage Artisans • ONDC Network
          </Text>
        </View>
      </ScrollView>

      {/* Modern Signout Confirmation Modal */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSignOutModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.signOutBadge}>
              <Ionicons name="log-out-outline" size={26} color="#DC2626" />
            </View>
            <Text style={styles.sheetTitle}>Sign Out from Artisan AI?</Text>
            <Text style={styles.sheetSub}>
              Are you sure you want to sign out? You will need to log in again to manage your orders, bag, and artisan enquiries.
            </Text>

            {isLoggedIn && (
              <View style={styles.accountChip}>
                <View style={styles.accountChipAvatar}>
                  <Text style={styles.accountChipAvatarText}>{userInitials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountChipName} numberOfLines={1}>
                    {user?.full_name || user?.name || "Artisan Member"}
                  </Text>
                  <Text style={styles.accountChipEmail} numberOfLines={1}>
                    {user?.email || "Logged in"}
                  </Text>
                </View>
                <View style={styles.accountChipRole}>
                  <Text style={styles.accountChipRoleText}>
                    {isSeller ? "Artisan" : "Buyer"}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.sheetActions}>
              <Pressable
                style={styles.cancelModalBtn}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmSignOutBtn}
                onPress={async () => {
                  setShowSignOutModal(false);
                  await clearSession();
                  setSession({ token: null, domain: null, user: null });
                  router.replace("/buyer");
                }}
              >
                <Text style={styles.confirmSignOutText}>Log Out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Coupons Modal */}
      <Modal
        visible={showCouponsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCouponsModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCouponsModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Artisan Heritage Offers</Text>
            <Text style={styles.sheetSub}>Enjoy exclusive promotions on authentic handcrafted crafts.</Text>

            <View style={styles.couponCard}>
              <View style={styles.couponBadge}>
                <Text style={styles.couponBadgeText}>FLAT 15% OFF</Text>
              </View>
              <Text style={styles.couponCode}>HERITAGE15</Text>
              <Text style={styles.couponDesc}>Valid on Kalamkari paintings and Kondapalli wooden toys above ₹1,000</Text>
            </View>

            <View style={styles.couponCard}>
              <View style={[styles.couponBadge, { backgroundColor: "#15803D" }]}>
                <Text style={styles.couponBadgeText}>FREE SHIPPING</Text>
              </View>
              <Text style={styles.couponCode}>ONDCFREESHIP</Text>
              <Text style={styles.couponDesc}>Zero delivery fee on all direct-artisan dispatched orders nationwide</Text>
            </View>

            <Pressable style={styles.closeModalBtn} onPress={() => setShowCouponsModal(false)}>
              <Text style={styles.closeModalBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Help Center Modal */}
      <Modal
        visible={showHelpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowHelpModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>24x7 Customer & Artisan Support</Text>
            <Text style={styles.sheetSub}>We are here to help you with orders, returns, and artisan connections.</Text>

            <View style={styles.helpRow}>
              <Ionicons name="mail-outline" size={20} color={theme.accent} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.helpRowTitle}>Email Support</Text>
                <Text style={styles.helpRowSub}>support@artisanai.in</Text>
              </View>
            </View>

            <View style={styles.helpRow}>
              <Ionicons name="call-outline" size={20} color={theme.accent} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.helpRowTitle}>Toll-Free Helpline</Text>
                <Text style={styles.helpRowSub}>1800-ARTISAN (9 AM - 8 PM IST)</Text>
              </View>
            </View>

            <View style={styles.helpRow}>
              <Ionicons name="chatbubbles-outline" size={20} color={theme.accent} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.helpRowTitle}>Direct Artisan Enquiry</Text>
                <Text style={styles.helpRowSub}>Contact artisan directly on any product page</Text>
              </View>
            </View>

            <Pressable style={styles.closeModalBtn} onPress={() => setShowHelpModal(false)}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Profile Photo Picker Bottom Sheet Modal */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowPhotoModal(false)}
        >
          <Pressable style={styles.photoSheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.photoSheetHandle} />
            <Text style={styles.photoSheetTitle}>Profile Photo</Text>
            <Text style={styles.photoSheetSubtitle}>Personalize your Artisan AI profile picture</Text>

            <Pressable style={styles.photoOptionBtn} onPress={handleTakePhoto}>
              <View style={[styles.photoOptionIconCircle, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="camera" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoOptionTitle}>Take Photo</Text>
                <Text style={styles.photoOptionDesc}>Capture a new photo with camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A8A29E" />
            </Pressable>

            <Pressable style={styles.photoOptionBtn} onPress={handlePickFromGallery}>
              <View style={[styles.photoOptionIconCircle, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="images" size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.photoOptionDesc}>Select from device photo album</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A8A29E" />
            </Pressable>

            {profilePhoto && (
              <Pressable style={styles.photoOptionBtn} onPress={handleRemovePhoto}>
                <View style={[styles.photoOptionIconCircle, { backgroundColor: "#FEF2F2" }]}>
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.photoOptionTitle, { color: "#DC2626" }]}>Remove Photo</Text>
                  <Text style={styles.photoOptionDesc}>Use clean default silhouette avatar</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#A8A29E" />
              </Pressable>
            )}

            <Pressable
              style={styles.cancelPhotoBtn}
              onPress={() => setShowPhotoModal(false)}
            >
              <Text style={styles.cancelPhotoBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <AppUpdateModal
        visible={showManualUpdateModal}
        updateInfo={manualUpdateInfo}
        onClose={() => setShowManualUpdateModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAF9F6"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 4 : 10,
    paddingBottom: 14,
    backgroundColor: "#FAF9F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DF"
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.ink,
    letterSpacing: -0.2
  },
  cartIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  scrollContent: {
    paddingBottom: 40
  },

  /* Profile Header Card */
  profileHeaderCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  avatarWrapper: {
    position: "relative",
    width: 66,
    height: 66,
    borderRadius: 33,
    marginRight: 14
  },
  avatarImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#F5EBE1",
    borderWidth: 2,
    borderColor: "#E8DED1"
  },
  defaultAvatarContainer: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#F5EBE1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E8DED1"
  },
  avatarCameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  photoSheetContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    width: "100%",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  photoSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D6D3D1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14
  },
  photoSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.ink,
    textAlign: "center"
  },
  photoSheetSubtitle: {
    fontSize: 13,
    color: "#78716C",
    textAlign: "center",
    marginBottom: 16,
    marginTop: 2
  },
  photoOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#FAF9F6",
    marginBottom: 8
  },
  photoOptionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  photoOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1917"
  },
  photoOptionDesc: {
    fontSize: 12,
    color: "#78716C",
    marginTop: 1
  },
  cancelPhotoBtn: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#F5F5F4",
    alignItems: "center"
  },
  cancelPhotoBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#44403C"
  },
  profileDetailsCol: {
    flex: 1
  },
  profileUserName: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 2
  },
  profileUserContact: {
    fontSize: 13,
    color: theme.muted,
    marginBottom: 6
  },
  badgeRow: {
    flexDirection: "row"
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  rolePillSeller: {
    backgroundColor: "#FEF3C7"
  },
  rolePillBuyer: {
    backgroundColor: "#F0FDF4"
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: "700"
  },
  rolePillTextSeller: {
    color: "#B45309"
  },
  rolePillTextBuyer: {
    color: "#15803D"
  },
  loginBannerBtn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12
  },
  loginBannerBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8
  },

  /* Quick 4 Grid */
  quickGridCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4
  },
  quickGridItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  quickGridIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  quickGridLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.ink
  },

  /* Section Groups */
  sectionGroup: {
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.muted,
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 6
  },
  groupCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingHorizontal: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13
  },
  menuItemNoNav: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 13
  },
  menuItemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14
  },
  menuItemTextCol: {
    flex: 1,
    paddingRight: 8
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.ink
  },
  menuItemDesc: {
    fontSize: 12,
    color: theme.muted,
    marginTop: 2
  },
  menuSeparator: {
    height: 1,
    backgroundColor: "#F5F3EF",
    marginLeft: 50
  },
  editLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.accent
  },

  /* Inline address edit */
  inlineAddressBox: {
    backgroundColor: "#FAF9F6",
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  addressTextInput: {
    fontSize: 13,
    color: theme.ink,
    minHeight: 56,
    textAlignVertical: "top"
  },
  saveAddressButton: {
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 8
  },
  saveAddressButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6
  },

  /* Language pills */
  langPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#FAF9F6",
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  langChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent
  },
  langChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.ink
  },
  langChipTextActive: {
    color: "#FFFFFF"
  },

  /* Switches */
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12
  },
  switchTextCol: {
    flex: 1,
    paddingRight: 12
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.ink
  },
  switchDesc: {
    fontSize: 12,
    color: theme.muted,
    marginTop: 2
  },

  /* Logout Button */
  myntraLogoutBtn: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 3
  },
  myntraLogoutBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 1
  },
  myntraLoginBtn: {
    backgroundColor: theme.accent,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12
  },
  myntraLoginBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1
  },

  /* Footer */
  footerWrap: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 20
  },
  checkUpdateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FDE68A"
  },
  checkUpdateBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309"
  },
  footerVersion: {
    fontSize: 11,
    color: "#94969F",
    fontWeight: "600",
    marginBottom: 4
  },
  footerTagline: {
    fontSize: 11,
    color: "#A1A1AA"
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 16
  },
  signOutBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 6
  },
  sheetSub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16
  },
  accountChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 18
  },
  accountChipAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10
  },
  accountChipAvatarText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14
  },
  accountChipName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937"
  },
  accountChipEmail: {
    fontSize: 11,
    color: "#6B7280"
  },
  accountChipRole: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  accountChipRoleText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5563"
  },
  sheetActions: {
    flexDirection: "row",
    gap: 12
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center"
  },
  cancelModalText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563"
  },
  confirmSignOutBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center"
  },
  confirmSignOutText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF"
  },

  /* Coupons & Help */
  couponCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12
  },
  couponBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6
  },
  couponBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  couponCode: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2
  },
  couponDesc: {
    fontSize: 12,
    color: "#64748B"
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  helpRowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B"
  },
  helpRowSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1
  },
  closeModalBtn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14
  },
  closeModalBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  }
});
