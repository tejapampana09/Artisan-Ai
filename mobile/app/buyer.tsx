import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, AntDesign, Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../src/api";
import { theme } from "../src/theme";
import { clearSession } from "../src/storage";
import { addToCart, getCartCount, subscribeCart } from "../src/cart";
import { getWishlist, subscribeWishlist, toggleWishlist } from "../src/wishlist";
import { BottomNavigation } from "../src/components";
import { subscribeNotifications } from "../src/notifications";

const CACHE_KEY = "artisan_cached_marketplace_products";
const CATEGORIES = [
  "All Crafts",
  "Kalamkari",
  "Wooden Toys",
  "Blue Pottery",
  "Bidriware",
  "Pochampally Ikat"
];

export default function BuyerScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Crafts");
  const [savedProductIds, setSavedProductIds] = useState<Set<number>>(new Set());
  const [cartCount, setCartCount] = useState(0);
  const [addedToast, setAddedToast] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    loadProducts();
    updateCart();
    getWishlist().then((items) => setSavedProductIds(new Set(items.map((item) => item.id)))).catch(() => {});
    const unsub = subscribeCart(() => updateCart());
    const unsubWishlist = subscribeWishlist(() => {
      getWishlist().then((items) => setSavedProductIds(new Set(items.map((item) => item.id)))).catch(() => {});
    });
    const unsubNotifs = subscribeNotifications((_, count) => setUnreadNotifs(count));
    return () => {
      unsub();
      unsubWishlist();
      unsubNotifs();
    };
  }, []);

  const updateCart = async () => {
    try {
      const count = await getCartCount();
      setCartCount(count);
    } catch {}
  };

  const loadProducts = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          setLoading(false);
        }
      }
    } catch {}

    try {
      const data = await api.products();
      if (Array.isArray(data) && data.length > 0) {
        setProducts(data);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
      }
    } catch (err) {
      console.warn("Failed to fetch fresh products:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleSave = async (product: any) => {
    await toggleWishlist(product);
  };

  const handleQuickAdd = async (product: any) => {
    await addToCart(product, 1);
    setAddedToast("Added to Bag");
    setTimeout(() => setAddedToast(""), 2200);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.materials && p.materials.toLowerCase().includes(q)) ||
        (p.artisan_name && p.artisan_name.toLowerCase().includes(q));

      const matchesCat =
        selectedCategory === "All Crafts" ||
        (p.category && p.category.toLowerCase().includes(selectedCategory.toLowerCase()));

      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

  const trendingProducts = useMemo(() => {
    return products.slice(0, 4);
  }, [products]);

  const renderProductItem = ({ item }: { item: any }) => {
    const isSaved = savedProductIds.has(item.id);
    const hasDiscount = item.original_price && item.original_price > item.price;
    const discountPct = hasDiscount
      ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
      : 0;

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/product",
            params: { id: String(item.id) }
          } as any)
        }
      >
        {/* Aspect 4:5 Portrait Image */}
        <View style={styles.imageBox}>
          <Image
            source={{ uri: item.image_url || "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400" }}
            style={styles.productImg}
            resizeMode="cover"
          />

          {/* Wishlist Heart */}
          <Pressable
            style={[styles.heartBtn, isSaved && styles.heartBtnActive]}
              onPress={async (e) => {
              e.stopPropagation();
                await handleToggleSave(item);
            }}
            hitSlop={8}
          >
            <Ionicons
              name={isSaved ? "heart" : "heart-outline"}
              size={15}
              color={isSaved ? "#E11D48" : "#4B5563"}
            />
          </Pressable>

          {/* Category Tag on Image */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText} numberOfLines={1}>
              {item.category || "Handloom"}
            </Text>
          </View>
        </View>

        {/* Product Details */}
        <View style={styles.cardInfo}>
          <Text style={styles.artisanName} numberOfLines={1}>
            {item.artisan_name || "AUTHENTIC INDIAN CRAFT"}
          </Text>

          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title || "Handcrafted Product"}
          </Text>

          {/* Price & Stock Row */}
          <View style={styles.priceRow}>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={styles.priceText}>₹{Number(item.price || 0).toLocaleString("en-IN")}</Text>
              {hasDiscount && (
                <Text style={styles.origPriceText}>₹{Number(item.original_price).toLocaleString("en-IN")}</Text>
              )}
            </View>

            {item.stock > 0 ? (
              <View style={styles.stockBadge}>
                <Text style={styles.stockBadgeText}>{item.stock} in stock</Text>
              </View>
            ) : (
              <View style={styles.outOfStockBadge}>
                <Text style={styles.outOfStockText}>Pre-Order</Text>
              </View>
            )}
          </View>

          {/* ONDC Shipping Info */}
          <Text style={styles.shippingText}>🚚 Direct Artisan Delivery • ONDC</Text>
        </View>

        {/* Add to Cart Button */}
        <Pressable
          style={styles.addToCartBtn}
          onPress={(e) => {
            e.stopPropagation();
            handleQuickAdd(item);
          }}
        >
          <Ionicons name="bag-handle-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.addToCartText}>Add to Cart</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />

      {/* Top Navbar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image
            source={require("../assets/clean-logo-mark.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandTitle}>ARTISAN AI</Text>
            <Text style={styles.brandTag}>Rural Craft Commerce & Intelligence</Text>
          </View>
        </View>

        <View style={styles.topActions}>
          <Pressable
            style={styles.topIconBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={8}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={21} color={theme.ink} />
            {unreadNotifs > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadNotifs > 99 ? "99+" : unreadNotifs}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={styles.topIconBtn}
            onPress={() => router.push("/settings" as any)}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={21} color={theme.ink} />
          </Pressable>
        </View>
      </View>

      {/* Mode Switcher Pills (Web Match: Buy Crafts vs Sell as Artisan) */}
      <View style={styles.modePillContainer}>
        <Pressable style={[styles.modePill, styles.modePillActive]}>
          <Ionicons name="bag-handle" size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.modePillTextActive}>Buy Crafts</Text>
        </Pressable>

        <Pressable
          style={styles.modePill}
          onPress={async () => {
            await clearSession("MARKETPLACE");
            router.replace({ pathname: "/login", params: { role: "seller", redirect: "/seller" } });
          }}
        >
          <Ionicons name="storefront-outline" size={14} color={theme.muted} style={{ marginRight: 6 }} />
          <Text style={styles.modePillText}>Sell as Artisan 🎨</Text>
        </Pressable>
      </View>

      {/* Added to Bag Toast */}
      {addedToast ? (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>{addedToast}</Text>
        </View>
      ) : null}

      {/* Main List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item, index) => String(item.id ?? index)}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadProducts();
        }}
        ListHeaderComponent={
          <View>
            {/* Search Bar with Pill Shape */}
            <View style={styles.searchWrapper}>
              <Ionicons name="search-outline" size={18} color="#8C7A6B" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search sarees, lacquer toys, pottery, brass…"
                placeholderTextColor="#9E9E9E"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                  <Ionicons name="close-circle" size={18} color="#8C7A6B" />
                </Pressable>
              )}
            </View>

            {/* Horizontal Category Carousel */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                  >
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Trending Across India Row (Matching Web BuyView) */}
            {!searchQuery && selectedCategory === "All Crafts" && trendingProducts.length > 0 && (
              <View style={styles.trendingSection}>
                <View style={styles.trendingHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>🔥</Text>
                    <Text style={styles.trendingTitle}>Trending Across India</Text>
                  </View>
                  <Text style={styles.trendingSub}>High Artisan Demand</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                >
                  {trendingProducts.map((p) => (
                    <Pressable
                      key={"trend-" + p.id}
                      style={styles.trendCard}
                      onPress={() =>
                        router.push({
                          pathname: "/product",
                          params: { id: String(p.id) }
                        } as any)
                      }
                    >
                      <Image source={{ uri: p.image_url }} style={styles.trendImg} />
                      <View style={styles.hotTag}>
                        <Text style={styles.hotTagText}>HOT</Text>
                      </View>
                      <Text style={styles.trendTitle} numberOfLines={1}>{p.title}</Text>
                      <Text style={styles.trendPrice}>₹{Number(p.price).toLocaleString("en-IN")}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Section Header */}
            <View style={styles.gridHeader}>
              <Text style={styles.gridTitle}>
                {selectedCategory === "All Crafts" ? "All Artisan Collections" : selectedCategory + " Collection"}
              </Text>
              <Text style={styles.gridCount}>{filteredProducts.length} items</Text>
            </View>
          </View>
        }
        renderItem={renderProductItem}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator color={theme.accent} size="large" />
              <Text style={styles.emptyText}>Loading marketplace crafts…</Text>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="bag-outline" size={48} color="#D1C7BD" />
              <Text style={styles.emptyTitle}>No crafts found</Text>
              <Text style={styles.emptyText}>Try adjusting your search or selecting "All Crafts".</Text>
            </View>
          )
        }
      />

      {/* Role-Based Bottom Navigation */}
      <BottomNavigation role="buyer" />

      {/* Notifications Modal */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <Pressable onPress={() => setShowNotifications(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={theme.ink} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                {
                  id: 1,
                  title: "New GI Tag Collection Available",
                  msg: "Master artisan S. Rao has listed authentic Kalamkari stoles from Srikalahasti.",
                  time: "2h ago"
                },
                {
                  id: 2,
                  title: "Fair Price Guarantee Active",
                  msg: "Cost-plus margin floor is now enforced on all regional terracotta collections.",
                  time: "5h ago"
                },
                {
                  id: 3,
                  title: "Free Delivery via ONDC",
                  msg: "Direct artisan-to-doorstep shipping is free on all handcrafted orders.",
                  time: "1d ago"
                }
              ].map(n => (
                <View key={n.id} style={styles.notifCard}>
                  <View style={styles.notifIcon}>
                    <Text style={{ fontSize: 16 }}>🏺</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifCardTitle}>{n.title}</Text>
                    <Text style={styles.notifCardMsg}>{n.msg}</Text>
                    <Text style={styles.notifCardTime}>{n.time}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAF9F6"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 10 : 14,
    paddingBottom: 14,
    backgroundColor: "#FAF9F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DF"
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 8
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2,
    color: theme.accent
  },
  brandTag: {
    fontSize: 9,
    fontWeight: "600",
    color: theme.muted
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  topIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  notifDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#E11D48"
  },
  modePillContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#FAF9F6"
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  modePillActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.muted
  },
  modePillTextActive: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 22,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.ink
  },
  clearSearchBtn: {
    padding: 4
  },
  categoryScroll: {
    marginBottom: 14
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  categoryChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.ink
  },
  categoryChipTextActive: {
    color: "#FFFFFF"
  },
  trendingSection: {
    marginBottom: 16
  },
  trendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10
  },
  trendingTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.ink
  },
  trendingSub: {
    fontSize: 11,
    color: theme.muted,
    fontWeight: "600"
  },
  trendCard: {
    width: 130,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  trendImg: {
    width: "100%",
    height: 85,
    borderRadius: 8,
    marginBottom: 6
  },
  hotTag: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#E11D48",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  hotTagText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900"
  },
  trendTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.ink
  },
  trendPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.accent,
    marginTop: 2
  },
  gridHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.ink
  },
  gridCount: {
    fontSize: 12,
    color: theme.muted,
    fontWeight: "600"
  },
  listContent: {
    paddingBottom: 90
  },
  columnWrapper: {
    paddingHorizontal: 12,
    justifyContent: "space-between"
  },
  card: {
    width: "48.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
    justifyContent: "space-between"
  },
  imageBox: {
    position: "relative",
    width: "100%",
    height: 175,
    backgroundColor: "#F2EDE4"
  },
  productImg: {
    width: "100%",
    height: "100%"
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  heartBtnActive: {
    backgroundColor: "#FFE4E6"
  },
  categoryBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(28, 28, 28, 0.85)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  cardInfo: {
    padding: 10,
    flex: 1
  },
  artisanName: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.accent,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.ink,
    lineHeight: 16,
    minHeight: 32
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6
  },
  priceText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.ink
  },
  origPriceText: {
    fontSize: 11,
    color: "#9E9E9E",
    textDecorationLine: "line-through",
    marginLeft: 5
  },
  stockBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#C8E6C9"
  },
  stockBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2E7D32"
  },
  outOfStockBadge: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  outOfStockText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#E65100"
  },
  shippingText: {
    fontSize: 9,
    color: "#8C7A6B",
    marginTop: 4,
    fontWeight: "600"
  },
  addToCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accent,
    marginHorizontal: 10,
    marginBottom: 10,
    paddingVertical: 8,
    borderRadius: 10
  },
  addToCartText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800"
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#E8E5DF",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.muted,
    marginTop: 2
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: theme.accent,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900"
  },
  toast: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    zIndex: 999,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1C",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  emptyBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.ink,
    marginTop: 10
  },
  emptyText: {
    fontSize: 12,
    color: theme.muted,
    textAlign: "center",
    marginTop: 4
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "70%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.ink
  },
  notifCard: {
    flexDirection: "row",
    backgroundColor: "#FAF9F6",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F7EFEA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  notifCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 2
  },
  notifCardMsg: {
    fontSize: 12,
    color: theme.muted,
    lineHeight: 16,
    marginBottom: 4
  },
  notifCardTime: {
    fontSize: 10,
    color: "#9E9E9E"
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
  }
});
