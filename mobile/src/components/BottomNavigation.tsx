import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { getCartCount, subscribeCart } from "../cart";
import { getWishlist, subscribeWishlist } from "../wishlist";

interface BottomNavProps {
  role: "seller" | "buyer";
}

interface NavItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  path: string;
  isHero?: boolean;
  badge?: number;
}

export const BottomNavigation: React.FC<BottomNavProps> = ({ role }) => {
  const insets = useSafeAreaInsets();
  const currentPath = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    if (role === "buyer") {
      getCartCount().then(setCartCount).catch(() => {});
      getWishlist().then((list) => setWishlistCount(list.length)).catch(() => {});

      const unsubCart = subscribeCart(() => {
        getCartCount().then(setCartCount).catch(() => {});
      });
      const unsubWish = subscribeWishlist(() => {
        getWishlist().then((list) => setWishlistCount(list.length)).catch(() => {});
      });

      return () => {
        unsubCart();
        unsubWish();
      };
    }
  }, [role]);

  const sellerItems: NavItem[] = [
    { label: "Studio", icon: "storefront-outline", activeIcon: "storefront", path: "/seller" },
    { label: "Creations", icon: "cube-outline", activeIcon: "cube", path: "/seller-products" },
    { label: "AI Studio", icon: "sparkles-outline", activeIcon: "sparkles", path: "/seller-ai", isHero: true },
    { label: "Orders", icon: "receipt-outline", activeIcon: "receipt", path: "/seller-orders" },
    { label: "Business", icon: "trending-up-outline", activeIcon: "trending-up", path: "/seller-business" }
  ];

  const buyerItems: NavItem[] = [
    { label: "Explore", icon: "compass-outline", activeIcon: "compass", path: "/buyer" },
    { label: "Saved", icon: "heart-outline", activeIcon: "heart", path: "/buyer-wishlist", badge: wishlistCount },
    { label: "Bag", icon: "bag-handle-outline", activeIcon: "bag-handle", path: "/buyer-cart", badge: cartCount },
    { label: "Orders", icon: "receipt-outline", activeIcon: "receipt", path: "/buyer-orders" },
    { label: "AI Guide", icon: "sparkles-outline", activeIcon: "sparkles", path: "/buyer-assistant" }
  ];

  const items: NavItem[] = role === "seller" ? sellerItems : buyerItems;

  const navigateTo = (path: string) => {
    if (currentPath === path) return;
    router.replace(path as any);
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.content}>
        {items.map((item) => {
          const isActive = currentPath === item.path;
          const iconColor = isActive
            ? theme.colors.primary
            : theme.colors.inkMuted;

          if (item.isHero) {
            return (
              <Pressable
                key={item.path}
                style={styles.heroTab}
                onPress={() => navigateTo(item.path)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.heroButton}>
                  <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.tabLabel, styles.heroLabel]}>{item.label}</Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={item.path}
              style={styles.tab}
              onPress={() => navigateTo(item.path)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name={isActive ? item.activeIcon : item.icon}
                  size={22}
                  color={iconColor}
                />
                {typeof item.badge === "number" && item.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.badge > 99 ? "99+" : item.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.lg
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingHorizontal: 6
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2
  },
  heroTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14
  },
  heroButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.md
  },
  heroLabel: {
    color: theme.colors.primary,
    fontWeight: "700",
    marginTop: 2
  },
  iconContainer: {
    position: "relative",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  tabLabel: {
    fontSize: 10,
    color: theme.colors.inkMuted,
    marginTop: 2,
    fontWeight: "500"
  },
  activeTabLabel: {
    color: theme.colors.primary,
    fontWeight: "700"
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -7,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800"
  }
});
