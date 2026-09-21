import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons, AntDesign, Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../src/api";
import { theme } from "../src/theme";
import { clearSession, getSession } from "../src/storage";
import { addToCart, getCartCount, subscribeCart } from "../src/cart";
import { getWishlist, subscribeWishlist, toggleWishlist } from "../src/wishlist";
import { BottomNavigation, LanguageSelectorModal, DeliveryAddressModal } from "../src/components";
import { subscribeNotifications } from "../src/notifications";
import { useI18n } from "../src/i18n";
import { useRoleGuard } from "../src/authGuard";
import { getActiveDeliveryAddress } from "../src/address";

const CACHE_KEY = "artisan_cached_marketplace_products";
const FALLBACK_CATEGORIES = [
  "All Crafts",
  "Handicraft",
  "Apparel & Sarees",
  "Electronics Accessories",
  "Jewellery & Metalware",
  "Home & Living"
];

function getLocalizedProductTitle(item: any, lang: string): string {
  if (lang !== "en" && item?.translations) {
    try {
      const trans = typeof item.translations === "string" ? JSON.parse(item.translations) : item.translations;
      if (trans && trans[lang] && trans[lang].title) {
        const title = trans[lang].title;
        const desc = trans[lang].description || "";
        const hasDevanagari = /[\u0900-\u097F]/.test(title) || /[\u0900-\u097F]/.test(desc);
        if (!((lang === "te" || lang === "ta" || lang === "bn") && hasDevanagari)) {
          return title;
        }
      }
    } catch {}
  }
  return item?.title || "Handcrafted Product";
}

