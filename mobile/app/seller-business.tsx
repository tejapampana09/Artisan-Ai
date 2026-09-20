import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
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
  SectionHeader,
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
  Chip
} from "../src/components";
import { syncOfflineQueue, getQueueCount } from "../src/offlineQueue";
import { useRoleGuard } from "../src/authGuard";

export default function SellerBusinessScreen() {
  useRoleGuard("seller");
  const [loading, setLoading] = useState(true);
  const [copilot, setCopilot] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [categoryDemands, setCategoryDemands] = useState<any[]>([]);
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [sellerProducts, setSellerProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [demandResult, setDemandResult] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [copilotRes, readyRes, oppRes, modelRes, prodsRes] = await Promise.allSettled([
        api.sellerCopilotInsight(),
        api.sellerReadiness(),
        api.sellerOpportunities(),
        api.mlModelInfo(),
        api.sellerProducts()
      ]);

      if (copilotRes.status === "fulfilled" && copilotRes.value) {
        setCopilot(copilotRes.value);
      }
      if (readyRes.status === "fulfilled" && readyRes.value) {
        setReadiness(readyRes.value);
      }
      let prodsList: any[] = [];
      if (prodsRes.status === "fulfilled" && Array.isArray(prodsRes.value)) {
        prodsList = prodsRes.value;
        setSellerProducts(prodsList);
      }
      if (oppRes.status === "fulfilled" && oppRes.value) {
        const oppData = oppRes.value;
        const oppList = Array.isArray(oppData.opportunities)
          ? oppData.opportunities
          : Array.isArray(oppData)
          ? oppData
          : [];
        setOpportunities(oppList);

        const catList = Array.isArray(oppData.category_demand) ? oppData.category_demand : [];
        setCategoryDemands(catList);

        if (!copilot && oppData.copilot_insight) {
          setCopilot(oppData.copilot_insight);
        }

        // Fallback: derive products from opportunities if sellerProducts was empty
        if (prodsList.length === 0 && oppList.length > 0) {
          const derived = oppList
            .filter((o: any) => o.product_id != null)
            .map((o: any) => ({
              id: o.product_id,
              title: o.product_title || o.headline,
              category: o.category,
              price: o.current_price
            }));
          if (derived.length > 0) {
            prodsList = derived;
            setSellerProducts(derived);
          }
        }
      }
      if (modelRes.status === "fulfilled" && modelRes.value) {
        setModelInfo(modelRes.value);
      }

      // Automatically forecast for first product if available
      if (prodsList.length > 0) {
        const initialProd = prodsList[0];
        setSelectedProduct(initialProd);
        api.predictProductDemand(initialProd.id)
          .then((res) => setDemandResult(res))
          .catch(() => {});
      }

      const count = await getQueueCount();
      setOfflineCount(count);
    } catch {
      // Handled cleanly via state
    } finally {
      setLoading(false);
    }
  }, [copilot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePredictProduct = async (product: any) => {
    if (!product || !product.id) return;
    setSelectedProduct(product);
    setPredicting(true);
    setDemandResult(null);
    try {
      const res = await api.predictProductDemand(product.id);
      setDemandResult(res);
    } catch (e: any) {
      Alert.alert("Demand Forecast Notice", e?.detail || e?.message || "Could not fetch demand forecast for this craft product.");
    } finally {
      setPredicting(false);
    }
  };

  const handleSyncOffline = async () => {
    setSyncing(true);
    try {
      const res = await syncOfflineQueue();
      const count = await getQueueCount();
      setOfflineCount(count);
      Alert.alert("Offline Sync", `Sync completed. ${res.syncedCount} items processed.`);
    } catch (e: any) {
      Alert.alert("Sync Notice", e?.message || "Unable to sync offline items.");
    } finally {
      setSyncing(false);
    }
  };


  return (
    <Screen safeArea={false}>
      <Header
        title="Demand & Intelligence"
        subtitle="Marketplace Demand, ML Forecasts & Readiness"
        showBack={false}
        rightAction={{
          icon: "refresh-outline",
          onPress: loadData
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Readiness Overview */}
        <Card style={styles.readinessCard}>
          <View style={styles.readinessTop}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.readinessTitle}>Catalogue Readiness</Text>
              <Text style={styles.readinessSub}>
                {readiness?.next_best_action || "Listing completeness & verification status"}
              </Text>
            </View>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>
                {readiness?.score != null ? `${readiness.score}%` : loading ? "…" : "0%"}
              </Text>
            </View>
          </View>

          {(Array.isArray(readiness?.strengths) && readiness.strengths.length > 0) ||
          (Array.isArray(readiness?.improvements) && readiness.improvements.length > 0) ? (
            <View style={styles.readinessBadges}>
              {Array.isArray(readiness?.strengths) &&
                readiness.strengths.map((st: string, idx: number) => (
                  <View key={`str-${idx}`} style={styles.badgeItem}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                    <Text style={styles.badgeItemText}>{st}</Text>
                  </View>
                ))}
              {Array.isArray(readiness?.improvements) &&
                readiness.improvements.map((imp: string, idx: number) => (
                  <View key={`imp-${idx}`} style={styles.badgeItem}>
                    <Ionicons name="alert-circle-outline" size={16} color={theme.colors.warning} />
                    <Text style={[styles.badgeItemText, { color: theme.colors.warning }]}>
                      Action needed: {imp}
                    </Text>
                  </View>
                ))}
            </View>
          ) : (
            <Text style={styles.emptyNoticeText}>
              {loading ? "Evaluating catalogue readiness…" : "List products to evaluate studio readiness."}
            </Text>
          )}
        </Card>

        {/* AI Business Copilot Strategic Advisor */}
        <SectionHeader
          title="Artisan Copilot (Strategic Advisor)"
          subtitle="Real-time guidance calculated from your catalog inventory & buyer activity"
        />

        <Card style={styles.copilotCard}>
          <View style={styles.copilotHeader}>
            <View style={styles.copilotAvatar}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.copilotTitle}>
                {copilot?.headline || "Studio Demand Copilot"}
              </Text>
              <Text style={styles.copilotMeta}>
                {copilot?.category ? `Category: ${copilot.category}` : "Platform Telemetry"}
                {copilot?.demand_label ? ` · Demand: ${copilot.demand_label}` : ""}
              </Text>
            </View>
          </View>

          <Text style={styles.copilotText}>
            {copilot?.narrative ||
              (loading
                ? "Analyzing market demand telemetry…"
                : "No active craft products listed yet. Create your first craft listing in AI Catalog Studio to activate automated pricing recommendations and market demand tracking.")}
          </Text>

          {copilot?.next_best_action && (
            <View style={styles.actionItemBox}>
              <Ionicons name="arrow-forward-circle" size={18} color={theme.colors.primary} />
              <Text style={styles.actionItemText}>
                <Text style={{ fontWeight: "700" }}>Recommended Action: </Text>
                {copilot.next_best_action}
              </Text>
            </View>
          )}

          {Array.isArray(copilot?.recommended_actions) && copilot.recommended_actions.length > 0 && (
            <View style={styles.actionList}>
              <Text style={styles.actionListTitle}>Action Steps:</Text>
              {copilot.recommended_actions.map((act: string, idx: number) => (
                <View key={idx} style={styles.actionItem}>
                  <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
                  <Text style={styles.actionItemText}>{act}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ─── SECTION 1: MARKET CATEGORY DEMAND (BUYER TRAFFIC & ACTIVITY) ─── */}
        <SectionHeader
          title="Marketplace Category Demand"
          subtitle="Live buyer searches, saves, and orders across craft sectors (distinct from comparable products)"
        />

        {categoryDemands.length > 0 ? (
          <View style={styles.demandCardsContainer}>
            {categoryDemands.map((cat, idx) => {
              const isHigh = cat.demand_level === "HIGH" || cat.demand_pct >= 20;
              const trendDirection = cat.trend_direction || "STABLE";
              return (
                <Card key={`cat-demand-${idx}`} style={styles.demandCatCard}>
                  <View style={styles.demandCatHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.demandCatTitle}>{cat.category}</Text>
                      <Text style={styles.demandCatSource}>
                        {cat.data_source_label || "Live Marketplace"} · {cat.total_buyer_events ?? 0} buyer interactions
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.demandTag,
                        {
                          backgroundColor: isHigh
                            ? theme.colors.success + "20"
                            : theme.colors.surfaceVariant
                        }
                      ]}
                    >
                      <Ionicons
                        name={trendDirection === "INCREASING" ? "trending-up" : "remove"}
                        size={14}
                        color={isHigh ? theme.colors.success : theme.colors.inkMuted}
                      />
                      <Text
                        style={[
                          styles.demandTagText,
                          { color: isHigh ? theme.colors.success : theme.colors.ink }
                        ]}
                      >
                        {cat.demand_pct_label || `${cat.demand_pct}%`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.demandCatFooter}>
                    <Text style={styles.demandBenchmarkText}>
                      Marketplace Price Range: <Text style={{ fontWeight: "700" }}>{cat.benchmark_price_range || "N/A"}</Text>
                    </Text>
                    {cat.event_breakdown && typeof cat.event_breakdown === "object" && (
                      <Text style={styles.demandEventBreakdown}>
                        Orders: {cat.event_breakdown.ORDER ?? 0} · Views: {cat.event_breakdown.VIEW ?? 0}
                      </Text>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={24} color={theme.colors.inkMuted} />
            <Text style={styles.emptyCardText}>
              {loading
                ? "Aggregating category buyer interactions…"
                : "Awaiting marketplace buyer views and orders to calculate live category demand trends."}
            </Text>
          </Card>
        )}

        {/* ─── SECTION 2: ML DEMAND FORECASTING (RANDOM FOREST ENGINE) ─── */}
        <SectionHeader
          title="Random Forest Demand Forecast"
          subtitle="Machine learning demand forecasting grounded in actual buyer telemetry"
        />

        <Card style={styles.mlCard}>
          <View style={styles.mlHeader}>
            <Ionicons name="bulb-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.mlTitle}>Product Demand Engine</Text>
          </View>
          <Text style={styles.mlDesc}>
            Select one of your catalog products to evaluate real-time ML buyer demand grounded in actual marketplace telemetry:
          </Text>

          {sellerProducts.length > 0 ? (
            <View style={styles.chipsRow}>
              {sellerProducts.map((prod) => (
                <Chip
                  key={prod.id}
                  label={prod.title || `Product #${prod.id}`}
                  selected={selectedProduct?.id === prod.id}
                  onPress={() => handlePredictProduct(prod)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.noProductsBox}>
              <Ionicons name="cube-outline" size={24} color={theme.colors.inkMuted} />
              <Text style={styles.noProductsText}>
                No published craft listings found. Publish your craft listings in AI Catalog Studio to run live telemetry-driven demand forecasting.
              </Text>
            </View>
          )}

          {predicting && (
            <View style={styles.predictingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.predictingText}>
                Evaluating ML demand forecast for {selectedProduct?.title || "product"}…
              </Text>
            </View>
          )}

          {demandResult && (
            <View style={styles.demandBox}>
              <View style={styles.demandRow}>
                <Text style={styles.demandLabel}>Evaluated Product:</Text>
                <Text style={styles.demandProductTitle} numberOfLines={1}>
                  {demandResult.product_title || selectedProduct?.title || `#${selectedProduct?.id}`}
                </Text>
              </View>

              {demandResult.is_cold_start ? (
                <View style={{ backgroundColor: theme.colors.surfaceVariant, padding: 10, borderRadius: theme.radius.sm, marginTop: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ ...theme.typography.caption, fontWeight: "700", color: theme.colors.primary }}>
                      Cold Start — Awaiting Buyer Telemetry
                    </Text>
                  </View>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.inkLight, lineHeight: 16 }}>
                    {demandResult.explanation || "This newly published listing is gathering initial buyer interactions. Dynamic pricing is safely held at 1.000x neutral baseline to protect artisan margins."}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={[styles.demandRow, { marginTop: 6 }]}>
                    <Text style={styles.demandLabel}>Predicted Demand:</Text>
                    <Text
                      style={[
                        styles.demandValue,
                        {
                          color:
                            demandResult.demand_level === "HIGH"
                              ? theme.colors.success
                              : demandResult.demand_level === "LOW"
                              ? theme.colors.warning
                              : theme.colors.primary
                        }
                      ]}
                    >
                      {demandResult.demand_level || "CALCULATED"} (
                      {demandResult.predicted_demand_score != null
                        ? Math.round(demandResult.predicted_demand_score)
                        : 0}
                      /100) · {demandResult.confidence || "MEDIUM"} Confidence
                    </Text>
                  </View>

                  <View style={[styles.demandRow, { marginTop: 6 }]}>
                    <Text style={styles.demandLabel}>Demand Multiplier:</Text>
                    <Text style={styles.demandSubValue}>
                      {demandResult.ml_demand_multiplier != null && demandResult.ml_demand_multiplier !== 1.0
                        ? `${demandResult.ml_demand_multiplier > 1 ? "+" : ""}${Math.round(
                            (demandResult.ml_demand_multiplier - 1) * 100
                          )}% price ${demandResult.ml_demand_multiplier > 1 ? "surge" : "softening"}`
                        : "1.000x (Neutral Baseline)"}
                    </Text>
                  </View>

                  {demandResult.explanation && (
                    <Text style={{ ...theme.typography.caption, color: theme.colors.inkMuted, marginTop: 6, fontStyle: "italic" }}>
                      {demandResult.explanation}
                    </Text>
                  )}
                </>
              )}

              {demandResult.features && (
                <View style={styles.telemetryGrid}>
                  <View style={styles.telemetryItem}>
                    <Text style={styles.telemetryItemLabel}>Active</Text>
                    <Text style={styles.telemetryItemValue}>{demandResult.features.days_active ?? 0}d</Text>
                  </View>
                  <View style={styles.telemetryItem}>
                    <Text style={styles.telemetryItemLabel}>Views</Text>
                    <Text style={styles.telemetryItemValue}>{demandResult.features.views ?? 0}</Text>
                  </View>
                  <View style={styles.telemetryItem}>
                    <Text style={styles.telemetryItemLabel}>Saves</Text>
                    <Text style={styles.telemetryItemValue}>{demandResult.features.saves ?? 0}</Text>
                  </View>
                  <View style={styles.telemetryItem}>
                    <Text style={styles.telemetryItemLabel}>Enquiries</Text>
                    <Text style={styles.telemetryItemValue}>{demandResult.features.enquiries ?? 0}</Text>
                  </View>
                  <View style={styles.telemetryItem}>
                    <Text style={styles.telemetryItemLabel}>Orders</Text>
                    <Text style={styles.telemetryItemValue}>{demandResult.features.orders ?? 0}</Text>
                  </View>
                </View>
              )}

              <Text style={styles.demandSub}>
                Data Source: {demandResult.model_info?.training_data_source || demandResult.model_source || "Domain-Informed Prior (Bootstrap Series)"}
              </Text>
            </View>
          )}

          <View style={styles.modelMetaBox}>
            {modelInfo?.metadata?.is_real_marketplace_data ? (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={theme.colors.success} style={{ marginRight: 4 }} />
                  <Text style={[styles.modelMetaText, { fontWeight: "700", color: theme.colors.success }]}>
                    Production Model: Trained on Live Marketplace Telemetry
                  </Text>
                </View>
                <Text style={styles.modelMetaText}>
                  Engine: {modelInfo.metadata.model_name || "RandomForestRegressor"} · Temporal CV R²: {modelInfo.metadata.temporal_cv_r2_mean != null ? `${Math.round(modelInfo.metadata.temporal_cv_r2_mean * 100)}%` : (modelInfo.metadata.r2_score != null ? `${Math.round(modelInfo.metadata.r2_score * 100)}%` : "Active")} ({modelInfo.metadata.n_samples || 0} real event snapshots)
                </Text>
              </View>
            ) : (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.modelMetaText, { fontWeight: "700", color: theme.colors.ink }]}>
                    Model Baseline: Domain-Informed Prior (Bootstrap Series)
                  </Text>
                </View>
                <Text style={styles.modelMetaText}>
                  Engine: {modelInfo?.metadata?.model_name || "RandomForestRegressor"} · Validation: Domain-Informed Prior Baseline · Marketplace validation: Not yet available (Awaiting live telemetry set: ≥20 products, ≥200 events, ≥14 days span)
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* ─── SECTION 3: CATALOG RESTOCK & DEMAND OPPORTUNITIES ─── */}
        {opportunities.length > 0 && (
          <>
            <SectionHeader
              title="Catalog Inventory & Demand Opportunities"
              subtitle="Specific products in your catalog identified with rising buyer demand or low stock"
            />
            {opportunities.map((opp, i) => (
              <Card key={`opp-${i}`} style={styles.oppCard}>
                <View style={styles.oppTop}>
                  <Text style={styles.oppTitle}>{opp.product_title || opp.headline}</Text>
                  <Text style={styles.oppTag}>
                    {opp.category} {opp.demand_label ? `· ${opp.demand_label}` : ""}
                  </Text>
                </View>
                <Text style={styles.oppDesc}>{opp.narrative}</Text>

                {opp.next_best_action && (
                  <View style={styles.oppActionRow}>
                    <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.oppActionText}>{opp.next_best_action}</Text>
                  </View>
                )}

                <View style={styles.oppFooter}>
                  <Text style={styles.oppPrice}>
                    {opp.recommended_price != null
                      ? `Recommended: ₹${Math.round(opp.recommended_price)} (Current: ₹${Math.round(
                          opp.current_price || 0
                        )})`
                      : `Stock: ${opp.stock ?? 0} units`}
                  </Text>
                  <SecondaryButton
                    title="Review Craft"
                    size="small"
                    onPress={() => router.push("/seller-products")}
                  />
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Offline Queue Management */}
        <SectionHeader
          title="Device Storage & Offline Queue"
          subtitle="Direct local-to-cloud synchronization for rural areas"
        />

        <Card style={styles.offlineCard}>
          <View style={styles.offlineHeader}>
            <View>
              <Text style={styles.offlineTitle}>Offline Pending Operations</Text>
              <Text style={styles.offlineCount}>
                {offlineCount} pending actions waiting for cloud sync
              </Text>
            </View>
            <Ionicons
              name={offlineCount > 0 ? "cloud-offline-outline" : "cloud-done-outline"}
              size={28}
              color={offlineCount > 0 ? theme.colors.warning : theme.colors.success}
            />
          </View>

          <View style={styles.offlineActions}>
            <PrimaryButton
              title={syncing ? "Syncing…" : "Sync Offline Queue"}
              icon="sync-outline"
              onPress={handleSyncOffline}
              disabled={syncing}
            />
          </View>
        </Card>
      </ScrollView>

      <BottomNavigation role="seller" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 120
  },
  readinessCard: {
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg
  },
  readinessTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  readinessTitle: {
    ...theme.typography.h3,
    color: theme.colors.ink
  },
  readinessSub: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginTop: 2
  },
  scoreCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.primaryLight + "20",
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  scoreNumber: {
    ...theme.typography.h3,
    color: theme.colors.primary,
    fontWeight: "900"
  },
  readinessBadges: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 8
  },
  badgeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  badgeItemText: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkLight,
    fontWeight: "500",
    flex: 1
  },
  emptyNoticeText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginTop: theme.spacing.sm
  },
  copilotCard: {
    backgroundColor: "#FFFFFF",
    borderColor: theme.colors.primaryLight + "40",
    borderWidth: 1.5,
    marginBottom: theme.spacing.lg
  },
  copilotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: theme.spacing.sm
  },
  copilotAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  copilotTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.primary,
    fontWeight: "800"
  },
  copilotMeta: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted
  },
  copilotText: {
    ...theme.typography.body,
    color: theme.colors.ink,
    lineHeight: 22
  },
  actionItemBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.primaryLight + "15",
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    marginTop: theme.spacing.md
  },
  actionList: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 6
  },
  actionListTitle: {
    ...theme.typography.caption,
    fontWeight: "700",
    color: theme.colors.inkMuted,
    marginBottom: 4
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  actionItemText: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkLight,
    flex: 1
  },
  demandCardsContainer: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg
  },
  demandCatCard: {
    backgroundColor: "#FFFFFF",
    padding: theme.spacing.md
  },
  demandCatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  demandCatTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.ink,
    fontWeight: "700"
  },
  demandCatSource: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginTop: 2
  },
  demandTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full
  },
  demandTagText: {
    fontSize: 11,
    fontWeight: "800"
  },
  demandCatFooter: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  demandBenchmarkText: {
    ...theme.typography.caption,
    color: theme.colors.inkLight
  },
  demandEventBreakdown: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    fontSize: 10
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    marginBottom: theme.spacing.lg,
    gap: 8
  },
  emptyCardText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    textAlign: "center",
    maxWidth: 260
  },
  mlCard: {
    marginBottom: theme.spacing.lg
  },
  mlHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  mlTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.ink
  },
  mlDesc: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkMuted,
    marginBottom: theme.spacing.sm
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: theme.spacing.sm
  },
  predictingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8
  },
  predictingText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: "600"
  },
  demandBox: {
    backgroundColor: theme.colors.surfaceVariant,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs
  },
  demandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  demandLabel: {
    ...theme.typography.bodySmall,
    fontWeight: "600",
    color: theme.colors.ink
  },
  demandValue: {
    ...theme.typography.subtitle,
    fontWeight: "800"
  },
  demandSubValue: {
    ...theme.typography.bodySmall,
    fontWeight: "700",
    color: theme.colors.ink
  },
  demandProductTitle: {
    ...theme.typography.bodySmall,
    fontWeight: "700",
    color: theme.colors.ink,
    maxWidth: "60%",
    textAlign: "right"
  },
  telemetryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: 4
  },
  telemetryItem: {
    alignItems: "center",
    flex: 1
  },
  telemetryItemLabel: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    fontSize: 10,
    textTransform: "uppercase"
  },
  telemetryItemValue: {
    ...theme.typography.bodySmall,
    fontWeight: "800",
    color: theme.colors.ink,
    marginTop: 2
  },
  noProductsBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    gap: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.md,
    marginVertical: theme.spacing.xs
  },
  noProductsText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    textAlign: "center",
    lineHeight: 18
  },
  demandSub: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginTop: 6
  },
  modelMetaBox: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  modelMetaText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    fontSize: 10
  },
  oppCard: {
    marginBottom: theme.spacing.sm
  },
  oppTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  oppTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.ink,
    flex: 1,
    marginRight: 8
  },
  oppTag: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: "700",
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full
  },
  oppDesc: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkLight,
    marginBottom: 6
  },
  oppActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8
  },
  oppActionText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: "600",
    flex: 1
  },
  oppFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4
  },
  oppPrice: {
    ...theme.typography.caption,
    color: theme.colors.ink,
    fontWeight: "700"
  },
  offlineCard: {
    marginBottom: theme.spacing.xl
  },
  offlineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md
  },
  offlineTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.ink
  },
  offlineCount: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginTop: 2
  },
  offlineActions: {
    gap: 8
  }
});
