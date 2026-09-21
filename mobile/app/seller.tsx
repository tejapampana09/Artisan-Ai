import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  RefreshControl,
  ScrollView,
  Modal
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
import { useRoleGuard } from "../src/authGuard";

export default function SellerDashboard() {
  useRoleGuard("seller");
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
      const sess = await getSession("STUDIO");
      if (!sess.token) {
        router.replace({ pathname: "/login", params: { role: "seller" } });
        return;
      }

      const [dash, read, opps, ords] = await Promise.all([
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

  const [signOutModalVisible, setSignOutModalVisible] = useState(false);

  const handleSignOut = () => setSignOutModalVisible(true);

  const doSignOut = async () => {
    setSignOutModalVisible(false);
    await clearSession("STUDIO");
    await clearSession();
    router.replace("/buyer");
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

      {/* Sleek Studio Header */}
      <View style={styles.cleanHeader}>
        <View style={styles.headerLeft}>
          <Image
            source={{ uri: avatarUrl }}
            style={styles.headerAvatar}
            resizeMode="cover"
          />
          <View style={styles.headerTitleBox}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName} numberOfLines={1}>{artisanName}</Text>
              <View style={styles.verifiedTag}>
                <Ionicons name="checkmark-circle" size={13} color="#2563EB" />
                <Text style={styles.verifiedTagText}>STUDIO</Text>
              </View>
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>{craftSpecialty}</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => setLangModalVisible(true)}
            hitSlop={6}
          >
            <Ionicons name="globe-outline" size={19} color="#1C1917" />
          </Pressable>

          <Pressable
            style={styles.headerIconBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={6}
          >
            <Ionicons name="notifications-outline" size={19} color="#1C1917" />
            {unreadNotifs > 0 && (
              <View style={styles.cleanNotifBadge}>
                <Text style={styles.cleanNotifBadgeText}>
                  {unreadNotifs > 99 ? "99+" : unreadNotifs}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={styles.headerIconBtn}
            onPress={() => router.push("/seller-profile" as any)}
            hitSlop={6}
          >
            <Ionicons name="person-outline" size={19} color="#1C1917" />
          </Pressable>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <SkeletonBox height={100} borderRadius={theme.radius.lg} style={{ marginBottom: 16 }} />
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <SkeletonBox height={80} style={{ flex: 1 }} borderRadius={theme.radius.md} />
            <SkeletonBox height={80} style={{ flex: 1 }} borderRadius={theme.radius.md} />
          </View>
          <SkeletonBox height={140} borderRadius={theme.radius.lg} style={{ marginBottom: 16 }} />
        </View>
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onRetry={loadData} />
      ) : (
        <>
          {/* Revenue & Growth Hero Card */}
          <View style={styles.revenueHeroCard}>
            <View style={styles.revenueHeroTop}>
              <View>
                <Text style={styles.revenueHeroLabel}>TOTAL REVENUE</Text>
                <Text style={styles.revenueHeroValue}>₹{totalRevenue.toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.revenueBadge}>
                <Ionicons name="trending-up" size={14} color="#16A34A" />
                <Text style={styles.revenueBadgeText}>{unitsSold} Items Sold</Text>
              </View>
            </View>

            <View style={styles.revenueHeroDivider} />

            <View style={styles.revenueHeroStatsRow}>
              <Pressable
                style={styles.revenueSubStat}
                onPress={() => router.push("/seller-orders")}
              >
                <Text style={styles.revenueSubVal}>{pendingOrders.length}</Text>
                <Text style={styles.revenueSubLabel}>Pending Orders</Text>
              </Pressable>

              <View style={styles.revenueSubDivider} />

              <Pressable
                style={styles.revenueSubStat}
                onPress={() => router.push("/seller-enquiries")}
              >
                <Text style={styles.revenueSubVal}>{totalEnquiries}</Text>
                <Text style={styles.revenueSubLabel}>Buyer Inquiries</Text>
              </Pressable>

              <View style={styles.revenueSubDivider} />

              <View style={styles.revenueSubStat}>
                <Text style={styles.revenueSubVal}>{totalViews}</Text>
                <Text style={styles.revenueSubLabel}>Craft Views</Text>
              </View>
            </View>
          </View>

          {/* Clean Quick Studio Actions */}
          <View style={styles.cleanActionRow}>
            <Pressable
              style={styles.primaryStudioAction}
              onPress={() => router.push("/seller-ai")}
            >
              <View style={styles.actionIconPill}>
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.primaryActionTitle}>AI Craft Studio</Text>
                <Text style={styles.primaryActionSub}>Photo, voice & story listing</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>

            <Pressable
              style={styles.secondaryStudioAction}
              onPress={() => router.push("/product-editor" as any)}
            >
              <Ionicons name="add" size={20} color={theme.accent} />
              <Text style={styles.secondaryActionText}>Manual Add</Text>
            </Pressable>
          </View>

          {/* Readiness Progress Bar (if available) */}
          {readiness && (
            <View style={styles.cleanReadinessBox}>
              <View style={styles.cleanReadinessTop}>
                <Text style={styles.cleanReadinessTitle}>Catalogue Readiness</Text>
                <Text style={styles.cleanReadinessPct}>
                  {readiness.score != null ? `${readiness.score}%` : "0%"}
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, Math.max(0, readiness.score || 0))}%` }
                  ]}
                />
              </View>
              <Text style={styles.cleanReadinessHint} numberOfLines={1}>
                {readiness.next_best_action || "Add high quality photos to improve discovery"}
              </Text>
            </View>
          )}

          {/* Delivery Stages Grid */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderMain}>Order Fulfillment Pipeline</Text>
            <Pressable onPress={() => router.push("/seller-orders")}>
              <Text style={styles.sectionHeaderAction}>View All Orders →</Text>
            </Pressable>
          </View>

          <View style={styles.stagesRow}>
            <View style={styles.stageCol}>
              <View style={[styles.stageBadgeCircle, { backgroundColor: "#EFF6FF" }]}>
                <Text style={[styles.stageCount, { color: "#2563EB" }]}>{deliveryStatus.confirmed ?? 0}</Text>
              </View>
              <Text style={styles.stageTitle}>Confirmed</Text>
            </View>

            <View style={styles.stageCol}>
              <View style={[styles.stageBadgeCircle, { backgroundColor: "#FFF7ED" }]}>
                <Text style={[styles.stageCount, { color: "#EA580C" }]}>{deliveryStatus.processing ?? 0}</Text>
              </View>
              <Text style={styles.stageTitle}>Packed</Text>
            </View>

            <View style={styles.stageCol}>
              <View style={[styles.stageBadgeCircle, { backgroundColor: "#FDF2F8" }]}>
                <Text style={[styles.stageCount, { color: "#DB2777" }]}>{deliveryStatus.shipped ?? 0}</Text>
              </View>
              <Text style={styles.stageTitle}>Shipped</Text>
            </View>

            <View style={styles.stageCol}>
              <View style={[styles.stageBadgeCircle, { backgroundColor: "#F0FDF4" }]}>
                <Text style={[styles.stageCount, { color: "#16A34A" }]}>{deliveryStatus.delivered ?? 0}</Text>
              </View>
              <Text style={styles.stageTitle}>Delivered</Text>
            </View>
          </View>

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

      {/* Sign-Out Confirmation Modal */}
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
            <View style={styles.signOutIconCircle}>
              <Ionicons name="log-out-outline" size={32} color="#E11D48" />
            </View>
            <Text style={styles.signOutModalTitle}>Sign out of Studio?</Text>
            <Text style={styles.signOutModalBody}>
              You'll be taken back to the Buyer Marketplace. Your studio data and products stay safe.
            </Text>
            <View style={styles.signOutModalActions}>
              <Pressable
                style={styles.signOutCancelBtn}
                onPress={() => setSignOutModalVisible(false)}
              >
                <Text style={styles.signOutCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.signOutConfirmBtn} onPress={doSignOut}>
                <Ionicons name="log-out-outline" size={15} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.signOutConfirmText}>Yes, Sign Out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm
  },
  cleanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF9F6",
    paddingVertical: 12,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EAE7E1"
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8DDD5",
    borderWidth: 1.5,
    borderColor: theme.accent
  },
  headerTitleBox: {
    marginLeft: 10,
    flex: 1
  },
  headerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  headerName: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1C1917"
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    gap: 3
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.5
  },
  headerSub: {
    fontSize: 11,
    color: "#78716C",
    fontWeight: "500",
    marginTop: 2
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E1D8"
  },
  cleanNotifBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#E11D48",
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  cleanNotifBadgeText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "900"
  },
  loadingContainer: {
    marginTop: 16
  },
  revenueHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  revenueHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  revenueHeroLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#78716C",
    marginBottom: 2
  },
  revenueHeroValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1C1917"
  },
  revenueBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 4
  },
  revenueBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#16A34A"
  },
  revenueHeroDivider: {
    height: 1,
    backgroundColor: "#F5F5F4",
    marginVertical: 14
  },
  revenueHeroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  revenueSubStat: {
    flex: 1,
    alignItems: "center"
  },
  revenueSubVal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1917"
  },
  revenueSubLabel: {
    fontSize: 10.5,
    color: "#78716C",
    fontWeight: "600",
    marginTop: 2
  },
  revenueSubDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E7E5E4"
  },
  cleanActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  primaryStudioAction: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },
  actionIconPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },
  primaryActionSub: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 9.5,
    fontWeight: "500"
  },
  secondaryStudioAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E1D8",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1C1917"
  },
  cleanReadinessBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 16
  },
  cleanReadinessTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  cleanReadinessTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C1917"
  },
  cleanReadinessPct: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.accent
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F5F5F4",
    overflow: "hidden",
    marginBottom: 6
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: theme.accent,
    borderRadius: 3
  },
  cleanReadinessHint: {
    fontSize: 10.5,
    color: "#78716C",
    fontWeight: "500"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4
  },
  sectionHeaderMain: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1C1917"
  },
  sectionHeaderAction: {
    fontSize: 11.5,
    fontWeight: "700",
    color: theme.accent
  },
  stagesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 18
  },
  stageCol: {
    flex: 1,
    alignItems: "center"
  },
  stageBadgeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  stageCount: {
    fontSize: 15,
    fontWeight: "900"
  },
  stageTitle: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#78716C"
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
  },
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
