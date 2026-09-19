import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  RefreshControl,
  ScrollView
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { api } from "../src/api";
import { getSession } from "../src/storage";
import { theme } from "../src/theme";
import { clearSession } from "../src/storage";
import {
  Screen,
  Header,
  BottomNavigation,
  StatCard,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  EmptyState,
  ErrorState,
  SkeletonBox,
  SectionHeader
} from "../src/components";

export default function SellerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = async () => {
    setErrorMessage("");
    try {
      const [sess, dash, read, opps, ords] = await Promise.all([
        getSession("STUDIO"),
        api.sellerDashboard().catch(() => null),
        api.sellerReadiness().catch(() => null),
        api.sellerOpportunities().catch(() => null),
        api.orders("seller").catch(() => [])
      ]);

      setUser(sess.user);
      setDashboard(dash);
      setReadiness(read);
      setOpportunities(opps);
      setOrders(ords || []);
    } catch (err: any) {
      setErrorMessage(err?.detail || err?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const artisanName = user?.name || "Verified Artisan";
  const craftSpecialty = user?.craft || user?.craft_specialization || "Authentic Handcrafted Heritage";
  const avatarUrl =
    user?.avatar_url ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(artisanName)}`;

  const totalRevenue = dashboard?.total_revenue ?? 0;
  const unitsSold = dashboard?.units_sold ?? 0;
  const totalOrders = dashboard?.total_orders ?? orders.length;
  const totalViews = dashboard?.total_views ?? 0;
  const totalEnquiries = dashboard?.total_enquiries ?? 0;
  const deliveryStatus = dashboard?.delivery_status || {
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  };

  const pendingOrders = orders.filter((o) => {
    const s = (o.status || "").toUpperCase();
    return s === "CONFIRMED" || s === "PROCESSING" || s === "PENDING";
  });

  return (
    <Screen
      scrollable
      refreshing={refreshing}
      onRefresh={onRefresh}
      withBottomNavPadding
      contentContainerStyle={styles.container}
    >
      {/* Header */}
      <Header
        title="Artisan Studio"
        subtitle="Sovereign Rural Craft Commerce"
        roleBadge="ARTISAN"
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              style={styles.switchModeBtn}
              onPress={async () => {
                await clearSession("STUDIO");
                router.replace({ pathname: "/login", params: { role: "buyer", redirect: "/buyer" } });
              }}
              accessibilityRole="button"
              accessibilityLabel="Switch to Buyer View"
            >
              <Text style={styles.switchModeText}>🛍️ Buyer View</Text>
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              onPress={() => router.push("/settings")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={18} color={theme.colors.ink} />
            </Pressable>
          </View>
        }
      />

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <SkeletonBox height={90} borderRadius={theme.radius.lg} style={{ marginBottom: 16 }} />
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <SkeletonBox height={90} style={{ flex: 1 }} borderRadius={theme.radius.md} />
            <SkeletonBox height={90} style={{ flex: 1 }} borderRadius={theme.radius.md} />
          </View>
          <SkeletonBox height={140} borderRadius={theme.radius.lg} style={{ marginBottom: 16 }} />
        </View>
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onRetry={loadData} />
      ) : (
        <>
          {/* Artisan Profile Card */}
          <View style={styles.profileCard}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
            <View style={styles.profileInfo}>
              <View style={styles.verifiedRow}>
                <Text style={styles.verifiedBadge}>VERIFIED MASTER ARTISAN</Text>
              </View>
              <Text style={styles.artisanName} numberOfLines={1}>
                {artisanName}
              </Text>
              <Text style={styles.craftSpecialty} numberOfLines={1}>
                {craftSpecialty}
              </Text>
            </View>
            <Pressable
              style={styles.editProfileBtn}
              onPress={() => router.push("/settings")}
              hitSlop={8}
            >
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
            </Pressable>
          </View>

          {/* Key Metrics Grid */}
          <View style={styles.metricsGrid}>
            <StatCard
              label="Total Revenue"
              value={`₹${totalRevenue.toLocaleString("en-IN")}`}
              subtitle={`${unitsSold} items fulfilled`}
              icon="wallet-outline"
              iconColor={theme.colors.primary}
              style={{ flex: 1 }}
            />
            <StatCard
              label="Pending Orders"
              value={pendingOrders.length}
              subtitle={pendingOrders.length > 0 ? "Requires Dispatch" : "All orders dispatched"}
              icon="cube-outline"
              iconColor={theme.colors.accentDark}
              onPress={() => router.push("/seller-orders")}
              style={{ flex: 1 }}
            />
          </View>

          <View style={styles.metricsGrid}>
            <StatCard
              label="Buyer Enquiries"
              value={totalEnquiries}
              subtitle="Direct artisan leads"
              icon="chatbubbles-outline"
              iconColor={theme.colors.info}
              onPress={() => router.push("/seller-enquiries")}
              style={{ flex: 1 }}
            />
            <StatCard
              label="Catalog Views"
              value={totalViews}
              subtitle="Consumer interest"
              icon="eye-outline"
              iconColor={theme.colors.success}
              style={{ flex: 1 }}
            />
          </View>

          {/* Readiness Score Banner */}
          {readiness && (
            <View style={styles.readinessCard}>
              <View style={styles.readinessHeader}>
                <View style={styles.readinessScoreBox}>
                  <Text style={styles.readinessScoreText}>{readiness.score || 50}%</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.readinessTitle}>Catalogue Readiness</Text>
                  <Text style={styles.readinessSub}>
                    {readiness.next_best_action || "List products to boost discoverability."}
                  </Text>
                </View>
              </View>
              {Array.isArray(readiness.improvements) && readiness.improvements.length > 0 && (
                <View style={styles.readinessAdvice}>
                  <Ionicons name="sparkles" size={13} color={theme.colors.accentDark} style={{ marginRight: 6 }} />
                  <Text style={styles.readinessAdviceText} numberOfLines={1}>
                    Next: {readiness.improvements[0]}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Quick Actions Grid */}
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickGrid}>
            <Pressable
              style={styles.quickActionPrimary}
              onPress={() => router.push("/seller-ai")}
              accessibilityRole="button"
            >
              <View style={styles.quickActionIconCircle}>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.quickActionPrimaryTitle}>Create with AI</Text>
              <Text style={styles.quickActionPrimarySub}>Photo & Voice Story</Text>
            </Pressable>

            <Pressable
              style={styles.quickActionSecondary}
              onPress={() => router.push("/product-editor" as any)}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.quickActionSecondaryTitle}>Add Craft</Text>
              <Text style={styles.quickActionSecondarySub}>Manual Form</Text>
            </Pressable>

            <Pressable
              style={styles.quickActionSecondary}
              onPress={() => router.push("/seller-business" as any)}
              accessibilityRole="button"
            >
              <Ionicons name="trending-up" size={22} color={theme.colors.accentDark} />
              <Text style={styles.quickActionSecondaryTitle}>Intelligence</Text>
              <Text style={styles.quickActionSecondarySub}>Market & ML</Text>
            </Pressable>
          </View>

          {/* AI Catalog Studio Hero Card */}
          <Pressable
            style={styles.heroBanner}
            onPress={() => router.push("/seller-ai")}
            accessibilityRole="button"
          >
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>VOICE-FIRST MULTIMODAL AI</Text>
            </View>
            <Text style={styles.heroTitle}>
              Turn your craft photos & stories into live catalog listings
            </Text>
            <Text style={styles.heroDesc}>
              Upload a picture, speak in your native language, enhance studio backdrops, and get instant fair-price evaluations.
            </Text>
            <View style={styles.heroButtonRow}>
              <Text style={styles.heroButtonText}>Launch AI Catalog Studio ›</Text>
            </View>
          </Pressable>

          {/* Live Order Dispatch Pipeline */}
          <SectionHeader
            title="Order Dispatch Pipeline"
            subtitle={`${orders.length} total customer orders`}
            actionLabel="View All Orders"
            onAction={() => router.push("/seller-orders")}
          />

          {orders.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No Orders Yet"
              description="When buyers purchase your pieces through Artisan AI or ONDC, they will appear here."
              actionLabel="Add a New Craft"
              onAction={() => router.push("/seller-ai")}
            />
          ) : (
            <View style={styles.ordersList}>
              {orders.slice(0, 3).map((ord) => (
                <Pressable
                  key={ord.id}
                  style={styles.orderCard}
                  onPress={() => router.push("/seller-orders")}
                >
                  <View style={styles.orderTopRow}>
                    <View>
                      <Text style={styles.orderId}>Order #{ord.id}</Text>
                      <Text style={styles.orderProduct} numberOfLines={1}>
                        {ord.product_title || `Product #${ord.product_id}`}
                      </Text>
                    </View>
                    <StatusBadge status={ord.status || "CONFIRMED"} type="order" />
                  </View>
                  <View style={styles.orderBottomRow}>
                    <Text style={styles.buyerName}>
                      Buyer: {ord.buyer_name || "Verified Customer"} (×{ord.quantity || 1})
                    </Text>
                    <Text style={styles.orderAmount}>
                      ₹{Number(ord.total_price || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Market Opportunity Cards */}
          {opportunities && opportunities.high_demand_categories && (
            <>
              <SectionHeader
                title="Market Demand Opportunities"
                subtitle="Live category intelligence"
                actionLabel="Explore"
                onAction={() => router.push("/seller-business" as any)}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.oppsScroll}>
                {opportunities.high_demand_categories.slice(0, 3).map((cat: any, idx: number) => (
                  <View key={idx} style={styles.oppCard}>
                    <Text style={styles.oppCategory}>{cat.category}</Text>
                    <Text style={styles.oppDemand}>
                      Demand Surge: +{Math.round((cat.demand_index || 1.2) * 10)}%
                    </Text>
                    <Text style={styles.oppDesc} numberOfLines={2}>
                      {cat.recommendation || "High consumer search volume across regions."}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </>
      )}

      {/* Persistent Bottom Nav */}
      <BottomNavigation role="seller" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  switchModeBtn: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  switchModeText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.ink
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingContainer: {
    marginTop: theme.spacing.md
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
    marginBottom: theme.spacing.md
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: theme.colors.primaryLight
  },
  profileInfo: {
    flex: 1,
    marginLeft: theme.spacing.md
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  verifiedBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.colors.primary,
    letterSpacing: 0.6
  },
  artisanName: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ink,
    marginTop: 1
  },
  craftSpecialty: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkMuted,
    marginTop: 1
  },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  metricsGrid: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  readinessCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm
  },
  readinessHeader: {
    flexDirection: "row",
    alignItems: "center"
  },
  readinessScoreBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.accentLight,
    alignItems: "center",
    justifyContent: "center"
  },
  readinessScoreText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.accentDark
  },
  readinessTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: "700",
    color: theme.colors.ink
  },
  readinessSub: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    marginTop: 2
  },
  readinessAdvice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: theme.radius.xs,
    marginTop: 8
  },
  readinessAdviceText: {
    fontSize: 11,
    color: theme.colors.ink,
    fontWeight: "500",
    flex: 1
  },
  quickGrid: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  quickActionPrimary: {
    flex: 1.3,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm
  },
  quickActionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  quickActionPrimaryTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: theme.typography.sizes.sm
  },
  quickActionPrimarySub: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10,
    marginTop: 2
  },
  quickActionSecondary: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center"
  },
  quickActionSecondaryTitle: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: theme.typography.sizes.xs,
    marginTop: 4
  },
  quickActionSecondarySub: {
    color: theme.colors.inkSubtle,
    fontSize: 9,
    marginTop: 1
  },
  heroBanner: {
    backgroundColor: "#2A1E17",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.xs,
    gap: 4,
    marginBottom: 8
  },
  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.lg,
    fontWeight: "800",
    lineHeight: 24,
    marginBottom: 6
  },
  heroDesc: {
    color: "#DEC0B7",
    fontSize: theme.typography.sizes.xs,
    lineHeight: 18,
    marginBottom: 12
  },
  heroButtonRow: {
    alignSelf: "flex-start"
  },
  heroButtonText: {
    color: "#FEB956",
    fontWeight: "700",
    fontSize: theme.typography.sizes.sm
  },
  ordersList: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm
  },
  orderTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6
  },
  orderId: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.inkMuted
  },
  orderProduct: {
    fontSize: theme.typography.sizes.base,
    fontWeight: "700",
    color: theme.colors.ink,
    maxWidth: 200
  },
  orderBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 6,
    marginTop: 4
  },
  buyerName: {
    fontSize: 11,
    color: theme.colors.inkMuted
  },
  orderAmount: {
    fontSize: theme.typography.sizes.base,
    fontWeight: "800",
    color: theme.colors.primary
  },
  oppsScroll: {
    marginBottom: theme.spacing.lg
  },
  oppCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: 200,
    marginRight: theme.spacing.sm,
    ...theme.shadows.sm
  },
  oppCategory: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: "700",
    color: theme.colors.primary
  },
  oppDemand: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.success,
    marginVertical: 4
  },
  oppDesc: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    lineHeight: 15
  }
});
