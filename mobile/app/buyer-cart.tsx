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
  StatusBar,
  Modal
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
  const [showLoginModal, setShowLoginModal] = useState(false);
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
      setShowLoginModal(true);
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
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/buyer");
          }}
          hitSlop={10}
        >
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
              onPress={() => setShowLoginModal(true)}
            >
              <View style={styles.guestAlertIcon}>
                <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <Text style={styles.guestAlertTitle}>Login to Place Order</Text>
                  <View style={styles.guestTag}>
                    <Text style={styles.guestTagText}>Sign In</Text>
                  </View>
                </View>
                <Text style={styles.guestAlertSub}>
                  Sign in with Google or Mobile to autofill address & track live ONDC dispatch.
                </Text>
              </View>
              <View style={styles.guestAlertBtn}>
                <Text style={styles.guestAlertBtnText}>Sign In →</Text>
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
              style={[styles.checkoutBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowLoginModal(true)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="log-in-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.checkoutBtnText}>Sign In to Place Order · ₹{grandTotal}</Text>
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

      {/* Premium Heritage Login to Place Order Bottom Sheet Modal */}
      <Modal
        visible={showLoginModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLoginModal(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetBadge}>
                <Ionicons name="shield-checkmark" size={13} color={theme.colors.primary} />
                <Text style={styles.sheetBadgeText}>ONDC SECURE CHECKOUT</Text>
              </View>
              <Pressable
                style={styles.sheetCloseBtn}
                onPress={() => setShowLoginModal(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color={theme.colors.inkMuted} />
              </Pressable>
            </View>

            <View style={styles.sheetIconWrapper}>
              <View style={styles.sheetIconCircle}>
                <Ionicons name="bag-check" size={30} color={theme.colors.primary} />
              </View>
            </View>

            <Text style={styles.sheetTitle}>Sign In to Place Order</Text>
            <Text style={styles.sheetSubtitle}>
              Please sign in to complete your checkout and track live dispatch
            </Text>

            <Text style={styles.sheetDescription}>
              Sign in with your account to verify delivery details, connect directly with rural master artisans, and unlock live ONDC order tracking.
            </Text>

            {/* Value Props Checklist */}
            <View style={styles.sheetBenefitsBox}>
              <View style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color="#2E7D32" style={{ marginTop: 1 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.benefitTitle}>100% Direct Artisan Benefit</Text>
                  <Text style={styles.benefitSubtitle}>100% of proceeds go directly to rural craft masters</Text>
                </View>
              </View>
              <View style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color="#2E7D32" style={{ marginTop: 1 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.benefitTitle}>Live ONDC Order Tracking & SMS</Text>
                  <Text style={styles.benefitSubtitle}>Real-time dispatch updates and delivery notifications</Text>
                </View>
              </View>
              <View style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color="#2E7D32" style={{ marginTop: 1 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.benefitTitle}>Verified Heritage Guarantee</Text>
                  <Text style={styles.benefitSubtitle}>Secure delivery, authentic crafts & certified GI tags</Text>
                </View>
              </View>
            </View>

            {/* Order total pill */}
            <View style={styles.orderSummaryPill}>
              <Text style={styles.orderSummaryLabel}>Cart Total:</Text>
              <Text style={styles.orderSummaryValue}>₹{grandTotal}</Text>
            </View>

            {/* Action Buttons */}
            <Pressable
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setShowLoginModal(false);
                router.push({
                  pathname: "/login",
                  params: { role: "buyer", redirect: "/buyer-cart" }
                });
              }}
            >
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.modalPrimaryBtnText}>Sign In to Continue →</Text>
            </Pressable>

            <Pressable
              style={styles.modalSecondaryBtn}
              onPress={() => setShowLoginModal(false)}
            >
              <Text style={styles.modalSecondaryBtnText}>Review Bag</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    backgroundColor: "#FDF6F0",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EED8C5",
    marginBottom: 16
  },
  guestAlertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FBF3F0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  guestAlertTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1C1C1C"
  },
  guestTag: {
    backgroundColor: "#FBF3F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  guestTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9F3C16"
  },
  guestAlertSub: {
    fontSize: 12,
    color: "#6B5B51",
    lineHeight: 16
  },
  guestAlertBtn: {
    backgroundColor: "#9F3C16",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8
  },
  guestAlertBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(28, 28, 28, 0.6)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#FAF9F6",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1C7BD",
    alignSelf: "center",
    marginBottom: 16
  },
  sheetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  sheetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FBF3F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  sheetBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9F3C16",
    letterSpacing: 0.5
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0EDED",
    alignItems: "center",
    justifyContent: "center"
  },
  sheetIconWrapper: {
    alignItems: "center",
    marginBottom: 12
  },
  sheetIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FBF3F0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#DEC0B7"
  },
  sheetTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#1C1C1C",
    textAlign: "center",
    letterSpacing: -0.3
  },
  sheetSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9F3C16",
    textAlign: "center",
    marginTop: 3,
    marginBottom: 8
  },
  sheetDescription: {
    fontSize: 13,
    color: "#6B5B51",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 16
  },
  sheetBenefitsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 14
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1C"
  },
  benefitSubtitle: {
    fontSize: 11,
    color: "#8A726A",
    marginTop: 1
  },
  orderSummaryPill: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F5F3EF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14
  },
  orderSummaryLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B5B51"
  },
  orderSummaryValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#9F3C16"
  },
  modalPrimaryBtn: {
    backgroundColor: "#9F3C16",
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    marginBottom: 8
  },
  modalPrimaryBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  modalSecondaryBtn: {
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  modalSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8A726A"
  }
});
