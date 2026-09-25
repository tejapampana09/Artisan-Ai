import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
  TextInput,
  StatusBar,
  Platform,
  Switch,
  Alert
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { theme } from "../src/theme";
import { getSession, clearSession } from "../src/storage";
import { api } from "../src/api";
import { useI18n, AppLanguage } from "../src/i18n";
import { BottomNavigation } from "../src/components";
import { useRoleGuard } from "../src/authGuard";
import * as Location from "expo-location";

export default function SellerProfileScreen() {
  useRoleGuard("seller");
  const { language, setLanguage, t } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  // Studio profile state
  const [studioName, setStudioName] = useState("");
  const [craftSpecialty, setCraftSpecialty] = useState("");
  const [studioLocation, setStudioLocation] = useState("");
  const [editingStudio, setEditingStudio] = useState(false);

  // Bank & UPI payout state
  const [upiId, setUpiId] = useState("");
  const [editingPayout, setEditingPayout] = useState(false);

  // Studio Geolocation & Craft Cluster state
  const [editingLocation, setEditingLocation] = useState(false);
  const [craftCluster, setCraftCluster] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [district, setDistrict] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState("");

  // Studio alerts
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [inquiryAlerts, setInquiryAlerts] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);

  const [sellerPhoto, setSellerPhoto] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const handlePickFromGallery = async () => {
    setShowPhotoModal(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow gallery access to select your studio photo.");
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
        setSellerPhoto(uri);
        await AsyncStorage.setItem("artisan_studio_profile_photo", uri);
      }
    } catch (e) {
      console.warn("Studio gallery error:", e);
    }
  };

  const handleTakePhoto = async () => {
    setShowPhotoModal(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow camera access to take your studio photo.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        setSellerPhoto(uri);
        await AsyncStorage.setItem("artisan_studio_profile_photo", uri);
      }
    } catch (e) {
      console.warn("Studio camera error:", e);
    }
  };

  const handleRemovePhoto = async () => {
    setShowPhotoModal(false);
    setSellerPhoto(null);
    await AsyncStorage.removeItem("artisan_studio_profile_photo");
  };

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [])
  );

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleDetectGps = async () => {
    setDetectingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat: number | null = null;
      let lng: number | null = null;

      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      } else {
        // Fallback to IP location
        try {
          const ipRes = await fetch("https://api.bigdatacloud.net/data/client-info");
          if (ipRes.ok) {
            const ipData = await ipRes.json();
            if (ipData?.country?.isoCode === "IN") {
              lat = 16.434;
              lng = 80.56;
            }
          }
        } catch (_) {}
      }

      if (lat === null || lng === null) {
        setLocationSuccessMsg("Please allow location access to auto-fill GPS.");
        setTimeout(() => setLocationSuccessMsg(""), 4000);
        return;
      }

      setLatitude(String(lat));
      setLongitude(String(lng));

      let detDistrict = "";
      let detState = "";
      let detPincode = "";

      // 1. Try Expo reverse geocode
      try {
        const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (rev && rev.length > 0) {
          detDistrict = rev[0].district || rev[0].city || rev[0].subregion || "";
          detState = rev[0].region || "";
          detPincode = rev[0].postalCode || "";
        }
      } catch (_) {}

      // 2. OpenStreetMap Nominatim fallback
      if (!detDistrict || !detState) {
        try {
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
            { headers: { "Accept-Language": "en", "User-Agent": "ArtisanAI-Mobile/1.0" } }
          );
          if (osmRes.ok) {
            const data = await osmRes.json();
            const addr = data.address || {};
            if (!detState) detState = addr.state || "";
            if (!detDistrict) detDistrict = addr.state_district || addr.county || addr.city || addr.town || "";
            if (!detPincode) detPincode = addr.postcode || "";
          }
        } catch (_) {}
      }

      if (detDistrict) setDistrict(detDistrict);
      if (detState) setStateName(detState);
      if (detPincode) setPincode(detPincode);

      // 3. Find closest Heritage Craft Cluster
      const clusters = await api.getCraftClusters().catch(() => []);
      if (clusters && clusters.length > 0) {
        let best = null;
        let minD = Infinity;
        for (const c of clusters) {
          if (c.latitude && c.longitude) {
            const d = calculateDistance(lat, lng, c.latitude, c.longitude);
            if (d < minD) {
              minD = d;
              best = c;
            }
          }
        }
        if (best && minD < 200) {
          setCraftCluster(best.name);
          if (!detState && best.state) setStateName(best.state);
        }
      }

      setLocationSuccessMsg(`✓ GPS detected: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
      setTimeout(() => setLocationSuccessMsg(""), 5000);
    } catch (err) {
      console.warn("GPS detection error:", err);
      setLocationSuccessMsg("Could not detect location. Please fill manually.");
      setTimeout(() => setLocationSuccessMsg(""), 4000);
    } finally {
      setDetectingGps(false);
    }
  };

  const loadProfileData = async () => {
    try {
      const sess = await getSession("STUDIO");
      if (sess?.user) {
        setUser(sess.user);
        setStudioName(sess.user.name || sess.user.full_name || "Heritage Craft Studio");
        setCraftSpecialty(sess.user.craft || sess.user.craft_specialization || "Handloom & Terracotta");
        setStudioLocation(sess.user.location || "Andhra Pradesh, India");
        setCraftCluster(sess.user.craft_cluster || "");
        if (sess.user.latitude !== undefined && sess.user.latitude !== null) {
          setLatitude(String(sess.user.latitude));
        }
        if (sess.user.longitude !== undefined && sess.user.longitude !== null) {
          setLongitude(String(sess.user.longitude));
        }
        setDistrict(sess.user.district || "");
        setStateName(sess.user.state || "");
        if (sess.user.pincode) setPincode(sess.user.pincode);
      }

      // Load saved studio profile photo
      const savedPhoto = await AsyncStorage.getItem("artisan_studio_profile_photo");
      if (savedPhoto) {
        setSellerPhoto(savedPhoto);
      } else if (sess?.user?.avatar_url && !sess.user.avatar_url.includes("dicebear")) {
        setSellerPhoto(sess.user.avatar_url);
      }

      // Load saved studio UPI
      const savedUpi = await AsyncStorage.getItem("artisan_studio_upi_id");
      if (savedUpi) setUpiId(savedUpi);

      // Fetch dashboard stats for metrics preview
      const dash = await api.sellerDashboard().catch(() => null);
      if (dash) setStats(dash);
    } catch (e) {
      console.warn("Failed to load seller profile data:", e);
    }
  };

  const handleSaveLocation = async () => {
    if (!latitude || !longitude) return;
    setSavingLocation(true);
    try {
      const updated = await api.updateArtisanLocation({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        craft_cluster: craftCluster.trim() || undefined,
        district: district.trim() || undefined,
        state: stateName.trim() || undefined,
        pincode: pincode.trim() || undefined
      });
      if (updated) {
        setUser(updated);
        setLocationSuccessMsg("Studio location saved to Heritage Map!");
        setTimeout(() => setLocationSuccessMsg(""), 4000);
        setEditingLocation(false);
      }
    } catch (err) {
      console.warn("Save location error:", err);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveStudioInfo = async () => {
    setEditingStudio(false);
  };

  const handleSavePayout = async () => {
    if (!upiId.trim() || !upiId.includes("@")) {
      // show inline error instead of Alert
      return;
    }
    await AsyncStorage.setItem("artisan_studio_upi_id", upiId.trim());
    setEditingPayout(false);
  };

  const handleSignOut = () => {
    setSignOutModalVisible(true);
  };

  const doSignOut = async () => {
    setSignOutModalVisible(false);
    await clearSession("STUDIO");
    await clearSession();
    router.replace("/buyer");
  };

  const avatarUrl =
    user?.avatar_url ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(studioName || "Artisan")}`;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />

      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/seller");
          }}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color="#1C1917" />
        </Pressable>
        <Text style={styles.topBarTitle}>Master Artisan Studio</Text>
        <Pressable
          onPress={() => router.push("/notifications")}
          style={styles.notifBtn}
          hitSlop={10}
        >
          <Ionicons name="notifications-outline" size={22} color="#1C1917" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Artisan Studio Card */}
        <View style={styles.studioCard}>
          <View style={styles.studioTopRow}>
            <Pressable
              style={styles.avatarWrapper}
              onPress={() => setShowPhotoModal(true)}
              hitSlop={8}
              accessibilityLabel="Upload or change studio photo"
            >
              {sellerPhoto ? (
                <Image source={{ uri: sellerPhoto }} style={styles.studioAvatar} />
              ) : (
                <View style={styles.defaultStudioAvatar}>
                  <Ionicons name="storefront" size={26} color="#8C7A6B" />
                </View>
              )}
              <View style={styles.avatarCameraBadge}>
                <Ionicons name="camera" size={13} color="#FFFFFF" />
              </View>
            </Pressable>
            <View style={styles.studioDetailsCol}>
              <View style={styles.badgeRow}>
                <View style={styles.studioRoleBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#15803D" style={{ marginRight: 3 }} />
                  <Text style={styles.studioRoleBadgeText}>VERIFIED ARTISAN STUDIO</Text>
                </View>
              </View>
              <Text style={styles.studioNameText} numberOfLines={1}>{studioName}</Text>
              <Text style={styles.studioCraftText} numberOfLines={1}>Craft: {craftSpecialty}</Text>
              <Text style={styles.studioLocText} numberOfLines={1}>📍 {studioLocation}</Text>
            </View>
          </View>

          <Pressable
            style={styles.editStudioBtn}
            onPress={() => setEditingStudio(!editingStudio)}
          >
            <Ionicons name={editingStudio ? "close-outline" : "create-outline"} size={16} color={theme.accent} />
            <Text style={styles.editStudioBtnText}>{editingStudio ? "Cancel Edit" : "Edit Studio Profile"}</Text>
          </Pressable>

          {editingStudio && (
            <View style={styles.editFormBox}>
              <Text style={styles.formInputLabel}>Studio / Artisan Name</Text>
              <TextInput
                style={styles.formInput}
                value={studioName}
                onChangeText={setStudioName}
                placeholder="Studio or Master Artisan Name"
                placeholderTextColor="#A8A29E"
              />
              <Text style={styles.formInputLabel}>Primary Craft Specialty</Text>
              <TextInput
                style={styles.formInput}
                value={craftSpecialty}
                onChangeText={setCraftSpecialty}
                placeholder="e.g. Kalamkari, Kondapalli Toys, Pochampally Ikat"
                placeholderTextColor="#A8A29E"
              />
              <Text style={styles.formInputLabel}>Studio Location</Text>
              <TextInput
                style={styles.formInput}
                value={studioLocation}
                onChangeText={setStudioLocation}
                placeholder="e.g. Machilipatnam, Andhra Pradesh"
                placeholderTextColor="#A8A29E"
              />
              <Pressable style={styles.saveFormBtn} onPress={handleSaveStudioInfo}>
                <Text style={styles.saveFormBtnText}>SAVE STUDIO DETAILS</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* 2. Studio Business Operations Hub */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>STUDIO OPERATIONS</Text>

          <Pressable
            style={styles.menuRow}
            onPress={() => router.push("/seller-products")}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="cube-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Craft Inventory & Catalog</Text>
              <Text style={styles.menuSub}>Manage listings, stock levels & live prices</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            style={styles.menuRow}
            onPress={() => router.push("/seller-orders")}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="receipt-outline" size={20} color="#2563EB" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Orders & Dispatch Pipeline</Text>
              <Text style={styles.menuSub}>Pack orders, download labels & update tracking</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            style={styles.menuRow}
            onPress={() => router.push("/seller-enquiries")}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: "#FDF2F8" }]}>
              <Ionicons name="chatbubbles-outline" size={20} color="#DB2777" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Direct Buyer Inquiries</Text>
              <Text style={styles.menuSub}>Custom orders, wholesale requests & chat</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            style={styles.menuRow}
            onPress={() => router.push("/seller-business")}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: "#F0FDF4" }]}>
              <Ionicons name="trending-up-outline" size={20} color="#16A34A" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Market Demand & Analytics</Text>
              <Text style={styles.menuSub}>National buyer demand, search trends & forecasts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </Pressable>
        </View>

        {/* 3. Payout & Bank Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>PAYOUT & SETTLEMENTS</Text>

          <Pressable
            style={styles.menuRow}
            onPress={() => setEditingPayout(!editingPayout)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: "#F0FDF4" }]}>
              <Ionicons name="card-outline" size={20} color="#15803D" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Bank / UPI Payout ID</Text>
              <Text style={styles.menuSub}>
                {upiId ? `Active: ${upiId}` : "Set up your UPI ID for direct order earnings"}
              </Text>
            </View>
            <Text style={styles.editTextBtn}>{editingPayout ? "Cancel" : (upiId ? "Edit" : "Set")}</Text>
          </Pressable>

          {editingPayout && (
            <View style={styles.editFormBox}>
              <Text style={styles.formInputLabel}>UPI ID (VPA)</Text>
              <TextInput
                style={styles.formInput}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="e.g. artisan@oksbi or 9876543210@paytm"
                placeholderTextColor="#A8A29E"
                autoCapitalize="none"
              />
              <Pressable style={styles.saveFormBtn} onPress={handleSavePayout}>
                <Text style={styles.saveFormBtnText}>SAVE PAYOUT UPI</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Studio Geolocation & Craft Cluster */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>STUDIO GEOLOCATION & CRAFT CLUSTER</Text>

          {locationSuccessMsg ? (
            <View style={{ backgroundColor: "#F0FDF4", padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#BBF7D0" }}>
              <Text style={{ color: "#166534", fontSize: 12, fontWeight: "700" }}>✓ {locationSuccessMsg}</Text>
            </View>
          ) : null}

          <Pressable
            style={styles.menuRow}
            onPress={() => setEditingLocation(!editingLocation)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="location-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>
                {craftCluster ? `${craftCluster} Cluster` : "Heritage Studio Coordinates"}
              </Text>
              <Text style={styles.menuSub}>
                {latitude && longitude
                  ? `Live Pin: ${parseFloat(latitude).toFixed(3)}°N, ${parseFloat(longitude).toFixed(3)}°E`
                  : "Tap to set your workshop coordinates for the Craft Map"}
              </Text>
            </View>
            <Text style={styles.editTextBtn}>{editingLocation ? "Cancel" : (latitude ? "Edit" : "Set")}</Text>
          </Pressable>

          {editingLocation && (
            <View style={styles.editFormBox}>
              {/* GPS Auto-Detect Button */}
              <Pressable
                style={[styles.detectGpsBtn, detectingGps && { opacity: 0.6 }]}
                onPress={handleDetectGps}
                disabled={detectingGps}
              >
                <Ionicons name={detectingGps ? "reload" : "locate"} size={16} color="#A6533B" />
                <Text style={styles.detectGpsBtnText}>
                  {detectingGps ? "Detecting GPS & Nearest GI Cluster..." : "Detect Current Location (GPS Auto-Fill)"}
                </Text>
              </Pressable>

              <Text style={styles.formInputLabel}>Heritage Craft Cluster (e.g. Mangalagiri, Srikalahasti, Jaipur)</Text>
              <TextInput
                style={styles.formInput}
                value={craftCluster}
                onChangeText={setCraftCluster}
                placeholder="e.g. Mangalagiri or Etikoppaka"
                placeholderTextColor="#A8A29E"
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Latitude (° N)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={latitude}
                    onChangeText={setLatitude}
                    placeholder="16.4340"
                    keyboardType="numeric"
                    placeholderTextColor="#A8A29E"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Longitude (° E)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={longitude}
                    onChangeText={setLongitude}
                    placeholder="80.5600"
                    keyboardType="numeric"
                    placeholderTextColor="#A8A29E"
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>District</Text>
                  <TextInput
                    style={styles.formInput}
                    value={district}
                    onChangeText={setDistrict}
                    placeholder="Guntur"
                    placeholderTextColor="#A8A29E"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>State</Text>
                  <TextInput
                    style={styles.formInput}
                    value={stateName}
                    onChangeText={setStateName}
                    placeholder="Andhra Pradesh"
                    placeholderTextColor="#A8A29E"
                  />
                </View>
                <View style={{ flex: 0.8 }}>
                  <Text style={styles.formInputLabel}>Pincode</Text>
                  <TextInput
                    style={styles.formInput}
                    value={pincode}
                    onChangeText={setPincode}
                    placeholder="522237"
                    keyboardType="numeric"
                    placeholderTextColor="#A8A29E"
                  />
                </View>
              </View>

              <Pressable
                style={[styles.saveFormBtn, savingLocation ? { opacity: 0.6 } : null]}
                onPress={handleSaveLocation}
                disabled={savingLocation}
              >
                <Text style={styles.saveFormBtnText}>
                  {savingLocation ? "SAVING COORDINATES..." : "SAVE STUDIO ON CRAFT MAP"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Quick link to explore the Craft Map */}
          <Pressable
            style={styles.openMapStrip}
            onPress={() => router.push("/craft-map" as any)}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="map" size={17} color="#A6533B" />
              <Text style={styles.openMapStripText}>Browse Heritage Craft Map & Clusters</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color="#A6533B" />
          </Pressable>
        </View>

        {/* 4. Studio Preferences & Notifications */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>STUDIO PREFERENCES</Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.switchTitle}>New Order Notifications</Text>
              <Text style={styles.switchSub}>Instant alerts when buyers place an order</Text>
            </View>
            <Switch
              value={orderAlerts}
              onValueChange={setOrderAlerts}
              trackColor={{ false: "#E7E5E4", true: "#FCA5A5" }}
              thumbColor={orderAlerts ? theme.accent : "#F5F5F4"}
            />
          </View>

          <View style={styles.menuDivider} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.switchTitle}>Buyer Inquiry Notifications</Text>
              <Text style={styles.switchSub}>Alerts for custom craft and wholesale messages</Text>
            </View>
            <Switch
              value={inquiryAlerts}
              onValueChange={setInquiryAlerts}
              trackColor={{ false: "#E7E5E4", true: "#FCA5A5" }}
              thumbColor={inquiryAlerts ? theme.accent : "#F5F5F4"}
            />
          </View>

          <View style={styles.menuDivider} />

          {/* Language Selector */}
          <View style={styles.menuRow}>
            <View style={[styles.menuIconCircle, { backgroundColor: "#F5EFEB" }]}>
              <Ionicons name="language-outline" size={20} color={theme.accent} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Studio Language</Text>
              <Text style={styles.menuSub}>Choose interface language for artisan tools</Text>
              <View style={styles.langPillContainer}>
                {[
                  { label: "English", code: "en" as AppLanguage },
                  { label: "తెలుగు", code: "te" as AppLanguage },
                  { label: "हिन्दी", code: "hi" as AppLanguage },
                  { label: "தமிழ்", code: "ta" as AppLanguage }
                ].map((item) => {
                  const active = language === item.code;
                  return (
                    <Pressable
                      key={item.code}
                      onPress={() => setLanguage(item.code)}
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
        </View>

        {/* Sign Out */}
        <View style={styles.actionGroup}>
          <Pressable
            style={styles.signOutBtn}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={18} color="#E11D48" style={{ marginRight: 8 }} />
            <Text style={styles.signOutBtnText}>Sign Out of Artisan Studio</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Beautiful Sign-Out Confirmation Modal ── */}
      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSignOutModalVisible(false)}
        >
          <Pressable style={styles.signOutModal} onPress={() => {}}>
            {/* Icon */}
            <View style={styles.signOutIconCircle}>
              <Ionicons name="log-out-outline" size={32} color="#E11D48" />
            </View>

            {/* Title & Body */}
            <Text style={styles.signOutModalTitle}>Sign out of Studio?</Text>
            <Text style={styles.signOutModalBody}>
              You'll be taken back to the Buyer Marketplace. Your studio data and products stay safe.
            </Text>

            {/* Buttons */}
            <View style={styles.signOutModalActions}>
              <Pressable
                style={styles.signOutCancelBtn}
                onPress={() => setSignOutModalVisible(false)}
              >
                <Text style={styles.signOutCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.signOutConfirmBtn}
                onPress={doSignOut}
              >
                <Ionicons name="log-out-outline" size={15} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.signOutConfirmText}>Yes, Sign Out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Studio Photo Picker Modal */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPhotoModal(false)}
        >
          <Pressable style={styles.photoSheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.photoSheetHandle} />
            <Text style={styles.photoSheetTitle}>Artisan Studio Photo</Text>
            <Text style={styles.photoSheetSubtitle}>Personalize your studio avatar for buyers & craft map</Text>

            <Pressable style={styles.photoOptionBtn} onPress={handleTakePhoto}>
              <View style={[styles.photoOptionIconCircle, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="camera" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoOptionTitle}>Take Studio Photo</Text>
                <Text style={styles.photoOptionDesc}>Capture workspace or craft with camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A8A29E" />
            </Pressable>

            <Pressable style={styles.photoOptionBtn} onPress={handlePickFromGallery}>
              <View style={[styles.photoOptionIconCircle, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="images" size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.photoOptionDesc}>Select from device photos</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A8A29E" />
            </Pressable>

            {sellerPhoto && (
              <Pressable style={styles.photoOptionBtn} onPress={handleRemovePhoto}>
                <View style={[styles.photoOptionIconCircle, { backgroundColor: "#FEF2F2" }]}>
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.photoOptionTitle, { color: "#DC2626" }]}>Remove Photo</Text>
                  <Text style={styles.photoOptionDesc}>Reset to default artisan studio icon</Text>
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

      <BottomNavigation role="seller" />
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
    paddingVertical: 12,
    backgroundColor: "#FAF9F6",
    borderBottomWidth: 1,
    borderBottomColor: "#EAE7E1"
  },
  backBtn: {
    padding: 6
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1C1917"
  },
  notifBtn: {
    padding: 6
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 80
  },
  studioCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2
  },
  studioTopRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  avatarWrapper: {
    position: "relative",
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 14
  },
  studioAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5EBE1",
    borderWidth: 2,
    borderColor: theme.accent
  },
  defaultStudioAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5EBE1",
    borderWidth: 2,
    borderColor: "#E8DDD5",
    alignItems: "center",
    justifyContent: "center"
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
    color: "#1C1917",
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
  studioDetailsCol: {
    flex: 1,
    marginLeft: 14
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 4
  },
  studioRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#BBF7D0"
  },
  studioRoleBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#15803D",
    letterSpacing: 0.5
  },
  studioNameText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1C1917",
    marginBottom: 2
  },
  studioCraftText: {
    fontSize: 12,
    color: "#57534E",
    fontWeight: "600",
    marginBottom: 1
  },
  studioLocText: {
    fontSize: 11,
    color: "#78716C"
  },
  editStudioBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8DDD5",
    backgroundColor: "#FAF9F6",
    gap: 6
  },
  editStudioBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.accent
  },
  editFormBox: {
    marginTop: 14,
    backgroundColor: "#FAF9F6",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8DDD5"
  },
  detectGpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10
  },
  detectGpsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E"
  },
  openMapStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF7F2",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  openMapStripText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#A6533B"
  },
  formInputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#57534E",
    marginBottom: 4,
    marginTop: 8
  },
  formInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: "#1C1917"
  },
  saveFormBtn: {
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12
  },
  saveFormBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800"
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 16
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#78716C",
    marginBottom: 12
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  menuTextCol: {
    flex: 1
  },
  menuTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 2
  },
  menuSub: {
    fontSize: 11,
    color: "#78716C",
    lineHeight: 15
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F5F5F4",
    marginVertical: 4
  },
  editTextBtn: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.accent,
    paddingHorizontal: 8
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 2
  },
  switchSub: {
    fontSize: 11,
    color: "#78716C"
  },
  langPillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  langChip: {
    backgroundColor: "#FAF9F6",
    borderWidth: 1,
    borderColor: "#E7E5E4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14
  },
  langChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent
  },
  langChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#57534E"
  },
  langChipTextActive: {
    color: "#FFFFFF"
  },
  actionGroup: {
    gap: 10,
    marginTop: 8
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECDD3",
    paddingVertical: 13
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#E11D48"
  },
  // ── Sign-Out Modal ────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 32
  },
  signOutModal: {
    width: "92%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20
  },
  signOutIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#FECDD3"
  },
  signOutModalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1C1917",
    marginBottom: 8,
    textAlign: "center"
  },
  signOutModalBody: {
    fontSize: 13.5,
    color: "#78716C",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8
  },
  signOutModalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%"
  },
  signOutCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F5F0EC",
    alignItems: "center",
    justifyContent: "center"
  },
  signOutCancelText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#57534E"
  },
  signOutConfirmBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#E11D48",
    alignItems: "center",
    justifyContent: "center"
  },
  signOutConfirmText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff"
  }
});
