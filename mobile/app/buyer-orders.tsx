import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  RefreshControl,
  Image,
  Platform,
  StatusBar,
  Alert,
  Modal,
  TextInput
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";

export default function BuyerOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DELIVERED">("ALL");

  // Review states
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [targetOrderForReview, setTargetOrderForReview] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<number>>(new Set());

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await api.orders();
      setOrders(data || []);
    } catch (err: any) {
      console.warn("Orders load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleOpenReviewModal = (order: any) => {
    setTargetOrderForReview(order);
    setReviewRating(5);
    setReviewComment("");
    setReviewModalVisible(true);
  };

  const handleSubmitReview = async () => {
    if (!targetOrderForReview) return;
    setSubmittingReview(true);
    try {
      await api.submitReview(targetOrderForReview.product_id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
        order_id: targetOrderForReview.id
      });
      setReviewedOrderIds((prev) => new Set([...prev, targetOrderForReview.id]));
      setReviewModalVisible(false);
      Alert.alert(
        "Verified Review Published",
        "Thank you! Your verified customer review has been published directly on this craft's page."
      );
    } catch (err: any) {
      Alert.alert(
        "Review Submission Failed",
        err?.detail || err?.message || "Could not submit review."
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCancelOrder = (orderId: number) => {
    Alert.alert(
      "Cancel Order",
      `Are you sure you want to cancel Order #${orderId}?`,
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await api.cancelBuyerOrder(orderId);
              setOrders((prev) =>
                prev.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" } : o))
              );
              Alert.alert("Order Cancelled", `Order #${orderId} has been cancelled.`);
            } catch (err: any) {
              Alert.alert("Cancellation Failed", err?.detail || err?.message || "Could not cancel order.");
            }
          }
        }
      ]
    );
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "ALL") return true;
    const status = (o.status || "").toUpperCase();
    if (statusFilter === "ACTIVE") return status !== "DELIVERED" && status !== "CANCELLED";
    if (statusFilter === "DELIVERED") return status === "DELIVERED";
    return true;
  });

  const getStatusBadge = (status: string = "CONFIRMED") => {
    const s = status.toUpperCase();
    if (s === "DELIVERED") {
      return { bg: "#E8F5E9", color: "#2E7D32", label: "Delivered" };
    }
    if (s === "DISPATCHED" || s === "IN_TRANSIT") {
      return { bg: "#E3F2FD", color: "#1565C0", label: "In Transit" };
    }
    if (s === "CANCELLED") {
      return { bg: "#FFEBEE", color: "#C62828", label: "Cancelled" };
    }
    return { bg: "#FFF8E1", color: "#F57F17", label: "Artisan Preparing" };
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
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
        <Text style={styles.headerTitle}>My Orders</Text>
        <Pressable
          style={styles.cartIconBtn}
          onPress={() => router.push("/buyer-cart")}
          hitSlop={10}
        >
          <Ionicons name="bag-handle-outline" size={20} color={theme.ink} />
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {(["ALL", "ACTIVE", "DELIVERED"] as const).map((tab) => {
          const active = statusFilter === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.filterTab, active && styles.filterTabActive]}
              onPress={() => setStatusFilter(tab)}
            >
              <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                {tab === "ALL" ? "All Orders" : tab === "ACTIVE" ? "In Progress" : "Delivered"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Retrieving your orders…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadOrders();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="cube-outline" size={44} color={theme.accent} />
              </View>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySub}>
                When you order handcrafted items from our master artisans, your tracking and status will appear here.
              </Text>
              <Pressable style={styles.exploreBtn} onPress={() => router.replace("/buyer")}>
                <Text style={styles.exploreBtnText}>Browse Artisan Collection</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const total = item.total_price ?? item.total_amount ?? item.amount ?? "—";
            const orderDate = item.created_at
              ? new Date(item.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })
              : "Recent Order";

            return (
              <View style={styles.orderCard}>
                {/* Order Top Header */}
                <View style={styles.cardTopRow}>
                  <View>
                    <Text style={styles.orderId}>Order #{item.id ?? "—"}</Text>
                    <Text style={styles.orderDate}>{orderDate}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Product Summary */}
                <View style={styles.productRow}>
                  <View style={styles.thumbBox}>
                    <Ionicons name="sparkles" size={20} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.product_title || item.title || `Handcrafted Product #${item.product_id || ""}`}
                    </Text>
                    <Text style={styles.qtyText}>Qty: {item.quantity || 1} · Fair Artisan Direct</Text>
                  </View>
                  <Text style={styles.totalPrice}>₹{total}</Text>
                </View>

                {/* Tracking Progress Dots */}
                <View style={styles.trackerContainer}>
                  <View style={styles.trackerStep}>
                    <View style={[styles.stepDot, styles.stepDotDone]} />
                    <Text style={styles.stepLabel}>Confirmed</Text>
                  </View>
                  <View style={styles.trackerLine} />
                  <View style={styles.trackerStep}>
                    <View
                      style={[
                        styles.stepDot,
                        item.status !== "PENDING" && styles.stepDotDone
                      ]}
                    />
                    <Text style={styles.stepLabel}>Artisan Crafting</Text>
                  </View>
                  <View style={styles.trackerLine} />
                  <View style={styles.trackerStep}>
                    <View
                      style={[
                        styles.stepDot,
                        (item.status === "DISPATCHED" || item.status === "DELIVERED") &&
                          styles.stepDotDone
                      ]}
                    />
                    <Text style={styles.stepLabel}>Dispatched</Text>
                  </View>
                  <View style={styles.trackerLine} />
                  <View style={styles.trackerStep}>
                    <View
                      style={[
                        styles.stepDot,
                        item.status === "DELIVERED" && styles.stepDotDone
                      ]}
                    />
                    <Text style={styles.stepLabel}>Delivered</Text>
                  </View>
                </View>

                {/* Shipping Location */}
                {item.delivery_address && (
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={14} color={theme.muted} style={{ marginRight: 4 }} />
                    <Text style={styles.addressText} numberOfLines={1}>
                      Ship to: {item.delivery_address}
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  {/* Cancel for Pending */}
                  {["CONFIRMED", "PROCESSING", "PENDING"].includes((item.status || "").toUpperCase()) && (
                    <Pressable
                      style={[styles.helpBtn, { borderColor: "#FFCDD2" }]}
                      onPress={() => handleCancelOrder(item.id)}
                    >
                      <Ionicons name="close-circle-outline" size={14} color="#C62828" style={{ marginRight: 4 }} />
                      <Text style={[styles.helpBtnText, { color: "#C62828" }]}>Cancel Order</Text>
                    </Pressable>
                  )}

                  {/* Review Button for Delivered Orders */}
                  {(item.status || "").toUpperCase() === "DELIVERED" && (
                    <Pressable
                      style={[
                        styles.helpBtn,
                        {
                          borderColor: "#F59E0B",
                          backgroundColor: reviewedOrderIds.has(item.id) ? "#F3F4F6" : "#FFFBEB"
                        }
                      ]}
                      onPress={() => handleOpenReviewModal(item)}
                      disabled={reviewedOrderIds.has(item.id)}
                    >
                      <Ionicons
                        name={reviewedOrderIds.has(item.id) ? "checkmark-circle" : "star"}
                        size={14}
                        color={reviewedOrderIds.has(item.id) ? "#10B981" : "#F59E0B"}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.helpBtnText,
                          {
                            color: reviewedOrderIds.has(item.id) ? "#10B981" : "#B45309",
                            fontWeight: "800"
                          }
                        ]}
                      >
                        {reviewedOrderIds.has(item.id) ? "Reviewed ✓" : "Write Review"}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={styles.helpBtn}
                    onPress={() => router.push("/buyer-assistant")}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.accent} style={{ marginRight: 4 }} />
                    <Text style={styles.helpBtnText}>Order Assistant</Text>
                  </Pressable>
                  <Pressable
                    style={styles.reorderBtn}
                    onPress={() => router.push("/buyer")}
                  >
                    <Text style={styles.reorderBtnText}>Buy Again</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Verified Review Submission Modal */}
      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 20, marginRight: 6 }}>⭐</Text>
                <Text style={styles.modalTitle}>Rate & Review Craft</Text>
              </View>
              <Pressable onPress={() => setReviewModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={theme.ink} />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>
              Share your experience as a verified collector of{" "}
              <Text style={{ fontWeight: "800", color: theme.ink }}>
                {targetOrderForReview?.product_title || "this handcrafted item"}
              </Text>
              :
            </Text>

            {/* Interactive 5-Star Selector */}
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setReviewRating(star)}
                  style={styles.starPressable}
                  hitSlop={8}
                >
                  <Ionicons
                    name={star <= reviewRating ? "star" : "star-outline"}
                    size={36}
                    color="#F59E0B"
                  />
                </Pressable>
              ))}
            </View>

            <Text style={styles.ratingText}>
              {reviewRating === 5
                ? "⭐⭐⭐⭐⭐ Exceptional Masterpiece"
                : reviewRating === 4
                ? "⭐⭐⭐⭐ Very High Quality"
                : reviewRating === 3
                ? "⭐⭐⭐ Good Authentic Craft"
                : reviewRating === 2
                ? "⭐⭐ Needs Improvement"
                : "⭐ Disappointed"}
            </Text>

            {/* Review Comment Input */}
            <TextInput
              style={styles.commentInput}
              placeholder="What did you love about the craft, texture, materials, or artisan's packaging?..."
              placeholderTextColor={theme.muted}
              multiline
              numberOfLines={4}
              value={reviewComment}
              onChangeText={setReviewComment}
              textAlignVertical="top"
            />

            {/* Submit & Cancel Buttons */}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.submitReviewBtn, submittingReview && { opacity: 0.7 }]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitReviewBtnText}>Publish Verified Review</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.cancelReviewBtn}
                onPress={() => setReviewModalVisible(false)}
                disabled={submittingReview}
              >
                <Text style={styles.cancelReviewBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 10 : 16,
    paddingBottom: 14,
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
  cartIconBtn: {
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
  filterBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#FAF6F0"
  },
  filterTabActive: {
    backgroundColor: theme.accent
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.muted
  },
  filterTabTextActive: {
    color: "#fff"
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: theme.muted
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FAF3EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 6
  },
  emptySub: {
    fontSize: 13,
    color: theme.muted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 22
  },
  exploreBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12
  },
  exploreBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F4ECE2"
  },
  orderId: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.ink
  },
  orderDate: {
    fontSize: 11,
    color: theme.muted,
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800"
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14
  },
  thumbBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FAF3EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 3
  },
  qtyText: {
    fontSize: 12,
    color: theme.muted
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.accent,
    marginLeft: 10
  },
  trackerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF6F0",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12
  },
  trackerStep: {
    alignItems: "center"
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.border,
    marginBottom: 4
  },
  stepDotDone: {
    backgroundColor: theme.accent
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: theme.muted
  },
  trackerLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.border,
    marginHorizontal: 4,
    marginTop: -12
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14
  },
  addressText: {
    fontSize: 11,
    color: theme.muted
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  helpBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff"
  },
  helpBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.accent
  },
  reorderBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10
  },
  reorderBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "85%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.ink
  },
  modalSub: {
    fontSize: 13,
    color: theme.muted,
    lineHeight: 18,
    marginBottom: 16
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 10
  },
  starPressable: {
    padding: 4
  },
  ratingText: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 16
  },
  commentInput: {
    backgroundColor: "#FAF6F0",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    padding: 14,
    fontSize: 13,
    color: theme.ink,
    minHeight: 90,
    marginBottom: 18
  },
  modalActions: {
    gap: 10
  },
  submitReviewBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center"
  },
  submitReviewBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  },
  cancelReviewBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border
  },
  cancelReviewBtnText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: "700"
  }
});
