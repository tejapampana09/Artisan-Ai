import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  RefreshControl,
  ScrollView,
  Alert
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
  SectionHeader,
  LanguageSelectorModal
} from "../src/components";
import { useI18n } from "../src/i18n";
import { subscribeNotifications } from "../src/notifications";

export default function SellerDashboard() {
  const { language, t, getCategory } = useI18n();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsub = subscribeNotifications((_, count) => setUnreadNotifs(count));
    return () => unsub();
  }, []);

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

  const artisanName = user?.name || t("verifiedMasterArtisan");
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
  const productPerformance = dashboard?.product_performance || [];

  const handleSignOut = () => {
    Alert.alert(
      language === "te" ? "సైన్ అవుట్" : "Sign Out",
      language === "te"
        ? "మీరు నిజంగా ఆర్టిసాన్ స్టూడియో నుండి నిష్క్రమించాలనుకుంటున్నారా?"
        : "Are you sure you want to sign out of Artisan Studio?",
      [
        { text: language === "te" ? "రద్దు" : "Cancel", style: "cancel" },
        {
          text: language === "te" ? "సైన్ అవుట్" : "Sign Out",
          style: "destructive",
          onPress: async () => {
            await clearSession("STUDIO");
            await clearSession();
            router.replace("/buyer");
          }
        }
      ]
    );
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
      <LanguageSelectorModal
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />

      {/* Header */}
      <Header
        title={t("artisanStudio")}
        subtitle={t("ruralCommerce")}
        roleBadge="ARTISAN"
        showNotificationBell={false}
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              style={styles.langPill}
              onPress={() => setLangModalVisible(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Change Language"
            >
              <Text style={styles.langPillText}>🌐 {language.toUpperCase()}</Text>
            </Pressable>

            {/* Profile Action */}
            <Pressable
              style={styles.iconBtn}
              onPress={() => router.push("/settings")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <Ionicons name="person-circle-outline" size={20} color={theme.colors.ink} />
            </Pressable>

            {/* Notifications Action */}
            <Pressable
              style={styles.iconBtn}
              onPress={() => router.push("/notifications")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={18} color={theme.colors.ink} />
              {unreadNotifs > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadNotifs > 99 ? "99+" : unreadNotifs}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Sign Out Button */}
            <Pressable
              style={styles.signOutBtn}
              onPress={handleSignOut}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sign Out"
            >
              <Ionicons name="log-out-outline" size={13} color="#C92A2A" />
              <Text style={styles.signOutBtnText}>
                {language === "te" ? "లాగౌట్" : "Sign Out"}
              </Text>
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
                <Text style={styles.verifiedBadge}>{t("verifiedMasterArtisan")}</Text>
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
              label={t("totalRevenue")}
              value={`₹${totalRevenue.toLocaleString("en-IN")}`}
              subtitle={`${unitsSold} ${t("itemsFulfilled")}`}
              icon="wallet-outline"
              iconColor={theme.colors.primary}
              style={{ flex: 1 }}
            />
            <StatCard
              label={t("pendingOrders")}
              value={pendingOrders.length}
              subtitle={pendingOrders.length > 0 ? t("requiresDispatch") : t("allDispatched")}
              icon="cube-outline"
              iconColor={theme.colors.accentDark}
              onPress={() => router.push("/seller-orders")}
              style={{ flex: 1 }}
            />
          </View>

          <View style={styles.metricsGrid}>
            <StatCard
              label={t("buyerEnquiries")}
              value={totalEnquiries}
              subtitle={t("directLeads")}
              icon="chatbubbles-outline"
              iconColor={theme.colors.info}
              onPress={() => router.push("/seller-enquiries")}
              style={{ flex: 1 }}
            />
            <StatCard
              label={t("catalogViews")}
              value={totalViews}
              subtitle={t("consumerInterest")}
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
                  <Text style={styles.readinessScoreText}>
                    {readiness.score != null ? `${readiness.score}%` : "0%"}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.readinessTitle}>{t("catalogueReadiness")}</Text>
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
          <SectionHeader title={t("quickActions")} />
          <View style={styles.quickGrid}>
            <Pressable
              style={styles.quickActionPrimary}
              onPress={() => router.push("/seller-ai")}
              accessibilityRole="button"
            >
              <View style={styles.quickActionIconCircle}>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.quickActionPrimaryTitle}>{t("createWithAi")}</Text>
              <Text style={styles.quickActionPrimarySub}>{t("photoVoiceStory")}</Text>
            </Pressable>

            <Pressable
              style={styles.quickActionSecondary}
              onPress={() => router.push("/product-editor" as any)}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.quickActionSecondaryTitle}>{t("addCraft")}</Text>
              <Text style={styles.quickActionSecondarySub}>{t("manualForm")}</Text>
            </Pressable>

            <Pressable
              style={styles.quickActionSecondary}
              onPress={() => router.push("/seller-business" as any)}
              accessibilityRole="button"
            >
              <Ionicons name="trending-up" size={22} color={theme.colors.accentDark} />
              <Text style={styles.quickActionSecondaryTitle}>{t("marketIntelligence")}</Text>
              <Text style={styles.quickActionSecondarySub}>{t("marketAndMl")}</Text>
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
              <Text style={styles.heroBadgeText}>{t("voiceFirstAi")}</Text>
            </View>
            <Text style={styles.heroTitle}>
              {t("heroAiTitle")}
            </Text>
            <Text style={styles.heroDesc}>
              {t("heroAiDesc")}
            </Text>
            <View style={styles.heroButtonRow}>
              <Text style={styles.heroButtonText}>{t("launchAiStudio")}</Text>
            </View>
          </Pressable>

          {/* Delivery Pipeline Breakdown (Exact Match to Web Dashboard) */}
          <SectionHeader
            title={language === "te" ? "డెలివరీ ప్రగతి / పైప్‌లైన్" : "Delivery Pipeline Breakdown"}
            subtitle={language === "te" ? "ఆర్డర్ల రవాణా స్థితిగతులు" : "Live status of your orders across fulfillment stages"}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pipelineScroll}>
            <View style={[styles.pipelineCard, { borderLeftColor: theme.colors.info }]}>
              <Text style={styles.pipelineLabel}>
                {language === "te" ? "ఖరారైంది" : "CONFIRMED"}
              </Text>
              <Text style={[styles.pipelineValue, { color: theme.colors.info }]}>
                {deliveryStatus.confirmed ?? 0}
              </Text>
            </View>
            <View style={[styles.pipelineCard, { borderLeftColor: "#E67700" }]}>
              <Text style={styles.pipelineLabel}>
                {language === "te" ? "ప్యాకింగ్" : "PACKED"}
              </Text>
              <Text style={[styles.pipelineValue, { color: "#E67700" }]}>
                {deliveryStatus.processing ?? 0}
              </Text>
            </View>
            <View style={[styles.pipelineCard, { borderLeftColor: theme.colors.primary }]}>
              <Text style={styles.pipelineLabel}>
                {language === "te" ? "రవాణాలో" : "IN TRANSIT"}
              </Text>
              <Text style={[styles.pipelineValue, { color: theme.colors.primary }]}>
                {deliveryStatus.shipped ?? 0}
              </Text>
            </View>
            <View style={[styles.pipelineCard, { borderLeftColor: theme.colors.success }]}>
              <Text style={styles.pipelineLabel}>
                {language === "te" ? "చేరింది" : "DELIVERED"}
              </Text>
              <Text style={[styles.pipelineValue, { color: theme.colors.success }]}>
                {deliveryStatus.delivered ?? 0}
              </Text>
            </View>
            <View style={[styles.pipelineCard, { borderLeftColor: theme.colors.error }]}>
              <Text style={styles.pipelineLabel}>
                {language === "te" ? "రద్దు" : "CANCELLED"}
              </Text>
              <Text style={[styles.pipelineValue, { color: theme.colors.error }]}>
                {deliveryStatus.cancelled ?? 0}
              </Text>
            </View>
          </ScrollView>

          {/* Per-Product Sales & View Metrics (Exact Match to Web Dashboard) */}
          <SectionHeader
            title={language === "te" ? "ఉత్పత్తి వివరాలు & వ్యూస్" : "Craft Sales & View Metrics"}
            subtitle={language === "te" ? "ప్రతి హస్తకళకు వచ్చిన వ్యూస్ మరియు అమ్మకాలు" : "Sales volume, views, and revenue per craft listing"}
            actionLabel={language === "te" ? "అన్నీ చూడండి" : "All Crafts"}
            onAction={() => router.push("/seller-products")}
          />
          {productPerformance.length === 0 ? (
            <View style={styles.noPerfBox}>
              <Text style={styles.noPerfText}>
                {language === "te"
                  ? "ఇంకా హస్తకళల పనితీరు సమాచారం లేదు. AI తో కొత్త హస్తకళను సృష్టించండి."
                  : "No craft listings yet. Create your first listing with AI to start tracking views and sales."}
              </Text>
            </View>
          ) : (
            <View style={styles.perfList}>
              {productPerformance.slice(0, 5).map((prod: any) => (
                <View key={prod.product_id} style={styles.perfCard}>
                  <View style={styles.perfTopRow}>
                    <Image
                      source={{
                        uri:
                          prod.image_url ||
                          "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400"
                      }}
                      style={styles.perfThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.perfMeta}>
                      <Text style={styles.perfTitle} numberOfLines={2}>
                        {prod.title}
                      </Text>
                      <View style={styles.perfBadgeRow}>
                        <Text style={styles.perfPrice}>₹{Number(prod.price || 0).toLocaleString("en-IN")}</Text>
                        <View style={styles.stockBadge}>
                          <Text style={styles.stockBadgeText}>
                            {prod.stock} {language === "te" ? "స్టాక్ సిద్ధం" : "ready"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.perfMetricsRow}>
                    <View style={styles.perfMetricItem}>
                      <Ionicons name="eye-outline" size={13} color={theme.colors.info} />
                      <Text style={styles.perfMetricText}>
                        <Text style={styles.perfMetricBold}>{prod.views ?? 0}</Text> {language === "te" ? "వ్యూస్" : "Views"}
                      </Text>
                    </View>
                    <View style={styles.perfMetricItem}>
                      <Ionicons name="cube-outline" size={13} color={theme.colors.primary} />
                      <Text style={styles.perfMetricText}>
                        <Text style={styles.perfMetricBold}>{prod.units_sold ?? 0}</Text> {language === "te" ? "అమ్మకాలు" : "Sold"}
                      </Text>
                    </View>
                    <View style={styles.perfMetricItem}>
                      <Ionicons name="cash-outline" size={13} color={theme.colors.success} />
                      <Text style={styles.perfMetricText}>
                        <Text style={styles.perfMetricBold}>₹{Number(prod.revenue || 0).toLocaleString("en-IN")}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Live Order Dispatch Pipeline */}
          <SectionHeader
            title={t("orderDispatchPipeline")}
            subtitle={`${orders.length} ${t("totalOrdersSubtitle")}`}
            actionLabel={t("viewAllOrders")}
            onAction={() => router.push("/seller-orders")}
          />

          {orders.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title={t("noOrdersYet")}
              description={t("noOrdersDesc")}
              actionLabel={t("addNewCraft")}
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
                      <Text style={styles.orderId}>{t("orderNumber")}{ord.id}</Text>
                      <Text style={styles.orderProduct} numberOfLines={1}>
                        {ord.product_title || `Product #${ord.product_id}`}
                      </Text>
                    </View>
                    <StatusBadge status={ord.status || "CONFIRMED"} type="order" />
                  </View>
                  <View style={styles.orderBottomRow}>
                    <Text style={styles.buyerName}>
                      {t("buyer")}: {ord.buyer_name || "Verified Customer"} (×{ord.quantity || 1})
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
                title={t("marketDemandOpportunities")}
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
  signOutBtn: {
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: "#FFC9C9",
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  signOutBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#C92A2A"
  },
  langPill: {
    backgroundColor: "#F4EBE1",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: "#EADFCF",
    flexDirection: "row",
    alignItems: "center"
  },
  langPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8B4513"
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
  notifBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    backgroundColor: theme.colors.primary,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FAF9F6"
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800"
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
  },
  pipelineScroll: {
    marginBottom: theme.spacing.lg
  },
  pipelineCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    marginRight: theme.spacing.sm,
    minWidth: 105,
    ...theme.shadows.sm
  },
  pipelineLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: theme.colors.inkMuted,
    textTransform: "uppercase",
    marginBottom: 2
  },
  pipelineValue: {
    fontSize: 18,
    fontWeight: "800"
  },
  perfList: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg
  },
  perfCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm
  },
  perfTopRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  perfThumb: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant
  },
  perfMeta: {
    flex: 1
  },
  perfTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: "700",
    color: theme.colors.ink,
    marginBottom: 4
  },
  perfBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  perfPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.primary
  },
  stockBadge: {
    backgroundColor: "#E6FCF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C3FAE8"
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0CA678"
  },
  perfMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 8
  },
  perfMetricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  perfMetricText: {
    fontSize: 11,
    color: theme.colors.inkMuted
  },
  perfMetricBold: {
    fontWeight: "700",
    color: theme.colors.ink
  },
  noPerfBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg
  },
  noPerfText: {
    fontSize: 12,
    color: theme.colors.inkMuted,
    textAlign: "center"
  }
});
