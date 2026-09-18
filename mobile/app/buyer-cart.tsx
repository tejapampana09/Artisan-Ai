import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../src/theme";
import { getCart, updateQuantity, removeFromCart, clearCart, CartItem } from "../src/cart";
import { api } from "../src/api";
import { getSession } from "../src/storage";

export default function BuyerCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [isGuest, setIsGuest] = useState(true);
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");

  const refreshCart = async () => {
    const list = await getCart();
    setItems(list);
    setLoading(false);
  };

  const checkAuth = async () => {
    const s = await getSession();
    const guest =
      !s.token || s.token === "guest_buyer_token" || s.user?.email === "guest@artisanai.in";
    setIsGuest(guest);
    if (s.user && !guest) {
      if (s.user.name && s.user.name !== "Guest Explorer") setDeliveryName(s.user.name);
      if (s.user.phone) setDeliveryPhone(s.user.phone);
      if (s.user.location) setDeliveryAddress(s.user.location);
    }
  };

  useFocusEffect(
    useCallback(() => {
      refreshCart();
      checkAuth();
    }, [])
  );

  const handleUpdateQty = async (id: number, delta: number) => {
    const updated = await updateQuantity(id, delta);
    setItems(updated);
  };

  const handleRemove = async (id: number) => {
    const updated = await removeFromCart(id);
    setItems(updated);
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 0; // Free ONDC logistics
  const grandTotal = subtotal + deliveryFee;

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      Alert.alert("Empty Cart", "Add some handcrafted products first.");
      return;
    }

    const s = await getSession();
    const guest =
      !s.token || s.token === "guest_buyer_token" || s.user?.email === "guest@artisanai.in";

    if (guest) {
      Alert.alert(
        "Login to Place Order / లాగిన్ అవ్వండి",
        "Please sign in to confirm your delivery address and track live ONDC dispatch.\nఆర్డర్ పూర్తి చేయడానికి దయచేసి లాగిన్ అవ్వండి.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Login / Sign In",
            onPress: () =>
              router.push({
                pathname: "/login",
                params: { role: "buyer", redirect: "/buyer-cart" }
              })
          }
        ]
      );
      return;
    }

    if (!deliveryAddress.trim()) {
      Alert.alert("Shipping Address", "Please enter your delivery address.");
      return;
    }

    setOrdering(true);
    try {
      // Place order for each item in cart
      for (const item of items) {
        await api.placeOrder({
          product_id: item.id,
          quantity: item.quantity,
          delivery_address: deliveryAddress.trim(),
          buyer_name: deliveryName.trim() || undefined,
          buyer_phone: deliveryPhone.trim() || undefined
        });
      }

      await clearCart();
      setItems([]);
      Alert.alert(
        "🎉 Order Placed Successfully!",
        "Your handcrafted creations are now scheduled with the artisan for dispatch.",
        [
          {
            text: "View My Orders",
            onPress: () => router.replace("/buyer-orders")
          }
        ]
      );
    } catch (err: any) {
      Alert.alert("Order Failed", err?.detail || err?.message || "Could not place order.");
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Shopping Bag ({items.length})</Text>
        <Pressable
          onPress={() => {
            if (items.length > 0) {
              Alert.alert("Clear Cart", "Remove all items?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear",
                  style: "destructive",
                  onPress: async () => {
                    await clearCart();
                    setItems([]);
                  }
                }
              ]);
            }
          }}
          hitSlop={10}
        >
          <Text style={[styles.clearText, items.length === 0 && { opacity: 0.3 }]}>Clear</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bag-handle-outline" size={48} color={theme.accent} />
          </View>
          <Text style={styles.emptyTitle}>Your Bag is Empty</Text>
          <Text style={styles.emptySub}>
            Discover authentic handcrafted textiles, pottery, and metalwork from certified Indian artisans.
          </Text>
          <Pressable style={styles.exploreBtn} onPress={() => router.replace("/buyer")}>
            <Text style={styles.exploreBtnText}>Explore Marketplace</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Cart Items List */}
          <View style={styles.itemsSection}>
            {items.map((item) => (
              <View key={item.id} style={styles.cartCard}>
                <View style={styles.thumbWrapper}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.thumbnail} resizeMode="cover" />
                  ) : (
                    <View style={styles.noThumb}>
                      <Ionicons name="image-outline" size={24} color={theme.border} />
                    </View>
                  )}
                </View>

                <View style={styles.itemInfo}>
                  <Text style={styles.itemCategory}>{item.category || "Handmade"}</Text>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemPrice}>₹{item.price}</Text>

                  {/* Quantity and Delete Controls */}
                  <View style={styles.controlsRow}>
                    <View style={styles.stepper}>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => handleUpdateQty(item.id, -1)}
                      >
                        <Ionicons name="remove" size={14} color={theme.ink} />
                      </Pressable>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => handleUpdateQty(item.id, 1)}
                      >
                        <Ionicons name="add" size={14} color={theme.ink} />
                      </Pressable>
                    </View>

                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => handleRemove(item.id)}
                      hitSlop={10}
                    >
                      <Ionicons name="trash-outline" size={18} color="#C62828" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Guest Login Alert Banner */}
          {isGuest && (
            <Pressable
              style={styles.guestAlertBanner}
              onPress={() =>
                router.push({
                  pathname: "/login",
                  params: { role: "buyer", redirect: "/buyer-cart" }
                })
              }
            >
              <View style={styles.guestAlertIcon}>
                <Ionicons name="lock-closed" size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.guestAlertTitle}>Login to Place Order</Text>
                <Text style={styles.guestAlertSub}>
                  Sign in with Google or Mobile to confirm address & track ONDC shipment
                </Text>
              </View>
              <View style={styles.guestAlertBtn}>
                <Text style={styles.guestAlertBtnText}>Login</Text>
              </View>
            </Pressable>
          )}

          {/* Shipping Address Card */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="location-outline" size={19} color={theme.accent} style={{ marginRight: 6 }} />
              <Text style={styles.cardTitle}>Delivery Details</Text>
            </View>

            <TextInput
              style={styles.inputField}
              placeholder="Recipient Name"
              placeholderTextColor="#A89F95"
              value={deliveryName}
              onChangeText={setDeliveryName}
            />
            <TextInput
              style={[styles.inputField, { height: 74, textAlignVertical: "top" }]}
              placeholder="Full Shipping Address (House no, Street, City, Pincode)"
              placeholderTextColor="#A89F95"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              multiline
            />
            <TextInput
              style={styles.inputField}
              placeholder="Contact Phone Number"
              placeholderTextColor="#A89F95"
              value={deliveryPhone}
              onChangeText={setDeliveryPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Bill Summary Card */}
          <View style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Price Breakdown</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items Subtotal</Text>
              <Text style={styles.summaryValue}>₹{subtotal}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Artisan Packaging & Insurance</Text>
              <Text style={[styles.summaryValue, { color: "#2E7D32" }]}>FREE</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ONDC Delivery across India</Text>
              <Text style={[styles.summaryValue, { color: "#2E7D32" }]}>FREE</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{grandTotal}</Text>
            </View>
          </View>

          {/* Checkout Button */}
          {isGuest ? (
            <Pressable
              style={[styles.checkoutBtn, { backgroundColor: "#B85D19" }]}
              onPress={handlePlaceOrder}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="log-in-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.checkoutBtnText}>Login to Place Order · ₹{grandTotal}</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.checkoutBtn, ordering && { opacity: 0.7 }]}
              onPress={handlePlaceOrder}
              disabled={ordering}
            >
              {ordering ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                  <Text style={styles.checkoutBtnText}>Confirming Order…</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="shield-checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.checkoutBtnText}>Place Order via ONDC · ₹{grandTotal}</Text>
                </View>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.bg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 10 : 16,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FAF6F0",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.ink
  },
  clearText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.accent
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FAF3EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 8
  },
  emptySub: {
    fontSize: 14,
    color: theme.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 26
  },
  exploreBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14
  },
  exploreBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  itemsSection: {
    marginBottom: 16
  },
  cartCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12
  },
  thumbWrapper: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: "#FAF6F0",
    overflow: "hidden",
    marginRight: 14
  },
  thumbnail: {
    width: "100%",
    height: "100%"
  },
  noThumb: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  itemInfo: {
    flex: 1,
    justifyContent: "space-between"
  },
  itemCategory: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.accent,
    textTransform: "uppercase"
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.ink,
    lineHeight: 18
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.accent
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF6F0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  qtyText: {
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: "800",
    color: theme.ink
  },
  deleteBtn: {
    padding: 4
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 12
  },
  inputField: {
    backgroundColor: "#FAF6F0",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.ink,
    marginBottom: 10
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  summaryLabel: {
    fontSize: 13,
    color: theme.muted
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.ink
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 10
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.ink
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.accent
  },
  checkoutBtn: {
    backgroundColor: theme.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    elevation: 2
  },
  checkoutBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800"
  },
  guestAlertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDF5EE",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0DEC9",
    marginBottom: 16
  },
  guestAlertIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FAEADB",
    alignItems: "center",
    justifyContent: "center"
  },
  guestAlertTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#843B27",
    marginBottom: 2
  },
  guestAlertSub: {
    fontSize: 12,
    color: "#736C65",
    lineHeight: 16
  },
  guestAlertBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 8
  },
  guestAlertBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  }
});
