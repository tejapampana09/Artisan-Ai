import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  ActivityIndicator
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";
import {
  Screen,
  Header,
  BottomNavigation,
  Card,
  StatusBadge,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  OutlineButton
} from "../src/components";
import { useRoleGuard } from "../src/authGuard";

const ORDER_STATUSES = [
  { label: "Confirmed", value: "CONFIRMED", icon: "checkmark-circle-outline", color: theme.colors.info },
  { label: "In Production", value: "PROCESSING", icon: "hammer-outline", color: theme.colors.accent },
  { label: "Dispatched", value: "SHIPPED", icon: "airplane-outline", color: theme.colors.warning },
  { label: "Delivered", value: "DELIVERED", icon: "home-outline", color: theme.colors.success },
  { label: "Cancelled", value: "CANCELLED", icon: "close-circle-outline", color: theme.colors.error }
];

export default function SellerOrders() {
  useRoleGuard("seller");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "SHIPPED" | "DELIVERED">("ALL");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.orders("seller");
      setOrders(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Unable to load orders", e?.message || "Please check your network connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await api.updateOrderStatus(selectedOrder.id, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: newStatus } : o))
      );
      setSelectedOrder(null);
      Alert.alert("Status Updated", `Order #${selectedOrder.id} is now marked as ${newStatus}.`);
    } catch (e: any) {
      Alert.alert("Update Failed", e?.detail || e?.message || "Could not update status.");
    } finally {
      setUpdating(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const st = (o.status || "").toUpperCase();
    if (filter === "ALL") return true;
    if (filter === "PENDING") return st === "PENDING" || st === "PROCESSING" || st === "CONFIRMED";
    if (filter === "SHIPPED") return st === "SHIPPED";
    if (filter === "DELIVERED") return st === "DELIVERED";
    return true;
  });

  return (
    <Screen scrollable={false} safeArea={false}>
      <Header
        title="Incoming Orders"
        subtitle={`${orders.length} direct orders received`}
        showBack={false}
        rightAction={{
          icon: "refresh-outline",
          onPress: fetchOrders
        }}
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(["ALL", "PENDING", "SHIPPED", "DELIVERED"] as const).map((tab) => {
          const isActive = filter === tab;
          const count = orders.filter((o) => {
            const st = (o.status || "").toUpperCase();
            if (tab === "ALL") return true;
            if (tab === "PENDING") return st === "PENDING" || st === "PROCESSING" || st === "CONFIRMED";
            if (tab === "SHIPPED") return st === "SHIPPED";
            if (tab === "DELIVERED") return st === "DELIVERED";
            return true;
          }).length;

          return (
            <Pressable
              key={tab}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {tab === "ALL" ? `All (${orders.length})` : `${tab} (${count})`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={fetchOrders}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="receipt-outline"
              title="No Orders Found"
              description={
                filter === "ALL"
                  ? "Orders from marketplace buyers and ONDC channels will appear here automatically."
                  : `No orders currently matching the '${filter}' state.`
              }
            />
          ) : null
        }
        renderItem={({ item }) => {
          const total = Number(item.total_amount || item.amount || 0);
          const status = (item.status || "CONFIRMED").toUpperCase();

          return (
            <Card style={styles.orderCard}>
              <View style={styles.orderHead}>
                <View>
                  <Text style={styles.orderNumber}>Order #{item.id}</Text>
                  <Text style={styles.orderDate}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent Order"}
                  </Text>
                </View>
                <StatusBadge status={status} />
              </View>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color={theme.colors.inkMuted} />
                <Text style={styles.detailText}>
                  Buyer: <Text style={styles.detailBold}>{item.buyer_name || "Verified Patron"}</Text>
                </Text>
              </View>

              {item.delivery_address ? (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={16} color={theme.colors.inkMuted} />
                  <Text style={styles.detailText} numberOfLines={2}>
                    {item.delivery_address}
                  </Text>
                </View>
              ) : null}

              <View style={styles.orderFooter}>
                <View>
                  <Text style={styles.payoutLabel}>Total Value</Text>
                  <Text style={styles.payoutValue}>₹{total.toLocaleString("en-IN")}</Text>
                </View>

                <View style={styles.actionButtonGroup}>
                  <SecondaryButton
                    title="Update Status"
                    size="small"
                    icon="swap-horizontal-outline"
                    onPress={() => setSelectedOrder(item)}
                  />
                </View>
              </View>
            </Card>
          );
        }}
      />

      {/* Status Update Modal */}
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order #{selectedOrder?.id} Dispatch</Text>
              <Pressable onPress={() => setSelectedOrder(null)}>
                <Ionicons name="close" size={24} color={theme.colors.ink} />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>
              Select the new fulfillment status for this customer's craft order:
            </Text>

            <View style={styles.statusOptions}>
              {ORDER_STATUSES.map((st) => {
                const isSelected = selectedOrder?.status?.toUpperCase() === st.value;
                return (
                  <Pressable
                    key={st.value}
                    style={[styles.statusItem, isSelected && styles.statusItemActive]}
                    onPress={() => handleUpdateStatus(st.value)}
                    disabled={updating}
                  >
                    <View style={[styles.statusIconBox, { backgroundColor: st.color + "18" }]}>
                      <Ionicons name={st.icon as any} size={20} color={st.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.statusLabel, isSelected && styles.statusLabelActive]}>
                        {st.label}
                      </Text>
                      <Text style={styles.statusCode}>{st.value}</Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.inkMuted} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {updating && (
              <View style={styles.updatingOverlay}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.updatingText}>Updating order status on server...</Text>
              </View>
            )}

            <OutlineButton
              title="Close"
              style={{ marginTop: 12 }}
              onPress={() => setSelectedOrder(null)}
            />
          </View>
        </View>
      </Modal>

      <BottomNavigation role="seller" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceVariant
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary
  },
  filterChipText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    fontWeight: "600"
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100
  },
  orderCard: {
    marginBottom: theme.spacing.md
  },
  orderHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  orderNumber: {
    ...theme.typography.h3,
    color: theme.colors.ink
  },
  orderDate: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6
  },
  detailText: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkLight,
    flex: 1
  },
  detailBold: {
    color: theme.colors.ink,
    fontWeight: "600"
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  payoutLabel: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted
  },
  payoutValue: {
    ...theme.typography.h3,
    color: theme.colors.primary
  },
  actionButtonGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    paddingBottom: 36
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  modalTitle: {
    ...theme.typography.h3,
    color: theme.colors.ink
  },
  modalSub: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkMuted,
    marginBottom: 16
  },
  statusOptions: {
    gap: 8
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceVariant,
    gap: 12
  },
  statusItemActive: {
    backgroundColor: theme.colors.primaryLight + "15",
    borderWidth: 1.5,
    borderColor: theme.colors.primary
  },
  statusIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  statusLabel: {
    ...theme.typography.subtitle,
    color: theme.colors.ink
  },
  statusLabelActive: {
    color: theme.colors.primary,
    fontWeight: "700"
  },
  statusCode: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted
  },
  updatingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginVertical: 12
  },
  updatingText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: "600"
  }
});
