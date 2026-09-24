import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  Alert,
  ScrollView,
  Switch
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";
import {
  Screen,
  Header,
  BottomNavigation,
  SearchBar,
  StatusBadge,
  Chip,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Modal,
  PriceCard,
  PrimaryButton
} from "../src/components";
import { useRoleGuard } from "../src/authGuard";

export default function SellerProducts() {
  useRoleGuard("seller");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [errorMessage, setErrorMessage] = useState("");

  // Pricing Modal State
  const [pricingProduct, setPricingProduct] = useState<any>(null);
  const [pricingRec, setPricingRec] = useState<any>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [acceptingPrice, setAcceptingPrice] = useState(false);

  const loadProducts = async () => {
    setErrorMessage("");
    try {
      const data = await api.sellerProducts();
      setProducts(data || []);
    } catch (err: any) {
      setErrorMessage(err?.detail || err?.message || "Could not load products.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleOpenPricing = async (prod: any) => {
    setPricingProduct(prod);
    setLoadingRec(true);
    try {
      const rec = await api.priceRecommendation(prod.id);
      setPricingRec(rec);
    } catch (err: any) {
      Alert.alert(
        "Pricing Unavailable",
        err?.detail || err?.message || "Could not generate price recommendation."
      );
      setPricingProduct(null);
    } finally {
      setLoadingRec(false);
    }
  };

  const handleAcceptPrice = async () => {
    if (!pricingProduct) return;
    setAcceptingPrice(true);
    try {
      await api.submitPriceDecision(pricingProduct.id, "ACCEPT");
      Alert.alert("Price Updated", `Product price updated to recommended fair market value.`);
      setPricingProduct(null);
      loadProducts();
    } catch (err: any) {
      Alert.alert("Error", err?.detail || err?.message || "Failed to accept pricing.");
    } finally {
      setAcceptingPrice(false);
    }
  };

  const handleRejectPrice = async () => {
    if (!pricingProduct) return;
    try {
      await api.submitPriceDecision(pricingProduct.id, "REJECT");
      Alert.alert("Price Kept", `Current price retained.`);
      setPricingProduct(null);
    } catch (err: any) {
      Alert.alert("Error", err?.detail || err?.message || "Failed to record decision.");
    }
  };

  const handleToggleSmartPricing = async (productId: number) => {
    try {
      const res = await api.toggleSmartPricing(productId);
      const isNow = res?.auto_smart_pricing_enabled;
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, auto_smart_pricing_enabled: isNow } : p
        )
      );
    } catch (err: any) {
      Alert.alert("Error", err?.detail || err?.message || "Could not toggle smart pricing.");
    }
  };

  const handleDeleteProduct = (productId: number, title: string) => {
    Alert.alert(
      "Delete Craft Piece",
      `Are you sure you want to remove "${title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteProduct(productId);
              setProducts((prev) => prev.filter((p) => p.id !== productId));
            } catch (err: any) {
              Alert.alert("Delete Failed", err?.detail || err?.message || "Could not delete.");
            }
          }
        }
      ]
    );
  };

  const statusFilters = [
    { label: "All Pieces", value: "ALL" },
    { label: "Published", value: "PUBLISHED" },
    { label: "AI Drafts", value: "DRAFT" },
    { label: "In Review", value: "PENDING_APPROVAL" }
  ];

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.materials && p.materials.toLowerCase().includes(q));

    const status = (p.status || "").toUpperCase();
    let matchesStatus = true;
    if (selectedStatus === "PUBLISHED") matchesStatus = status === "PUBLISHED";
    else if (selectedStatus === "DRAFT") matchesStatus = status === "DRAFT" || status === "AI_GENERATED";
    else if (selectedStatus === "PENDING_APPROVAL") matchesStatus = status === "PENDING_APPROVAL" || status === "APPROVED";

    return matchesSearch && matchesStatus;
  });

  return (
    <Screen scrollable={false} withBottomNavPadding>
      <Header
        title="My Creations"
        subtitle={`${products.length} registered craft items`}
        roleBadge="ARTISAN"
        rightAction={
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push("/product-editor" as any)}
            accessibilityRole="button"
            accessibilityLabel="Add Craft Piece"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addBtnText}>New</Text>
          </Pressable>
        }
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Filter by title, category, materials…"
        />
      </View>

      {/* Status Filter Carousel */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {statusFilters.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              selected={selectedStatus === f.value}
              onPress={() => setSelectedStatus(f.value)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Product List */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <LoadingSkeleton />
          <LoadingSkeleton />
        </View>
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onRetry={loadProducts} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No Creations Found"
              description={
                searchQuery
                  ? "Try changing your search keywords or filter status."
                  : "Start by creating your first craft listing with AI."
              }
              actionLabel="Create with AI"
              onAction={() => router.push("/seller-ai")}
            />
          }
          renderItem={({ item }) => {
            const price = Number(item.price) || 0;
            const stock = Number(item.stock) || 0;
            const img =
              item.enhanced_image_url ||
              item.image_url ||
              "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400";
            const isAutoPricing = !!item.auto_smart_pricing_enabled;

            return (
              <View style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <Image source={{ uri: img }} style={styles.thumbnail} resizeMode="cover" />
                  <View style={styles.itemMeta}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.categoryText} numberOfLines={1}>
                        {item.category || "Handicraft"}
                      </Text>
                      <StatusBadge status={item.status || "PUBLISHED"} type="product" />
                    </View>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.title || "Handmade Craft"}
                    </Text>
                    <View style={styles.itemPriceRow}>
                      <Text style={styles.itemPrice}>₹{price.toLocaleString("en-IN")}</Text>
                      <View style={styles.stockBadge}>
                        <Text style={styles.stockBadgeText}>
                          {stock > 0 ? `${stock} in stock` : "Out of stock"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Streamlined Actions Row */}
                <View style={styles.itemActions}>
                  <Pressable
                    style={styles.actionBtnEdit}
                    onPress={() =>
                      router.push({
                        pathname: "/product-editor",
                        params: { id: String(item.id) }
                      } as any)
                    }
                    accessibilityRole="button"
                  >
                    <Ionicons name="create-outline" size={14} color="#1C1C1C" style={{ marginRight: 4 }} />
                    <Text style={styles.actionBtnEditText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionBtnPricing}
                    onPress={() => handleOpenPricing(item)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="sparkles" size={13} color="#A6533B" style={{ marginRight: 4 }} />
                    <Text style={styles.actionBtnPricingText}>Smart Pricing</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionBtnDelete}
                    onPress={() => handleDeleteProduct(item.id, item.title)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={15} color="#C62828" />
                  </Pressable>
                </View>

                {/* Subtle Smart Pricing Auto-Tuning Switch */}
                <View style={styles.smartPricingToggleRow}>
                  <View style={styles.toggleTextContainer}>
                    <Ionicons name="flash-outline" size={12} color="#8A726A" style={{ marginRight: 4 }} />
                    <Text style={styles.toggleLabel}>Auto-tune fair price</Text>
                  </View>
                  <Switch
                    value={isAutoPricing}
                    onValueChange={() => handleToggleSmartPricing(item.id)}
                    trackColor={{ false: "#E8E2D9", true: "#DEC0B7" }}
                    thumbColor={isAutoPricing ? "#A6533B" : "#FFFFFF"}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Smart Pricing Modal */}
      {pricingProduct && (
        <Modal
          visible={!!pricingProduct}
          onClose={() => setPricingProduct(null)}
          title={`Pricing: ${pricingProduct.title}`}
        >
          {loadingRec ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <LoadingSkeleton />
              <Text style={{ marginTop: 12, color: theme.colors.inkMuted }}>
                Analyzing craft cost floor & live demand telemetry…
              </Text>
            </View>
          ) : pricingRec ? (
            <PriceCard
              currentPrice={Number(pricingProduct.price) || 0}
              recommendedPrice={Number(pricingRec.recommended_price) || 0}
              costFloor={pricingRec.cost_floor ? Number(pricingRec.cost_floor) : undefined}
              marketRange={pricingRec.market_range}
              demandFactor={pricingRec.demand_factor}
              reasoning={pricingRec.reasoning}
              explanation={pricingRec.explanation}
              onAccept={handleAcceptPrice}
              onReject={handleRejectPrice}
              isAccepting={acceptingPrice}
            />
          ) : null}
        </Modal>
      )}

      <BottomNavigation role="seller" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 2
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs
  },
  filterBar: {
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 90
  },
  loadingBox: {
    padding: theme.spacing.lg
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    marginBottom: 12
  },
  itemTopRow: {
    flexDirection: "row"
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#F5EFEB"
  },
  itemMeta: {
    flex: 1,
    marginLeft: 12
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#8A726A",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1C1C1C",
    lineHeight: 18
  },
  itemPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "900",
    color: "#A6533B"
  },
  stockBadge: {
    backgroundColor: "#FAF7F2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B5B51"
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F5EFEB"
  },
  actionBtnEdit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAF7F2",
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  actionBtnEditText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C1C1C"
  },
  actionBtnPricing: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF3F0",
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  actionBtnPricingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A6533B"
  },
  actionBtnDelete: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#FFEBEE"
  },
  smartPricingToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF7F2",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 8
  },
  toggleTextContainer: {
    flexDirection: "row",
    alignItems: "center"
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B5B51"
  }
});
