import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Image,
  Alert
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";

export default function SellerOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "SHIPPED" | "DELIVERED">("ALL");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.orders("seller");
      setOrders(data || []);
    } catch (e: any) {
      Alert.alert("Error", e?.detail || e?.message || "Could not load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredOrders = orders.filter((o) => {
    const status = (o.status || "").toUpperCase();
    if (activeTab === "ALL") return true;
    if (activeTab === "PENDING") return status === "PENDING" || status === "PROCESSING" || status === "CONFIRMED";
    if (activeTab === "SHIPPED") return status === "SHIPPED";
    if (activeTab === "DELIVERED") return status === "DELIVERED";
    return true;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCF9F8" />

      {/* Top App Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color="#9F3C16" />
        </Pressable>
        <Text style={styles.topBarTitle}>Incoming Orders</Text>
        <Pressable onPress={load} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="reload" size={18} color="#57423B" />
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {(["ALL", "PENDING", "SHIPPED", "DELIVERED"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === tab && styles.tabPillTextActive
              ]}
            >
              {tab === "ALL" ? `All (${orders.length})` : tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#9F3C16" />
          <Text style={styles.loadingText}>Fetching order dispatch stream…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item, idx) => String(item.id || idx)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color="#DEC0B7" />
              <Text style={styles.emptyTitle}>No orders in this state</Text>
              <Text style={styles.emptySub}>
                When customers purchase your handcrafted pieces via ONDC, their orders appear here in real time.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = (item.status || "CONFIRMED").toUpperCase();
            const isDelivered = status === "DELIVERED";
            const isShipped = status === "SHIPPED";
            const total = Number(item.total_amount || item.amount || 0);

            return (
              <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderIdText}>Order #{item.id}</Text>
                    <Text style={styles.orderDateText}>
                      {item.created_at || "Scheduled for Dispatch"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      isDelivered && { backgroundColor: "#E8F5E9" },
                      isShipped && { backgroundColor: "#FFF3E0" }
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isDelivered && { color: "#2E7D32" },
                        isShipped && { color: "#E65100" }
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.buyerRow}>
                  <Ionicons name="person-outline" size={16} color="#8A726A" style={{ marginRight: 6 }} />
                  <Text style={styles.buyerNameText}>
                    Buyer:{" "}
                    <Text style={{ fontWeight: "700", color: "#1B1C1C" }}>
                      {item.buyer_name || "Verified Customer"}
                    </Text>
                  </Text>
                </View>

                {item.delivery_address && (
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={16} color="#8A726A" style={{ marginRight: 6 }} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {item.delivery_address}
                    </Text>
                  </View>
                )}

                <View style={styles.orderFooter}>
                  <View>
                    <Text style={styles.ondcLabel}>ONDC Logistics Guarantee</Text>
                    <Text style={styles.priceAmount}>
                      ₹{total.toLocaleString("en-IN")}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.dispatchBtn}
                    onPress={() => {
                      Alert.alert(
                        `Order #${item.id} Details`,
                        `Buyer: ${item.buyer_name || "Customer"}\nPhone: ${item.buyer_phone || "Protected via ONDC"}\nAddress: ${item.delivery_address || "Provided on shipping label"}\n\nStatus: ${status}\nLogistics: ONDC Direct Artisan Dispatch`
                      );
                    }}
                  >
                    <Text style={styles.dispatchBtnText}>Manage Order</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FCF9F8"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 10 : 12,
    paddingBottom: 12,
    backgroundColor: "#FCF9F8",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDED"
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F6F3F2",
    alignItems: "center",
    justifyContent: "center"
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#9F3C16"
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8
  },
  tabPill: {
    backgroundColor: "#EAE7E7",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20
  },
  tabPillActive: {
    backgroundColor: "#9F3C16"
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#57423B"
  },
  tabPillTextActive: {
    color: "#FFFFFF"
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(222, 192, 183, 0.4)",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B1C1C"
  },
  orderDateText: {
    fontSize: 11,
    color: "#8A726A",
    marginTop: 2
  },
  statusPill: {
    backgroundColor: "#FFDBCF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#822801"
  },
  divider: {
    height: 1,
    backgroundColor: "#F0EDED",
    marginVertical: 12
  },
  buyerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6
  },
  buyerNameText: {
    fontSize: 13,
    color: "#57423B"
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: "#8A726A",
    lineHeight: 16
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0EDED"
  },
  ondcLabel: {
    fontSize: 10,
    color: "#2E7D32",
    fontWeight: "700"
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: "900",
    color: "#9F3C16",
    marginTop: 2
  },
  dispatchBtn: {
    backgroundColor: "#F6F3F2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  dispatchBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9F3C16"
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30
  },
  loadingText: {
    fontSize: 13,
    color: "#8A726A",
    marginTop: 10
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 40
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B1C1C",
    marginTop: 12
  },
  emptySub: {
    fontSize: 13,
    color: "#8A726A",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18
  }
});