export default function BuyerScreen() {
  useRoleGuard("buyer");
  const { language, t, getCategory } = useI18n();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const params = useLocalSearchParams<{ category?: string; search?: string }>();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Crafts");
  const [sortBy, setSortBy] = useState<"POPULAR" | "PRICE_LOW" | "PRICE_HIGH" | "UNDER_2000">("POPULAR");
  const [savedProductIds, setSavedProductIds] = useState<Set<number>>(new Set());
  const [cartCount, setCartCount] = useState(0);
  const [addedToast, setAddedToast] = useState("");
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [userName, setUserName] = useState("Teja");
  const [userAddress, setUserAddress] = useState("");
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);

  // Dynamically derive categories strictly from available products in the live database
  const categories = useMemo(() => {
    const raw = Array.from(
      new Set(
        products
          .map((p) => (p.category || "").trim())
          .filter(Boolean)
      )
    );
    return ["All Crafts", ...(raw.length > 0 ? raw : FALLBACK_CATEGORIES.slice(1))];
  }, [products]);

  useEffect(() => {
    if (params.category) {
      const match = categories.find(
        (c) => c.toLowerCase() === (params.category || "").toLowerCase()
      );
      setSelectedCategory(match || params.category);
    }
    if (params.search) {
      setSearchQuery(params.search);
    }
  }, [params.category, params.search, categories]);

  const loadUserProfileAndAddress = async () => {
    try {
      const sess = await getSession();
      if (sess?.user) {
        const name = sess.user.full_name || sess.user.name || sess.user.username;
        if (name) setUserName(name.split(" ")[0]);
      }
      const activeAddr = await getActiveDeliveryAddress();
      if (activeAddr) {
        if (activeAddr.name) setUserName(activeAddr.name.split(" ")[0]);
        setUserAddress(`${activeAddr.addressLine}${activeAddr.pincode ? `, ${activeAddr.pincode}` : ""}`);
      } else {
        const addr = await AsyncStorage.getItem("artisan_saved_delivery_address");
        if (addr) {
          setUserAddress(addr);
        }
      }
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      loadUserProfileAndAddress();
      updateCart();
    }, [])
  );

  useEffect(() => {
    loadProducts();
    updateCart();
    loadUserProfileAndAddress();
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
    setAddedToast(t("addedToBag"));
    setTimeout(() => setAddedToast(""), 2200);
  };

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => {
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

    if (sortBy === "PRICE_LOW") {
      list = [...list].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === "PRICE_HIGH") {
      list = [...list].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === "UNDER_2000") {
      list = list.filter((p) => (Number(p.price) || 0) <= 2000);
    }
    return list;
  }, [products, searchQuery, selectedCategory, sortBy]);

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
              {getCategory(item.category || "Handloom")}
            </Text>
          </View>
        </View>

        {/* Product Details */}
        <View style={styles.cardInfo}>
          <Text style={styles.artisanName} numberOfLines={1}>
            {item.artisan_name || "AUTHENTIC INDIAN CRAFT"}
          </Text>

          <Text style={styles.cardTitle} numberOfLines={2}>
            {getLocalizedProductTitle(item, language)}
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
                <Text style={styles.stockBadgeText}>{item.stock} {t("inStock")}</Text>
              </View>
            ) : (
              <View style={styles.outOfStockBadge}>
                <Text style={styles.outOfStockText}>{t("preOrder")}</Text>
              </View>
            )}
          </View>

          {/* Direct Delivery Info */}
          <Text style={styles.shippingText}>{t("directArtisanDelivery")}</Text>
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
          <Text style={styles.addToCartText}>{t("addToCart")}</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F6" />

      <LanguageSelectorModal
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />

      <DeliveryAddressModal
        visible={deliveryModalVisible}
        onClose={() => setDeliveryModalVisible(false)}
        onAddressSelected={(addr) => {
          if (addr.name) setUserName(addr.name.split(" ")[0]);
          setUserAddress(`${addr.addressLine}${addr.pincode ? `, ${addr.pincode}` : ""}`);
        }}
      />

      {/* Myntra-Style Compact Header */}
      <View style={styles.headerContainer}>
        {/* Row 1: Delivery Address Strip & Bag Wallet Pill */}
        <View style={styles.addressRow}>
          <Pressable
            style={styles.addressBtn}
            onPress={() => setDeliveryModalVisible(true)}
            hitSlop={6}
          >
            <Ionicons name="location-sharp" size={16} color={theme.accent} />
            <Text style={styles.addressText} numberOfLines={1}>
              Deliver to <Text style={styles.addressUserBold}>{userName}</Text> - {userAddress || "Set Delivery Location"}
            </Text>
            <Ionicons name="chevron-down" size={13} color="#57534E" style={{ marginLeft: 2 }} />
          </Pressable>

          <Pressable
            style={styles.bagWalletPill}
            onPress={() => router.push("/buyer-cart" as any)}
            hitSlop={6}
          >
            <Ionicons name="bag-handle-outline" size={14} color={theme.accent} />
            <Text style={styles.bagWalletText}>
              {cartCount > 0 ? `${cartCount} ${cartCount === 1 ? "Item" : "Items"}` : "Bag"}
            </Text>
          </Pressable>
        </View>

        {/* Row 2: Search Bar with Embedded Logo & Right Action Icons */}
        <View style={styles.searchRow}>
          <Pressable
            style={({ pressed }) => [styles.searchPillBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/search" as any)}
          >
            <View style={styles.searchLogoBox}>
              <Image
                source={require("../assets/clean-logo-mark.png")}
                style={styles.searchLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.searchPlaceholderText} numberOfLines={1}>
              Search handicrafts, sarees, toys...
            </Text>
            <Ionicons name="mic-outline" size={17} color="#A8A29E" style={{ marginLeft: 4 }} />
          </Pressable>

          {/* Right Action Icons: Notification, Wishlist, Profile */}
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerActionBtn}
              onPress={() => router.push("/notifications" as any)}
              hitSlop={6}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={22} color="#1C1917" />
              {unreadNotifs > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadNotifs > 99 ? "99+" : unreadNotifs}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.headerActionBtn}
              onPress={() => router.push("/buyer-wishlist" as any)}
              hitSlop={6}
              accessibilityLabel="Wishlist"
            >
              <Ionicons name="heart-outline" size={22} color="#1C1917" />
              {savedProductIds.size > 0 && (
                <View style={styles.wishlistDot} />
              )}
            </Pressable>

            <Pressable
              style={styles.headerActionBtn}
              onPress={() => router.push("/settings" as any)}
              hitSlop={6}
              accessibilityLabel="Account"
            >
              <Ionicons name="person-outline" size={22} color="#1C1917" />
            </Pressable>
          </View>
        </View>

        {/* Row 3: Sleek Horizontal Category Tabs */}
        <View style={styles.categoryTabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabsScroll}
          >
            {categories.map((c) => {
              const isSelected = selectedCategory.toLowerCase() === c.toLowerCase();
              const label = c === "All Crafts" ? "ALL" : getCategory(c).toUpperCase();
              return (
                <Pressable
                  key={"tab-" + c}
                  onPress={() => setSelectedCategory(c)}
                  style={[styles.categoryTabBtn, isSelected && styles.categoryTabBtnActive]}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      isSelected && styles.categoryTabTextActive
                    ]}
                  >
                    {label}
                  </Text>
                  {isSelected && <View style={styles.categoryTabIndicator} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
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
          <View style={{ paddingTop: 8 }}>
            {/* Clean E-Commerce Sort Bar */}
            <View style={styles.sortBar}>
              <View style={styles.sortIconBox}>
                <Ionicons name="swap-vertical" size={14} color={theme.accent} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                {(
                  [
                    { id: "POPULAR", label: t("popular") },
                    { id: "PRICE_LOW", label: t("lowToHigh") },
                    { id: "PRICE_HIGH", label: t("highToLow") },
                    { id: "UNDER_2000", label: t("under2000") }
                  ] as const
                ).map((s) => {
                  const isCurrent = sortBy === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSortBy(s.id)}
                      style={[styles.sortPill, isCurrent && styles.sortPillActive]}
                    >
                      <Text style={[styles.sortPillText, isCurrent && styles.sortPillTextActive]}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Trending Across India Row (Matching Web BuyView) */}
            {!searchQuery && selectedCategory === "All Crafts" && trendingProducts.length > 0 && (
              <View style={styles.trendingSection}>
                <View style={styles.trendingHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>🔥</Text>
                    <Text style={styles.trendingTitle}>{t("trendingAcrossIndia")}</Text>
                  </View>
                  <Text style={styles.trendingSub}>{t("highArtisanDemand")}</Text>
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
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={36} color={theme.accent} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? `No crafts matching "${searchQuery}"` : "No crafts found"}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? "Try checking your spelling or explore the categories below:"
                  : "Try adjusting your filters or browse all craft categories."}
              </Text>
              {categories.length > 1 && (
                <View style={styles.emptySuggestedCats}>
                  {categories.slice(1, 4).map((c) => (
                    <Pressable
                      key={"empty-cat-" + c}
                      style={styles.emptyCatBtn}
                      onPress={() => {
                        setSelectedCategory(c);
                        setSearchQuery("");
                      }}
                    >
                      <Text style={styles.emptyCatBtnText}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {(searchQuery || selectedCategory !== "All Crafts") && (
                <Pressable
                  style={styles.resetFiltersBtn}
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedCategory("All Crafts");
                  }}
                >
                  <Text style={styles.resetFiltersText}>View All Available Crafts</Text>
                </Pressable>
              )}
            </View>
          )
        }
      />

      {/* Role-Based Bottom Navigation */}
      <BottomNavigation role="buyer" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAF9F6"
  },
  headerContainer: {
    backgroundColor: "#FAF9F6",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 2 : 4,
    borderBottomWidth: 1,
    borderBottomColor: "#EAE7E1"
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 5
  },
  addressBtn: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12
  },
  addressText: {
    fontSize: 12,
    color: "#292524",
    marginLeft: 4,
    marginRight: 4,
    fontWeight: "500",
    flexShrink: 1
  },
  addressUserBold: {
    fontWeight: "800",
    color: "#1C1917"
  },
  bagWalletPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5EFEB",
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8DDD5",
    gap: 4
  },
  bagWalletText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.accent
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 7,
    gap: 8
  },
  searchPillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E2DDD6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  searchLogoBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FDFBF7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8
  },
  searchLogo: {
    width: 20,
    height: 20
  },
  searchPlaceholderText: {
    flex: 1,
    fontSize: 12.5,
    color: "#78716C",
    fontWeight: "400"
  },
  searchInnerActions: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  headerActionBtn: {
    position: "relative",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  wishlistDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#E11D48"
  },
  categoryTabsContainer: {
    borderTopWidth: 0.5,
    borderTopColor: "#EDEAE4",
    backgroundColor: "#FAF9F6"
  },
  categoryTabsScroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 16
  },
  categoryTabBtn: {
    paddingBottom: 8,
    position: "relative",
    alignItems: "center"
  },
  categoryTabBtnActive: {},
  categoryTabText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#78716C",
    letterSpacing: 0.8
  },
  categoryTabTextActive: {
    color: theme.accent,
    fontWeight: "900"
  },
  categoryTabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: theme.accent,
    borderRadius: 2
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
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8
  },
  sortIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FBF3F0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE6DF"
  },
  sortPillActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent
  },
  sortPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#57534E"
  },
  sortPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800"
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
    marginTop: 4,
    lineHeight: 18
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F7EFEA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  emptySuggestedCats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    justifyContent: "center"
  },
  emptyCatBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E3DACB"
  },
  emptyCatBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.accent
  },
  resetFiltersBtn: {
    marginTop: 16,
    backgroundColor: theme.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20
  },
  resetFiltersText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800"
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
