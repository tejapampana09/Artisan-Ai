import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image
} from "react-native";
import { router } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { theme } from "../theme";
import {
  getRecentlyViewed,
  removeRecentlyViewed,
  clearRecentlyViewed,
  subscribeRecentlyViewed,
  RecentlyViewedItem
} from "../recentlyViewed";
import { addToCart } from "../cart";
import { useI18n } from "../i18n";

interface Props {
  currentProductId?: number;
  onAddedToCart?: (title: string) => void;
}

export const RecentlyViewedCarousel: React.FC<Props> = ({
  currentProductId,
  onAddedToCart
}) => {
  const { language } = useI18n();
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  const loadItems = async () => {
    const list = await getRecentlyViewed();
    const filtered = currentProductId ? list.filter((p) => p.id !== currentProductId) : list;
    setItems(filtered);
  };

  useEffect(() => {
    loadItems();
    const unsubscribe = subscribeRecentlyViewed(loadItems);
    return () => unsubscribe();
  }, [currentProductId]);

  if (!items || items.length === 0) {
    return null;
  }

  const isTelugu = language === "te";

  const handleAddToCart = async (item: RecentlyViewedItem) => {
    await addToCart(item as any, 1);
    onAddedToCart?.(item.title);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="time-outline" size={16} color={theme.accent} />
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.title}>
                {isTelugu ? "ఇటీవల చూసిన కళాకృతులు" : "Recently Viewed"}
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{items.length}</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              {isTelugu ? "మీరు పరిశీలించిన కళాఖండాలు" : "Handcrafted items you explored"}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.clearBtn}
          onPress={() => clearRecentlyViewed()}
          hitSlop={8}
        >
          <Feather name="trash-2" size={13} color="#78716C" />
          <Text style={styles.clearText}>{isTelugu ? "క్లియర్" : "Clear"}</Text>
        </Pressable>
      </View>

      {/* Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {items.map((item) => (
          <Pressable
            key={"recent-" + item.id}
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/product",
                params: { id: String(item.id) }
              } as any)
            }
          >
            {/* Remove button */}
            <Pressable
              style={styles.removeBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                removeRecentlyViewed(item.id);
              }}
              hitSlop={6}
            >
              <Ionicons name="close" size={12} color="#FFFFFF" />
            </Pressable>

            {/* Image */}
            <View style={styles.imageBox}>
              <Image
                source={{
                  uri:
                    item.image_url ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400"
                }}
                style={styles.thumbImage}
                resizeMode="cover"
              />
              {item.category && (
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText} numberOfLines={1}>
                    {item.category}
                  </Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.itemPrice}>
                ₹{Number(item.price).toLocaleString("en-IN")}
              </Text>
            </View>

            {/* Add to Bag button */}
            <Pressable
              style={styles.addBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                handleAddToCart(item);
              }}
            >
              <Ionicons name="bag-handle-outline" size={12} color="#1C1917" />
              <Text style={styles.addBtnText}>
                {isTelugu ? "+ కార్ట్" : "+ Add"}
              </Text>
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FBF8F3",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EADFCF",
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 12
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginBottom: 12
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F5EBE1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D8C4B0"
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1917"
  },
  subtitle: {
    fontSize: 11,
    color: "#78716C",
    marginTop: 1
  },
  countBadge: {
    backgroundColor: "#F3E8DD",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2D3C4"
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.accent
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  clearText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#78716C"
  },
  scrollList: {
    paddingHorizontal: 14,
    gap: 10
  },
  card: {
    width: 130,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EADFCF",
    overflow: "hidden",
    position: "relative"
  },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center"
  },
  imageBox: {
    width: "100%",
    height: 120,
    backgroundColor: "#F5F5F4",
    position: "relative"
  },
  thumbImage: {
    width: "100%",
    height: "100%"
  },
  categoryTag: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(28, 25, 23, 0.8)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  categoryTagText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "700"
  },
  infoBox: {
    padding: 8
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1C1917"
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.accent,
    marginTop: 2
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#FBF8F3",
    borderTopWidth: 1,
    borderColor: "#EADFCF",
    paddingVertical: 6
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1C1917"
  }
});
