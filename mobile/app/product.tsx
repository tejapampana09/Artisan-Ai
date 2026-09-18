import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";
import { addToCart } from "../src/cart";

const { width } = Dimensions.get("window");

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isSaved, setIsSaved] = useState(false);
  const [addedToast, setAddedToast] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      api
        .product(Number(id))
        .then((data) => setProduct(data))
        .catch((err) => console.warn("Product fetch error:", err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleAddToCart = async () => {
    if (!product) return;
    await addToCart(product, quantity);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2000);
  };

  const handleBuyNow = async () => {
    if (!product) return;
    await addToCart(product, quantity);
    router.push("/buyer-cart");
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading authentic craft details…</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorTitle}>Craft not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>‹ Return to Marketplace</Text>
        </Pressable>
      </View>
    );
  }

  const imageUrl = product.enhanced_image_url || product.image_url;
  const mrp = Math.round((Number(product.price) || 0) * 1.25);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1C1C1C" />

      {addedToast && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>Added {quantity} item(s) to Bag!</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Full Image Header with Top Overlays (Exact Match to Web Modal) */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl || "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800" }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          {/* Floating Top Nav on Image */}
          <View style={styles.imageNavRow}>
            <Pressable style={styles.iconCircle} onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color="#1C1C1C" />
            </Pressable>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                style={[styles.iconCircle, isSaved && styles.iconCircleActive]}
                onPress={() => setIsSaved(!isSaved)}
                hitSlop={10}
              >
                <Ionicons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={20}
                  color={isSaved ? "#E11D48" : "#1C1C1C"}
                />
              </Pressable>

              <Pressable
                style={styles.iconCircle}
                onPress={() => router.push("/buyer-cart")}
                hitSlop={10}
              >
                <Ionicons name="bag-handle-outline" size={20} color="#1C1C1C" />
              </Pressable>
            </View>
          </View>

          {/* Category Tag on Image Bottom */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {product.category || "Authentic Indian Craft"}
            </Text>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* GI Tag Certified Banner */}
          <View style={styles.giBanner}>
            <Ionicons name="shield-checkmark" size={18} color="#B85D19" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.giTitle}>GI Tag Certified Heritage Craft</Text>
              <Text style={styles.giSub}>Verified origin & artisanal lineage protection</Text>
            </View>
          </View>

          {/* Title and Artisan Info */}
          <Text style={styles.productTitle}>{product.title || "Handcrafted Masterpiece"}</Text>

          <View style={styles.artisanRow}>
            <Ionicons name="person-circle-outline" size={18} color={theme.accent} style={{ marginRight: 6 }} />
            <Text style={styles.artisanText}>
              Crafted by <Text style={{ fontWeight: "800", color: theme.ink }}>{product.artisan_name || "Master Weaver"}</Text>
            </Text>
          </View>

          {/* Price & ONDC Info Block */}
          <View style={styles.priceCard}>
            <View style={styles.priceMainRow}>
              <View>
                <Text style={styles.priceCurrent}>₹{Number(product.price || 0).toLocaleString("en-IN")}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Text style={styles.priceMrp}>₹{mrp.toLocaleString("en-IN")}</Text>
                  <Text style={styles.discountTag}>20% OFF</Text>
                </View>
              </View>

              <View style={styles.stockBox}>
                <Text style={styles.stockBoxText}>
                  {product.stock > 0 ? "✓ " + product.stock + " In Stock" : "Pre-Order Available"}
                </Text>
              </View>
            </View>

            <View style={styles.ondcRow}>
              <Ionicons name="checkmark-done-circle" size={16} color="#2E7D32" style={{ marginRight: 6 }} />
              <Text style={styles.ondcText}>ONDC Protocol Verified • Free Direct Artisan Delivery</Text>
            </View>
          </View>

          {/* Craft Story Section (Quotes exact from web) */}
          <View style={styles.storyCard}>
            <View style={styles.storyHeader}>
              <Text style={{ fontSize: 18, marginRight: 6 }}>📜</Text>
              <Text style={styles.storyTitle}>Craft Story & Artisan Heritage</Text>
            </View>
            <Text style={styles.storyBody}>
              "{product.craft_story || product.description || "Each piece is handcrafted with timeless techniques passed down through generations. Natural organic materials are molded and painted with intricate heritage motifs."}"
            </Text>
          </View>

          {/* Craft Specifications */}
          <View style={styles.specCard}>
            <Text style={styles.specTitle}>AUTHENTICITY SPECIFICATIONS</Text>

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Craft Category</Text>
              <Text style={styles.specVal}>{product.category || "Handloom"}</Text>
            </View>
            <View style={styles.specDivider} />

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Materials Used</Text>
              <Text style={styles.specVal}>{product.materials || "Natural Organic Pigments, Teak Wood"}</Text>
            </View>
            <View style={styles.specDivider} />

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Origin Cluster</Text>
              <Text style={styles.specVal}>Machilipatnam / Srikalahasti, AP</Text>
            </View>
            <View style={styles.specDivider} />

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Fair Trade Policy</Text>
              <Text style={[styles.specVal, { color: "#2E7D32", fontWeight: "800" }]}>Guaranteed 20%+ Artisan Margin</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {/* Quantity Stepper */}
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            hitSlop={6}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.stepQty}>{quantity}</Text>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setQuantity(quantity + 1)}
            hitSlop={6}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>

        {/* Add to Cart Button */}
        <Pressable style={styles.addBagBtn} onPress={handleAddToCart}>
          <Ionicons name="bag-outline" size={16} color={theme.accent} style={{ marginRight: 6 }} />
          <Text style={styles.addBagText}>Add to Bag</Text>
        </Pressable>

        {/* Buy Now via ONDC */}
        <Pressable style={styles.buyNowBtn} onPress={handleBuyNow}>
          <Text style={styles.buyNowText}>Buy via ONDC</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAF9F6"
  },
  scroll: {
    paddingBottom: 110
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: Platform.OS === "android" ? 360 : 340,
    backgroundColor: "#1C1C1C"
  },
  heroImage: {
    width: "100%",
    height: "100%"
  },
  imageNavRow: {
    position: "absolute",
    top: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 12 : 16,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3
  },
  iconCircleActive: {
    backgroundColor: "#FFE4E6"
  },
  categoryBadge: {
    position: "absolute",
    bottom: 12,
    left: 16,
    backgroundColor: "rgba(28, 28, 28, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  body: {
    padding: 16
  },
  giBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCEEE3",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EADFCF"
  },
  giTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#B85D19"
  },
  giSub: {
    fontSize: 11,
    color: "#8C7A6B",
    marginTop: 2
  },
  productTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.ink,
    lineHeight: 28,
    marginBottom: 8
  },
  artisanRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  artisanText: {
    fontSize: 13,
    color: theme.muted
  },
  priceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1
  },
  priceMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  priceCurrent: {
    fontSize: 26,
    fontWeight: "900",
    color: theme.ink
  },
  priceMrp: {
    fontSize: 14,
    color: "#9E9E9E",
    textDecorationLine: "line-through",
    marginRight: 8
  },
  discountTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#E11D48",
    backgroundColor: "#FFE4E6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  stockBox: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C8E6C9"
  },
  stockBoxText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32"
  },
  ondcRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F2EDE4"
  },
  ondcText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#356B4A"
  },
  storyCard: {
    backgroundColor: "#FAF6F0",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EADFCF",
    marginBottom: 16
  },
  storyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8
  },
  storyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.ink
  },
  storyBody: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#5C4D43",
    lineHeight: 20
  },
  specCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  specTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: theme.muted,
    marginBottom: 12
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6
  },
  specLabel: {
    fontSize: 13,
    color: theme.muted,
    fontWeight: "600"
  },
  specVal: {
    fontSize: 13,
    color: theme.ink,
    fontWeight: "700",
    maxWidth: "60%",
    textAlign: "right"
  },
  specDivider: {
    height: 1,
    backgroundColor: "#F2ECE1",
    marginVertical: 4
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DF",
    gap: 8,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF9F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.ink
  },
  stepQty: {
    fontSize: 14,
    fontWeight: "800",
    marginHorizontal: 8,
    color: theme.ink
  },
  addBagBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.accent,
    paddingVertical: 13
  },
  addBagText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.accent
  },
  buyNowBtn: {
    flex: 1.2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 14
  },
  buyNowText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    zIndex: 999,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1C",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 8
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FAF9F6"
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: theme.muted
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 12
  },
  backButton: {
    backgroundColor: theme.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13
  }
});
