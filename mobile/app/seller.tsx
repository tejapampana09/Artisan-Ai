import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Modal
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { getSession, clearSession } from "../src/storage";
import { theme } from "../src/theme";
import {
  Screen,
  BottomNavigation,
  EmptyState,
  ErrorState,
  SkeletonBox,
  StatusBadge,
  LanguageSelectorModal
} from "../src/components";
import { useI18n } from "../src/i18n";
import { subscribeNotifications } from "../src/notifications";
import { useRoleGuard } from "../src/authGuard";

export default function SellerDashboard() {
  useRoleGuard("seller");
  const { language, t } = useI18n();
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
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);

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

  const artisanName = user?.name || user?.full_name || (language === "te" ? "మాస్టర్ శిల్పి" : "Master Artisan");
  const craftSpecialty = user?.craft || user?.craft_specialization || "Handcrafted Heritage";
  const avatarUrl =
    user?.avatar_url ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(artisanName)}`;

  const totalRevenue = dashboard?.total_revenue ?? 0;
  const unitsSold = dashboard?.units_sold ?? 0;
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

      {/* Clean Artisan Studio Header */}
      <View style={styles.cleanHeader}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.push("/seller-profile" as any)}
            style={styles.avatarWrap}
            hitSlop={8}
          >
            <Image
              source={{ uri: avatarUrl }}
              style={styles.headerAvatar}
              resizeMode="cover"
            />
            <View style={styles.onlineDot} />
          </Pressable>
          <View style={styles.headerTitleBox}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerGreeting}>
                {language === "te" ? "నమస్కారం," : "Studio of"}
              </Text>
              <Text style={styles.headerName} numberOfLines={1}>{artisanName}</Text>
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>
              🌿 {craftSpecialty}
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            style={styles.headerLangPill}
            onPress={() => setLangModalVisible(true)}
            hitSlop={6}
          >
            <Ionicons name="globe-outline" size={14} color="#A6533B" />
            <Text style={styles.headerLangText}>
              {language === "te" ? "తెలుగు" : language === "hi" ? "हिन्दी" : "EN"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.headerIconBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={6}
          >
            <Ionicons name="notifications-outline" size={19} color="#1C1C1C" />
            {unreadNotifs > 0 && (
              <View style={styles.cleanNotifBadge}>
                <Text style={styles.cleanNotifBadgeText}>
                  {unreadNotifs > 99 ? "99+" : unreadNotifs}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <SkeletonBox height={110} borderRadius={16} style={{ marginBottom: 16 }} />
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <SkeletonBox height={88} style={{ flex: 1 }} borderRadius={14} />
            <SkeletonBox height={88} style={{ flex: 1 }} borderRadius={14} />
          </View>
          <SkeletonBox height={140} borderRadius={16} style={{ marginBottom: 16 }} />
        </View>
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onRetry={loadData} />
      ) : (
        <>
          {/* Studio Revenue & Growth Card */}
          <View style={styles.revenueCard}>
            <View style={styles.revenueTopRow}>
              <View>
                <Text style={styles.revenueLabel}>
                  {language === "te" ? "మొత్తం ఆదాయం" : "STUDIO REVENUE"}
                </Text>
                <Text style={styles.revenueValue}>₹{totalRevenue.toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.revenueBadge}>
                <Ionicons name="sparkles" size={13} color="#2E7D32" />
                <Text style={styles.revenueBadgeText}>
                  {unitsSold} {language === "te" ? "అమ్మకాలు" : "Crafts Sold"}
                </Text>
              </View>
            </View>

            {/* Quick 3-Metric Strip */}
            <View style={styles.metricsStrip}>
              <Pressable
                style={styles.metricPill}
                onPress={() => router.push("/seller-orders")}
              >
                <Text style={styles.metricPillNumber}>{pendingOrders.length}</Text>
                <Text style={styles.metricPillLabel}>
                  {language === "te" ? "పెండింగ్ ఆర్డర్లు" : "Pending Orders"}
                </Text>
              </Pressable>

              <View style={styles.metricPillDivider} />

              <Pressable
                style={styles.metricPill}
                onPress={() => router.push("/seller-enquiries")}
              >
                <Text style={styles.metricPillNumber}>{totalEnquiries}</Text>
                <Text style={styles.metricPillLabel}>
                  {language === "te" ? "ఎంక్వైరీలు" : "Inquiries"}
                </Text>
              </Pressable>

              <View style={styles.metricPillDivider} />

              <View style={styles.metricPill}>
                <Text style={styles.metricPillNumber}>{totalViews}</Text>
                <Text style={styles.metricPillLabel}>
                  {language === "te" ? "క్రాఫ్ట్ వ్యూస్" : "Craft Views"}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Studio Actions (Balanced 2-Card Grid) */}
          <View style={styles.actionGrid}>
            <Pressable
              style={styles.actionCardPrimary}
              onPress={() => router.push("/seller-ai")}
            >
              <View style={styles.actionCardIconBox}>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionPrimaryTitle}>
                  {language === "te" ? "AI క్రాఫ్ట్ స్టూడియో" : "AI Craft Studio"}
                </Text>
                <Text style={styles.actionPrimarySub}>
                  {language === "te" ? "ఫోటో & వాయిస్ ద్వారా లిస్టింగ్" : "Photo & voice listing"}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>

            <Pressable
              style={styles.actionCardSecondary}
              onPress={() => router.push("/seller-products")}
            >
              <View style={styles.actionCardSecondaryIconBox}>
                <Ionicons name="cube-outline" size={19} color="#A6533B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionSecondaryTitle}>
                  {language === "te" ? "నా కళాఖండాలు" : "My Creations"}
                </Text>
                <Text style={styles.actionSecondarySub}>
                  {language === "te" ? "వస్తువులు & ధరల నిర్వహణ" : "Catalog & pricing"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#A89A92" />
            </Pressable>
          </View>

          {/* Order Fulfillment Pipeline (Artisan Warm Earthy Styling) */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {language === "te" ? "ఆర్డర్ డెలివరీ స్థితి" : "Fulfillment Pipeline"}
            </Text>
            <Pressable onPress={() => router.push("/seller-orders")}>
              <Text style={styles.sectionLink}>
                {language === "te" ? "అన్నీ చూడండి →" : "View All →"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.pipelineCard}>
            <View style={styles.stageItem}>
              <View style={[styles.stageBadge, { backgroundColor: "#FBF3F0" }]}>
                <Text style={[styles.stageCount, { color: "#A6533B" }]}>
                  {deliveryStatus.confirmed ?? 0}
                </Text>
              </View>
              <Text style={styles.stageName}>
                {language === "te" ? "ధృవీకరించబడింది" : "Confirmed"}
              </Text>
            </View>

            <View style={styles.stageItem}>
              <View style={[styles.stageBadge, { backgroundColor: "#FFF8E1" }]}>
                <Text style={[styles.stageCount, { color: "#835500" }]}>
                  {deliveryStatus.processing ?? 0}
                </Text>
              </View>
              <Text style={styles.stageName}>
                {language === "te" ? "ప్యాక్ చేయబడింది" : "Packed"}
              </Text>
            </View>

            <View style={styles.stageItem}>
              <View style={[styles.stageBadge, { backgroundColor: "#E3F2FD" }]}>
                <Text style={[styles.stageCount, { color: "#1565C0" }]}>
                  {deliveryStatus.shipped ?? 0}
                </Text>
              </View>
              <Text style={styles.stageName}>
                {language === "te" ? "రవాణాలో ఉంది" : "Dispatched"}
              </Text>
            </View>

            <View style={styles.stageItem}>
              <View style={[styles.stageBadge, { backgroundColor: "#E8F5E9" }]}>
                <Text style={[styles.stageCount, { color: "#2E7D32" }]}>
                  {deliveryStatus.delivered ?? 0}
                </Text>
              </View>
              <Text style={styles.stageName}>
                {language === "te" ? "చేరింది" : "Delivered"}
              </Text>
            </View>
          </View>

          {/* Per-Product Sales & View Metrics */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {language === "te" ? "కళాఖండాల పనితీరు" : "Craft Performance"}
            </Text>
            <Pressable onPress={() => router.push("/seller-products")}>
              <Text style={styles.sectionLink}>
                {language === "te" ? "అన్నీ చూడండి" : "All Crafts"}
              </Text>
            </Pressable>
          </View>

          {productPerformance.length === 0 ? (
            <View style={styles.emptyCraftBox}>
              <Ionicons name="sparkles-outline" size={24} color="#A6533B" style={{ marginBottom: 6 }} />
              <Text style={styles.emptyCraftText}>
                {language === "te"
                  ? "ఇంకా హస్తకళల పనితీరు సమాచారం లేదు. AI తో కొత్త హస్తకళను సృష్టించండి."
                  : "No crafts listed yet. Create your first piece with AI to track views and earnings."}
              </Text>
            </View>
          ) : (
            <View style={styles.perfList}>
              {productPerformance.slice(0, 4).map((prod: any) => (
                <Pressable
                  key={prod.product_id}
                  style={styles.perfCard}
                  onPress={() => router.push("/seller-products")}
                >
                  <Image
                    source={{
                      uri:
                        prod.image_url ||
                        "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400"
                    }}
                    style={styles.perfThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.perfBody}>
                    <View style={styles.perfTitleRow}>
                      <Text style={styles.perfTitle} numberOfLines={1}>
                        {prod.title}
                      </Text>
                      <Text style={styles.perfPrice}>
                        ₹{Number(prod.price || 0).toLocaleString("en-IN")}
                      </Text>
                    </View>

                    <View style={styles.perfMetaRow}>
                      <View style={styles.perfMetricChip}>
                        <Ionicons name="eye-outline" size={12} color="#6B5B51" />
                        <Text style={styles.perfMetricText}>{prod.views ?? 0} views</Text>
                      </View>
                      <View style={styles.perfMetricChip}>
                        <Ionicons name="cube-outline" size={12} color="#6B5B51" />
                        <Text style={styles.perfMetricText}>{prod.units_sold ?? 0} sold</Text>
                      </View>
                      <View style={styles.perfStockChip}>
                        <Text style={styles.perfStockText}>
                          {prod.stock} {language === "te" ? "స్టాక్" : "in stock"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Recent Orders Stream */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {language === "te" ? "ఇటీవలి ఆర్డర్లు" : "Recent Orders"}
            </Text>
            <Pressable onPress={() => router.push("/seller-orders")}>
              <Text style={styles.sectionLink}>
                {language === "te" ? "ఆర్డర్ల జాబితా →" : "Order List →"}
              </Text>
            </Pressable>
          </View>

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
                  <View style={styles.orderTop}>
                    <View>
                      <Text style={styles.orderId}>Order #{ord.id}</Text>
                      <Text style={styles.orderTitle} numberOfLines={1}>
                        {ord.product_title || `Handcrafted Item #${ord.product_id}`}
                      </Text>
                    </View>
                    <StatusBadge status={ord.status || "CONFIRMED"} type="order" />
                  </View>

                  <View style={styles.orderBottom}>
                    <Text style={styles.orderBuyer}>
                      👤 {ord.buyer_name || "Verified Patron"} (×{ord.quantity || 1})
                    </Text>
                    <Text style={styles.orderPrice}>
                      ₹{Number(ord.total_price || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {/* Persistent Bottom Navigation */}
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
              <Ionicons name="log-out-outline" size={28} color="#C62828" />
            </View>
            <Text style={styles.signOutModalTitle}>Sign out of Studio?</Text>
            <Text style={styles.signOutModalBody}>
              You'll be taken back to the Buyer Marketplace. Your studio catalog and orders stay completely safe.
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24
  },
  cleanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginBottom: 16
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10
  },
  avatarWrap: {
    position: "relative"
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5EFEB",
    borderWidth: 1.5,
    borderColor: "#E8E2D9"
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2E7D32",
    borderWidth: 2,
    borderColor: "#FAF7F2"
  },
  headerTitleBox: {
    marginLeft: 10,
    flex: 1
  },
  headerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  headerGreeting: {
    fontSize: 12,
    color: "#6B5B51",
    fontWeight: "500"
  },
  headerName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1C1C1C",
    flexShrink: 1
  },
  headerSub: {
    fontSize: 11,
    color: "#8A726A",
    fontWeight: "500",
    marginTop: 2
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headerLangPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  headerLangText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A6533B"
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  cleanNotifBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#C62828",
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
    marginTop: 8
  },
  revenueCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    marginBottom: 14
  },
  revenueTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14
  },
  revenueLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#8A726A",
    marginBottom: 2
  },
  revenueValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1C1C1C",
    letterSpacing: -0.5
  },
  revenueBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4
  },
  revenueBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32"
  },
  metricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF7F2",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6
  },
  metricPill: {
    flex: 1,
    alignItems: "center"
  },
  metricPillNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1C1C"
  },
  metricPillLabel: {
    fontSize: 10,
    color: "#6B5B51",
    fontWeight: "600",
    marginTop: 2
  },
  metricPillDivider: {
    width: 1,
    height: 22,
    backgroundColor: "#E8E2D9"
  },
  actionGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  actionCardPrimary: {
    flex: 1,
    backgroundColor: "#A6533B",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  actionCardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center"
  },
  actionPrimaryTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  actionPrimarySub: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 1
  },
  actionCardSecondary: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  actionCardSecondaryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FBF3F0",
    alignItems: "center",
    justifyContent: "center"
  },
  actionSecondaryTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1C1C1C"
  },
  actionSecondarySub: {
    fontSize: 10,
    color: "#8A726A",
    marginTop: 1
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1C1C1C"
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A6533B"
  },
  pipelineCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  stageItem: {
    flex: 1,
    alignItems: "center"
  },
  stageBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  stageCount: {
    fontSize: 15,
    fontWeight: "900"
  },
  stageName: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B5B51"
  },
  emptyCraftBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    alignItems: "center",
    marginBottom: 16
  },
  emptyCraftText: {
    fontSize: 12,
    color: "#6B5B51",
    textAlign: "center",
    lineHeight: 18
  },
  perfList: {
    gap: 8,
    marginBottom: 16
  },
  perfCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  perfThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#F5EFEB"
  },
  perfBody: {
    flex: 1
  },
  perfTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  perfTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1C",
    flex: 1,
    marginRight: 6
  },
  perfPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#A6533B"
  },
  perfMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  perfMetricChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  perfMetricText: {
    fontSize: 10.5,
    color: "#6B5B51"
  },
  perfStockChip: {
    backgroundColor: "#FAF7F2",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: "auto"
  },
  perfStockText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8A726A"
  },
  ordersList: {
    gap: 8,
    marginBottom: 16
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8
  },
  orderId: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#8A726A"
  },
  orderTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1C",
    maxWidth: 210,
    marginTop: 1
  },
  orderBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F5EFEB",
    paddingTop: 6
  },
  orderBuyer: {
    fontSize: 11,
    color: "#6B5B51"
  },
  orderPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#A6533B"
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
    padding: 24,
    alignItems: "center"
  },
  signOutIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFEBEE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  signOutModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1C1C1C",
    marginBottom: 6,
    textAlign: "center"
  },
  signOutModalBody: {
    fontSize: 13,
    color: "#6B5B51",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8
  },
  signOutModalActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%"
  },
  signOutCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FAF7F2",
    borderWidth: 1,
    borderColor: "#E8E2D9",
    alignItems: "center",
    justifyContent: "center"
  },
  signOutCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1C"
  },
  signOutConfirmBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#C62828",
    alignItems: "center",
    justifyContent: "center"
  },
  signOutConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
