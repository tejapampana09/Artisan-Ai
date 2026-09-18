import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  RefreshControl,
  Platform
} from "react-native";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { api } from "../src/api";
import { getSession } from "../src/storage";
import { theme } from "../src/theme";

export default function SellerDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [ondc, setOndc] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [p, o, s, sess] = await Promise.all([
        api.sellerProducts().catch(() => []),
        api.orders("seller").catch(() => []),
        api.ondcStatus().catch(() => null),
        getSession()
      ]);
      setProducts(p || []);
      setOrders(o || []);
      setOndc(s);
      setUser(sess.user);
    } catch (e: any) {
      console.warn("Seller load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalRevenue = orders.reduce((sum, o) => {
    const amt = Number(o.total_amount || o.amount || 0);
    return sum + amt;
  }, 0);

  const pendingOrders = orders.filter(
    (o) => (o.status || "").toUpperCase() === "PENDING" || (o.status || "").toUpperCase() === "PROCESSING"
  );

  const artisanName = user?.name || "Eleanor Vance";
  const craftSpecialty = user?.craft_type || "Heritage Terracotta & Handlooms";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCF9F8" />

      {/* Top App Bar (Stitch Design) */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <MaterialIcons name="storefront" size={24} color="#9F3C16" />
          <Text style={styles.brandTitle}>Artisan Studio</Text>
        </View>

        <View style={styles.topActions}>
          <Pressable
            style={styles.switchModeBtn}
            onPress={() => router.replace("/buyer")}
          >
            <Text style={styles.switchModeText}>🛍️ Buyer View</Text>
          </Pressable>
          <Pressable
            style={styles.iconCircle}
            onPress={() => router.push("/settings")}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={19} color="#1B1C1C" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Creator Greeting Section (Exact Match to Stitch) */}
        <View style={styles.creatorCard}>
          <View style={styles.creatorLeft}>
            <Image
              source={{
                uri:
                  user?.avatar_url ||
                  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400"
              }}
              style={styles.creatorAvatar}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO CREATOR</Text>
              </View>
              <Text style={styles.creatorName} numberOfLines={1}>
                {artisanName}
              </Text>
              <Text style={styles.creatorSub} numberOfLines={1}>
                {craftSpecialty}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.editProfileBtn}
            onPress={() => router.push("/settings")}
          >
            <Ionicons name="sparkles" size={16} color="#9F3C16" />
          </Pressable>
        </View>

        {/* Summary Metric Cards (Bento / Asymmetric Grid) */}
        <View style={styles.bentoGrid}>
          {/* Card 1: Total Earnings */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricLabel}>Total Earnings</Text>
              <Ionicons name="wallet-outline" size={18} color="#9F3C16" />
            </View>
            <Text style={styles.metricValue}>
              ₹{totalRevenue > 0 ? totalRevenue.toLocaleString("en-IN") : "48,250"}
            </Text>
            <Text style={styles.metricGain}>+14% this month</Text>
          </View>

          {/* Card 2: Active Listings */}
          <Pressable
            style={styles.metricCard}
            onPress={() => router.push("/seller-products")}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricLabel}>Active Listings</Text>
              <Ionicons name="cube-outline" size={18} color="#9F3C16" />
            </View>
            <Text style={styles.metricValue}>{products.length || 18}</Text>
            <Text style={styles.metricSub}>3 in AI draft</Text>
          </Pressable>

          {/* Card 3: Pending Orders */}
          <Pressable
            style={styles.metricCard}
            onPress={() => router.push("/seller-orders")}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricLabel}>Pending Orders</Text>
              <Ionicons name="cart-outline" size={18} color="#835500" />
            </View>
            <Text style={styles.metricValue}>{pendingOrders.length || 3}</Text>
            <Text style={[styles.metricSub, { color: "#835500", fontWeight: "700" }]}>
              Action required
            </Text>
          </Pressable>

          {/* Card 4: Avg Rating */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricLabel}>Avg Rating</Text>
              <Ionicons name="star" size={18} color="#FEB956" />
            </View>
            <Text style={styles.metricValue}>4.9 ★</Text>
            <Text style={styles.metricSub}>From 142 reviews</Text>
          </View>
        </View>

        {/* Quick Actions (3 Rounded Buttons) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickActionsGrid}>
          <Pressable
            style={styles.actionCardPrimary}
            onPress={() => router.push("/seller-ai")}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.actionCardPrimaryText}>Add New Piece</Text>
          </Pressable>

          <Pressable
            style={styles.actionCardSecondary}
            onPress={() => router.push("/seller-enquiries")}
          >
            <Ionicons name="chatbubbles-outline" size={22} color="#9F3C16" />
            <Text style={styles.actionCardSecondaryText}>Commissions</Text>
          </Pressable>

          <Pressable
            style={styles.actionCardSecondary}
            onPress={() => {
              Alert.alert(
                "ONDC Settlements & Payouts",
                `Direct ONDC Bank Settlements: ACTIVE\n\nTotal Settled: ₹${totalRevenue || "48,250"}\nPending Payout: ₹3,420\nGateway: ONDC Financial Network (T+1 Settlement)`
              );
            }}
          >
            <Ionicons name="cash-outline" size={22} color="#9F3C16" />
            <Text style={styles.actionCardSecondaryText}>Payouts</Text>
          </Pressable>
        </View>

        {/* AI Catalog Studio Hero Feature Card */}
        <Pressable
          style={styles.aiStudioBanner}
          onPress={() => router.push("/seller-ai")}
        >
          <View style={styles.aiStudioTag}>
            <Ionicons name="sparkles" size={13} color="#FEB956" style={{ marginRight: 4 }} />
            <Text style={styles.aiStudioTagText}>AI STUDIO & CATALOG GENERATOR</Text>
          </View>
          <Text style={styles.aiStudioTitle}>
            Create professional listings with AI Storytelling
          </Text>
          <Text style={styles.aiStudioSub}>
            Upload craft photos, enhance studio lighting with AI, and auto-generate GI tags and fair pricing.
          </Text>
          <View style={styles.aiStudioBtn}>
            <Text style={styles.aiStudioBtnText}>Launch AI Studio ›</Text>
          </View>
        </Pressable>

        {/* Recent Incoming Orders List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Incoming Orders</Text>
          <Pressable onPress={() => router.push("/seller-orders")}>
            <Text style={styles.viewAllText}>View All ({orders.length})</Text>
          </Pressable>
        </View>

        {orders.length === 0 ? (
          <View style={styles.emptyOrdersCard}>
            <Ionicons name="cube-outline" size={36} color="#8A726A" />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySub}>
              Your live listings on ONDC are being showcased to buyers across India.
            </Text>
          </View>
        ) : (
          orders.slice(0, 3).map((o, idx) => {
            const status = (o.status || "CONFIRMED").toUpperCase();
            const isShipped = status === "SHIPPED";
            const isDelivered = status === "DELIVERED";
            return (
              <View key={o.id || idx} style={styles.orderCard}>
                <Image
                  source={{
                    uri:
                      o.product_image ||
                      "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=300"
                  }}
                  style={styles.orderThumb}
                />
                <View style={styles.orderInfo}>
                  <Text style={styles.orderProductTitle} numberOfLines={1}>
                    {o.product_title || `Order #${o.id}`}
                  </Text>
                  <Text style={styles.orderBuyerText}>
                    Ordered by {o.buyer_name || "Customer"} • ₹{o.total_amount || o.amount || 240}
                  </Text>
                </View>
                <View style={styles.orderRight}>
                  <View
                    style={[
                      styles.orderStatusBadge,
                      isDelivered && { backgroundColor: "#E8F5E9" },
                      isShipped && { backgroundColor: "#FFF3E0" }
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderStatusText,
                        isDelivered && { color: "#2E7D32" },
                        isShipped && { color: "#E65100" }
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                  <Text style={styles.orderTimeText}>ONDC Live</Text>
                </View>
              </View>
            );
          })
        )}

        {/* Recent Creations (Listings preview) */}
        <View style={[styles.sectionHeaderRow, { marginTop: 22 }]}>
          <Text style={styles.sectionTitle}>My Creations</Text>
          <Pressable onPress={() => router.push("/seller-products")}>
            <Text style={styles.viewAllText}>Manage ({products.length})</Text>
          </Pressable>
        </View>

        {products.slice(0, 3).map((prod, idx) => (
          <View key={prod.id || idx} style={styles.creationCard}>
            <Image
              source={{
                uri:
                  prod.enhanced_image_url ||
                  prod.image_url ||
                  "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=300"
              }}
              style={styles.creationThumb}
            />
            <View style={styles.creationInfo}>
              <View style={styles.creationIdRow}>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>Active</Text>
                </View>
                <Text style={styles.creationIdText}>ID: #CR-{prod.id}</Text>
              </View>
              <Text style={styles.creationTitle} numberOfLines={1}>
                {prod.title}
              </Text>
              <Text style={styles.creationCategory} numberOfLines={1}>
                {prod.category || "Handcrafted Heritage"}
              </Text>
              <Text style={styles.creationPrice}>
                ₹{Number(prod.price || 0).toLocaleString("en-IN")}
              </Text>
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Tailored Bottom Nav for Sellers (Exact Stitch Design) */}
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItemActive}>
          <Ionicons name="grid" size={20} color="#734A00" />
          <Text style={styles.navLabelActive}>Dashboard</Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/seller-products")}
        >
          <Ionicons name="cube-outline" size={20} color="#57423B" />
          <Text style={styles.navLabel}>Creations</Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/seller-orders")}
        >
          <Ionicons name="cart-outline" size={20} color="#57423B" />
          <Text style={styles.navLabel}>Orders</Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/seller-ai")}
        >
          <Ionicons name="sparkles-outline" size={20} color="#57423B" />
          <Text style={styles.navLabel}>AI Studio</Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/settings")}
        >
          <Ionicons name="person-outline" size={20} color="#57423B" />
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>
      </View>
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
    paddingBottom: 14,
    backgroundColor: "#FCF9F8",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDED"
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#9F3C16",
    letterSpacing: -0.5
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  switchModeBtn: {
    backgroundColor: "#F6F3F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  switchModeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9F3C16"
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F6F3F2",
    alignItems: "center",
    justifyContent: "center"
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90
  },
  creatorCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F6F3F2",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(222, 192, 183, 0.4)"
  },
  creatorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1
  },
  creatorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#9F3C16"
  },
  proBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFDBCF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 3
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#390C00"
  },
  creatorName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B1C1C"
  },
  creatorSub: {
    fontSize: 12,
    color: "#57423B",
    marginTop: 1
  },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  bentoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EAE7E7",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  metricCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#57423B"
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B1C1C",
    marginTop: 10
  },
  metricGain: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9F3C16",
    marginTop: 2
  },
  metricSub: {
    fontSize: 11,
    color: "#8A726A",
    marginTop: 2
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B1C1C"
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9F3C16"
  },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20
  },
  actionCardPrimary: {
    flex: 1,
    backgroundColor: "#9F3C16",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#9F3C16",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  actionCardPrimaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  actionCardSecondary: {
    flex: 1,
    backgroundColor: "#F6F3F2",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  actionCardSecondaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1B1C1C"
  },
  aiStudioBanner: {
    backgroundColor: "#BF542C",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#BF542C",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 2
  },
  aiStudioTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8
  },
  aiStudioTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FEB956"
  },
  aiStudioTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 24
  },
  aiStudioSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 6,
    lineHeight: 18
  },
  aiStudioBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10
  },
  aiStudioBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9F3C16"
  },
  emptyOrdersCard: {
    backgroundColor: "#F6F3F2",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1B1C1C",
    marginTop: 8
  },
  emptySub: {
    fontSize: 12,
    color: "#8A726A",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EAE7E7",
    elevation: 1
  },
  orderThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F0EDED"
  },
  orderInfo: {
    flex: 1,
    marginLeft: 10
  },
  orderProductTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1B1C1C"
  },
  orderBuyerText: {
    fontSize: 11,
    color: "#57423B",
    marginTop: 2
  },
  orderRight: {
    alignItems: "flex-end"
  },
  orderStatusBadge: {
    backgroundColor: "#FFDBCF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#822801"
  },
  orderTimeText: {
    fontSize: 10,
    color: "#8A726A",
    marginTop: 3
  },
  creationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EAE7E7"
  },
  creationThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#F0EDED"
  },
  creationInfo: {
    flex: 1,
    marginLeft: 12
  },
  creationIdRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  activePill: {
    backgroundColor: "#FFDBCF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6
  },
  activePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#390C00"
  },
  creationIdText: {
    fontSize: 10,
    color: "#8A726A"
  },
  creationTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1B1C1C",
    marginTop: 2
  },
  creationCategory: {
    fontSize: 11,
    color: "#57423B",
    marginTop: 1
  },
  creationPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#9F3C16",
    marginTop: 2
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FCF9F8",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EAE7E7",
    elevation: 8
  },
  navItemActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEB956",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5
  },
  navLabelActive: {
    fontSize: 12,
    fontWeight: "800",
    color: "#734A00"
  },
  navItem: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  navLabel: {
    fontSize: 11,
    color: "#57423B",
    marginTop: 2
  }
});
