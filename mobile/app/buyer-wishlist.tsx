import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Pressable,
  Alert
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../src/theme";
import {
  Screen,
  Header,
  BottomNavigation,
  Card,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  OutlineButton
} from "../src/components";
import { getWishlist, removeFromWishlist, subscribeWishlist } from "../src/wishlist";
import { addToCart } from "../src/cart";
import { useRoleGuard } from "../src/authGuard";

export default function BuyerWishlistScreen() {
  useRoleGuard("buyer");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getWishlist();
      setItems(list);
    } catch (e) {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSaved();
    const unsub = subscribeWishlist(() => loadSaved());
    return () => unsub();
  }, [loadSaved]);

  const handleRemove = async (productId: number) => {
    await removeFromWishlist(productId);
    setItems((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleMoveToBag = async (product: any) => {
    await addToCart(product, 1);
    await removeFromWishlist(product.id);
    Alert.alert("Added to Bag", `"${product.title}" has been moved to your shopping bag.`);
  };

  return (
    <Screen scrollable={false} safeArea={false}>
      <Header
        title="Saved Crafts"
        subtitle={`${items.length} handcrafted items in your collection`}
        showBack={false}
      />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="heart-outline"
              title="Your Collection is Empty"
              description="Explore the marketplace and tap the heart icon on any craft to save it for later."
              actionLabel="Explore Marketplace"
              onAction={() => router.replace("/buyer")}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const img = item.enhanced_image_url || item.image_url;
          const price = Number(item.price || 0);

          return (
            <Card style={styles.card}>
              <Pressable
                style={styles.cardContent}
                onPress={() => router.push({ pathname: "/product", params: { id: item.id } })}
              >
                <Image
                  source={{ uri: img || "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400" }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.category}>{item.category || "Authentic Craft"}</Text>
                  <Text style={styles.price}>₹{price.toLocaleString("en-IN")}</Text>
                </View>
              </Pressable>

              <View style={styles.actions}>
                <OutlineButton
                  title="Remove"
                  size="small"
                  icon="trash-outline"
                  onPress={() => handleRemove(item.id)}
                />
                <PrimaryButton
                  title="Move to Bag"
                  size="small"
                  icon="bag-handle-outline"
                  onPress={() => handleMoveToBag(item)}
                />
              </View>
            </Card>
          );
        }}
      />

      <BottomNavigation role="buyer" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100
  },
  card: {
    marginBottom: theme.spacing.md
  },
  cardContent: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceVariant
  },
  info: {
    flex: 1,
    justifyContent: "center"
  },
  title: {
    ...theme.typography.subtitle,
    color: theme.colors.ink,
    marginBottom: 2
  },
  category: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginBottom: 4
  },
  price: {
    ...theme.typography.h3,
    color: theme.colors.primary
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10
  }
});
