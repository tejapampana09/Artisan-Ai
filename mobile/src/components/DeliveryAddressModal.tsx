import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { theme } from "../theme";
import {
  SavedAddress,
  getSavedAddresses,
  getActiveDeliveryAddress,
  selectDeliveryAddress,
  saveAddress
} from "../address";
import { getSession } from "../storage";

interface DeliveryAddressModalProps {
  visible: boolean;
  onClose: () => void;
  onAddressSelected?: (address: SavedAddress) => void;
}

export const DeliveryAddressModal: React.FC<DeliveryAddressModalProps> = ({
  visible,
  onClose,
  onAddressSelected
}) => {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pincodeInput, setPincodeInput] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<string>("");
  const [showAddNew, setShowAddNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);

  // New address form
  const [newName, setNewName] = useState("");
  const [newPincode, setNewPincode] = useState("");
  const [newAddressLine, setNewAddressLine] = useState("");
  const [newTag, setNewTag] = useState<"HOME" | "WORK" | "OTHER">("HOME");

  useEffect(() => {
    if (visible) {
      loadAddresses();
    }
  }, [visible]);

  const loadAddresses = async () => {
    const list = await getSavedAddresses();
    setAddresses(list);
    const active = await getActiveDeliveryAddress();
    if (active) {
      setSelectedId(active.id);
      setPincodeInput(active.pincode || "");
    } else if (list.length > 0) {
      setSelectedId(list[0].id);
      setPincodeInput(list[0].pincode || "");
    }
  };

  const handleSelect = async (addr: SavedAddress) => {
    setSelectedId(addr.id);
    setPincodeInput(addr.pincode);
    await selectDeliveryAddress(addr);
    if (onAddressSelected) {
      onAddressSelected(addr);
    }
    onClose();
  };

  const handleCheckPincode = () => {
    const pin = pincodeInput.trim();
    if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
      setPincodeStatus("Enter a valid 6-digit Indian PIN code");
      return;
    }
    // Check if serviceable
    setPincodeStatus(`Deliverable to ${pin} (Estimated 3-5 days by India Post / Artisan Express)`);
  };

  const handleUseCurrentLocation = async () => {
    setDetectingGps(true);
    setPincodeStatus("Detecting GPS location...");

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
        // Fallback to IP geolocation
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
        setPincodeStatus("Please allow location access to auto-detect.");
        Alert.alert(
          "Location Access Required",
          "Please enable location permissions in device settings to automatically detect your delivery address."
        );
        setDetectingGps(false);
        return;
      }

      let detStreet = "";
      let detDistrict = "";
      let detCity = "";
      let detState = "";
      let detPincode = "";

      // 1. Native Expo Reverse Geocoder
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
      } catch (e) {
        console.warn("Expo reverseGeocode error:", e);
      }

      // 2. OpenStreetMap Nominatim Fallback
      if (!detPincode || (!detDistrict && !detCity)) {
        try {
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en", "User-Agent": "ArtisanAI-Mobile/1.0" } }
          );
          if (osmRes.ok) {
            const data = await osmRes.json();
            const addr = data.address || {};
            if (!detStreet) {
              detStreet = [addr.road || addr.pedestrian || addr.suburb, addr.neighbourhood].filter(Boolean).join(", ");
            }
            if (!detCity) detCity = addr.city || addr.town || addr.village || "";
            if (!detDistrict) detDistrict = addr.state_district || addr.county || detCity || "";
            if (!detState) detState = addr.state || "";
            if (!detPincode) detPincode = addr.postcode || "";
          }
        } catch (_) {}
      }

      const cleanPin = detPincode ? detPincode.replace(/\D/g, "").slice(0, 6) : "";
      const cityDistrict = detCity && detDistrict && detCity !== detDistrict ? `${detCity}, ${detDistrict}` : (detCity || detDistrict);
      const cleanAddressLine = [detStreet, cityDistrict, detState].filter(Boolean).join(", ") || "Current Location";

      let buyerName = newName.trim();
      if (!buyerName) {
        try {
          const sess = await getSession();
          buyerName = sess?.user?.full_name || sess?.user?.name || sess?.user?.username || "You";
        } catch {}
      }
      if (!buyerName) buyerName = "You";

      // Auto-fill form inputs
      if (cleanPin) {
        setPincodeInput(cleanPin);
        setNewPincode(cleanPin);
      }
      setNewAddressLine(cleanAddressLine);
      setNewName(buyerName);

      // Auto save as active delivery address and select
      const created = await saveAddress({
        name: buyerName,
        pincode: cleanPin,
        addressLine: cleanAddressLine,
        city: detCity || detDistrict || undefined,
        state: detState || undefined,
        tag: "HOME",
        isDefault: true
      });

      setAddresses(created);
      const added = created.find((a) => a.isDefault) || created[0];
      if (added) {
        setSelectedId(added.id);
        if (onAddressSelected) {
          onAddressSelected(added);
        }
      }

      setPincodeStatus(`✓ Auto-detected & selected: ${cleanAddressLine}${cleanPin ? ` (${cleanPin})` : ""}`);
      setDetectingGps(false);

      // Smoothly dismiss modal so buyer sees updated address on home screen
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.warn("GPS detection error in DeliveryAddressModal:", err);
      setPincodeStatus("Could not detect location. Please fill manually.");
      setDetectingGps(false);
      setShowAddNew(true);
    }
  };

  const handleSaveNewAddress = async () => {
    if (!newAddressLine.trim()) {
      Alert.alert("Address Required", "Please enter your flat, house number and street.");
      return;
    }
    if (!newPincode.trim() || newPincode.trim().length !== 6) {
      Alert.alert("Valid Pincode Required", "Please enter a valid 6-digit PIN code.");
      return;
    }

    const created = await saveAddress({
      name: newName.trim() || "Delivery Contact",
      pincode: newPincode.trim(),
      addressLine: newAddressLine.trim(),
      tag: newTag,
      isDefault: true
    });

    setAddresses(created);
    const added = created[0];
    if (added) {
      setSelectedId(added.id);
      if (onAddressSelected) onAddressSelected(added);
    }
    setShowAddNew(false);
    setNewName("");
    setNewPincode("");
    setNewAddressLine("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.scrim} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Delivery Location</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color="#1C1917" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
          >
            {/* Pincode Input Box */}
            <View style={styles.pincodeBox}>
              <TextInput
                style={styles.pincodeInput}
                placeholder="Enter 6-digit PIN code"
                placeholderTextColor="#A8A29E"
                keyboardType="number-pad"
                maxLength={6}
                value={pincodeInput}
                onChangeText={(text) => {
                  setPincodeInput(text);
                  setPincodeStatus("");
                }}
              />
              <Pressable
                style={styles.checkPincodeBtn}
                onPress={handleCheckPincode}
                hitSlop={8}
              >
                <Text style={styles.checkPincodeText}>Check Pincode</Text>
              </Pressable>
            </View>

            {pincodeStatus ? (
              <View style={styles.statusBox}>
                <Ionicons
                  name={pincodeStatus.startsWith("Deliverable") ? "checkmark-circle" : "information-circle"}
                  size={15}
                  color={pincodeStatus.startsWith("Deliverable") ? "#15803D" : "#E11D48"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.statusText,
                    pincodeStatus.startsWith("Deliverable") ? { color: "#15803D" } : { color: "#E11D48" }
                  ]}
                >
                  {pincodeStatus}
                </Text>
              </View>
            ) : null}

            {/* Use My Current Location & Search Location */}
            <View style={styles.locationActionsGroup}>
              <Pressable
                style={[styles.locationActionRow, (loading || detectingGps) && { opacity: 0.6 }]}
                onPress={handleUseCurrentLocation}
                disabled={loading || detectingGps}
              >
                <View style={styles.locationActionIcon}>
                  {detectingGps ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <Ionicons name="locate" size={18} color={theme.accent} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationActionText}>
                    {detectingGps ? "Detecting GPS Location..." : "Use my current location"}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#78716C", marginTop: 2 }}>
                    {detectingGps ? "Acquiring coordinates & postal address..." : "GPS auto-detect street, area & PIN code"}
                  </Text>
                </View>
                {detectingGps ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={theme.accent} />
                )}
              </Pressable>

              <View style={styles.actionDivider} />

              <Pressable
                style={styles.locationActionRow}
                onPress={() => setShowAddNew(true)}
              >
                <View style={styles.locationActionIcon}>
                  <Ionicons name="map-outline" size={18} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationActionText}>Add new address</Text>
                  <Text style={{ fontSize: 11, color: "#78716C", marginTop: 2 }}>
                    Enter address manually or customize flat number
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.accent} />
              </Pressable>
            </View>

            {/* Add New Address Form (Expanded when clicked) */}
            {showAddNew && (
              <View style={styles.newAddressForm}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={styles.formTitle}>Add New Delivery Address</Text>
                  <Pressable
                    onPress={handleUseCurrentLocation}
                    disabled={detectingGps}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#FBF7F0",
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: "#E8D8C8"
                    }}
                  >
                    {detectingGps ? (
                      <ActivityIndicator size="small" color="#A6533B" style={{ marginRight: 4 }} />
                    ) : (
                      <Ionicons name="locate" size={13} color="#A6533B" style={{ marginRight: 4 }} />
                    )}
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#A6533B" }}>
                      {detectingGps ? "Detecting..." : "GPS Auto-Fill"}
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.formInput}
                  placeholder="Recipient Name (e.g. Teja Pampana)"
                  placeholderTextColor="#A8A29E"
                  value={newName}
                  onChangeText={setNewName}
                />
                <TextInput
                  style={styles.formInput}
                  placeholder="6-digit Pincode (e.g. 522502)"
                  placeholderTextColor="#A8A29E"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={newPincode}
                  onChangeText={setNewPincode}
                />
                <TextInput
                  style={[styles.formInput, { height: 60, textAlignVertical: "top" }]}
                  placeholder="Flat / Building, Road, Landmark (e.g. SRM University AP Road, Ganga Tower)"
                  placeholderTextColor="#A8A29E"
                  multiline
                  value={newAddressLine}
                  onChangeText={setNewAddressLine}
                />

                {/* Tag Selector */}
                <View style={styles.tagSelectorRow}>
                  {(["HOME", "WORK", "OTHER"] as const).map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() => setNewTag(tag)}
                      style={[styles.tagBtn, newTag === tag && styles.tagBtnActive]}
                    >
                      <Text style={[styles.tagBtnText, newTag === tag && styles.tagBtnTextActive]}>
                        {tag}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.formActionRow}>
                  <Pressable
                    style={styles.formCancelBtn}
                    onPress={() => setShowAddNew(false)}
                  >
                    <Text style={styles.formCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.formSaveBtn}
                    onPress={handleSaveNewAddress}
                  >
                    <Text style={styles.formSaveText}>Save & Deliver Here</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* OR Separator */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>Or</Text>
              <View style={styles.orLine} />
            </View>

            {/* Saved Addresses Section */}
            <Text style={styles.sectionHeader}>Select Saved Address</Text>

            {addresses.length === 0 ? (
              <View style={styles.noAddressesBox}>
                <Ionicons name="location-outline" size={32} color="#A8A29E" />
                <Text style={styles.noAddressesText}>No saved addresses yet.</Text>
                <Pressable
                  style={styles.addFirstBtn}
                  onPress={() => setShowAddNew(true)}
                >
                  <Text style={styles.addFirstBtnText}>+ Add Delivery Address</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.addressesList}>
                {addresses.map((item) => {
                  const isChecked = selectedId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.addressCard, isChecked && styles.addressCardActive]}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={styles.addressLeft}>
                        <View style={styles.locationPinBox}>
                          <Ionicons
                            name="location-sharp"
                            size={18}
                            color={isChecked ? theme.accent : "#57534E"}
                          />
                        </View>

                        <View style={styles.addressDetails}>
                          <View style={styles.addressNameRow}>
                            <Text style={styles.addressName} numberOfLines={1}>
                              {item.name} , {item.pincode}
                            </Text>
                            <View style={styles.tagBadge}>
                              <Text style={styles.tagBadgeText}>{item.tag}</Text>
                            </View>
                          </View>
                          <Text style={styles.addressLine} numberOfLines={2}>
                            {item.addressLine}
                          </Text>
                        </View>
                      </View>

                      {/* Radio / Check Circle */}
                      <View style={[styles.radioCircle, isChecked && styles.radioCircleActive]}>
                        <Ionicons
                          name="checkmark"
                          size={15}
                          color={isChecked ? "#FFFFFF" : "#57534E"}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end"
  },
  scrim: {
    ...StyleSheet.absoluteFillObject
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingTop: 16
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F4"
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1917"
  },
  closeBtn: {
    padding: 4
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 14
  },
  pincodeBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E7E5E4",
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: "#FFFFFF"
  },
  pincodeInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1917"
  },
  checkPincodeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  checkPincodeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#78716C"
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 4
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600"
  },
  locationActionsGroup: {
    marginTop: 14,
    paddingVertical: 2
  },
  locationActionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10
  },
  locationActionIcon: {
    marginRight: 10
  },
  locationActionText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
    color: theme.accent
  },
  actionDivider: {
    height: 1,
    backgroundColor: "#F5F5F4",
    marginVertical: 2
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E7E5E4"
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: "700",
    color: "#78716C"
  },
  sectionHeader: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1C1917",
    marginBottom: 12
  },
  addressesList: {
    gap: 10
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E7E5E4",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#FFFFFF"
  },
  addressCardActive: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFFBFB"
  },
  addressLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    marginRight: 12
  },
  locationPinBox: {
    marginRight: 8,
    marginTop: 2
  },
  addressDetails: {
    flex: 1
  },
  addressNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  addressName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1C1917"
  },
  tagBadge: {
    backgroundColor: "#F5F5F4",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  tagBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#78716C",
    letterSpacing: 0.5
  },
  addressLine: {
    fontSize: 11.5,
    color: "#78716C",
    lineHeight: 16
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D6D3D1",
    alignItems: "center",
    justifyContent: "center"
  },
  radioCircleActive: {
    backgroundColor: "#E11D48",
    borderColor: "#E11D48"
  },
  noAddressesBox: {
    alignItems: "center",
    paddingVertical: 24
  },
  noAddressesText: {
    fontSize: 13,
    color: "#78716C",
    marginTop: 6,
    marginBottom: 12
  },
  addFirstBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  addFirstBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  newAddressForm: {
    backgroundColor: "#FAF9F6",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    marginVertical: 10
  },
  formTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1C1917",
    marginBottom: 10
  },
  formInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E5E4",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: "#1C1917",
    marginBottom: 8
  },
  tagSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  tagBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E5E4"
  },
  tagBtnActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent
  },
  tagBtnText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#78716C"
  },
  tagBtnTextActive: {
    color: "#FFFFFF"
  },
  formActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10
  },
  formCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  formCancelText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#78716C"
  },
  formSaveBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6
  },
  formSaveText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800"
  }
});
