import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ViewStyle
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { theme } from "../theme";
import { addToCart } from "../cart";
import { isWishlisted, toggleWishlist, subscribeWishlist } from "../wishlist";

interface ProductCardProps {
  product: any;
  onQuickAddToast?: (msg: string) => void;
  style?: ViewStyle;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onQuickAddToast,
  style
}) => {
  const [wish, setWish] = useState(false);

  useEffect(() => {
    isWishlisted(product.id).then(setWish).catch(() => {});
    const unsub = subscribeWishlist(() => {
      isWishlisted(product.id).then(setWish).catch(() => {});
    });
    return () => unsub();
  }, [product.id]);

  const handleToggleWish = async () => {
    const isNow = await toggleWishlist(product);
    setWish(isNow);
  };

  const handleQuickAdd = async () => {
    await addToCart(product, 1);
    onQuickAddToast?.(`Added "${product.title || "Craft"}" to Bag`);
  };

  const imageUrl =
    product.enhanced_image_url ||
    product.image_url ||
    "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500";

  const price = Number(product.price) || 0;
  const stock = Number(product.stock) || 0;

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={() =>
        router.push({
          pathname: "/product",
          params: { id: String(product.id) }
        } as any)
      }
      accessibilityRole="button"
      accessibilityLabel={product.title}
    >
      {/* 4:5 Portrait Image Frame */}
      <View style={styles.imageBox}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Wishlist Heart */}
        <Pressable
          style={[styles.heartBtn, wish && styles.heartBtnActive]}
          onPress={(e) => {
            e.stopPropagation();
            handleToggleWish();
          }}
          hitSlop={8}
          accessibilityLabel="Save to Wishlist"
        >
          <Ionicons
            name={wish ? "heart" : "heart-outline"}
            size={16}
            color={wish ? theme.colors.danger : theme.colors.inkMuted}
          />
        </Pressable>

        {/* Craft Category Pill on Image */}
        {product.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText} numberOfLines={1}>
              {product.category}
            </Text>
          </View>
        )}
      </View>

      {/* Info Content */}
      <View style={styles.info}>
        <Text style={styles.artisanName} numberOfLines={1}>
          {product.artisan_name || "HERITAGE ARTISAN"}
        </Text>

        <Text style={styles.title} numberOfLines={2}>
          {product.title || "Handmade Indian Craft"}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{price.toLocaleString("en-IN")}</Text>

          {stock > 0 ? (
            <View style={styles.stockBadge}>
              <Text style={styles.stockText}>{stock} in stock</Text>
            </View>
          ) : (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Pre-Order</Text>
            </View>
          )}
        </View>

        <Text style={styles.shippingBadge}>
          🚚 Direct Artisan Dispatch • ONDC
        </Text>
      </View>

      {/* Quick Add Button */}
      <Pressable
        style={styles.addBtn}
        onPress={(e) => {
          e.stopPropagation();
          handleQuickAdd();
        }}
        accessibilityRole="button"
        accessibilityLabel="Add to Bag"
      >
        <Ionicons name="bag-handle-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
        <Text style={styles.addBtnText}>Add to Bag</Text>
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
    marginBottom: theme.spacing.md
  },
  imageBox: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: theme.colors.surfaceMuted,
    position: "relative"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  heartBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.sm
  },
  heartBtnActive: {
    backgroundColor: theme.colors.dangerLight
  },
  categoryBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(28, 28, 28, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.xs
  },
  categoryBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700"
  },
  info: {
    padding: theme.spacing.md
  },
  artisanName: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.primary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3
  },
  title: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ink,
    lineHeight: 20,
    minHeight: 40
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm
  },
  price: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.black,
    color: theme.colors.ink
  },
  stockBadge: {
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.xs
  },
  stockText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.success
  },
  outOfStockBadge: {
    backgroundColor: theme.colors.warningLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.xs
  },
  outOfStockText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.warning
  },
  shippingBadge: {
    fontSize: 10,
    color: theme.colors.inkMuted,
    marginTop: 6
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingVertical: 9,
    borderRadius: theme.radius.md
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  }
});
