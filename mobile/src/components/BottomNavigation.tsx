import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { getCartCount, subscribeCart } from "../cart";
import { getWishlist, subscribeWishlist } from "../wishlist";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();
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
    { label: t("studio"), icon: "storefront-outline", activeIcon: "storefront", path: "/seller" },
    { label: t("creations"), icon: "cube-outline", activeIcon: "cube", path: "/seller-products" },
    { label: t("aiStudio"), icon: "sparkles-outline", activeIcon: "sparkles", path: "/seller-ai" },
    { label: t("orders"), icon: "receipt-outline", activeIcon: "receipt", path: "/seller-orders" },
    { label: t("business"), icon: "trending-up-outline", activeIcon: "trending-up", path: "/seller-business" }
  ];

  const buyerItems: NavItem[] = [
    { label: t("explore"), icon: "compass-outline", activeIcon: "compass", path: "/buyer" },
    { label: t("saved"), icon: "heart-outline", activeIcon: "heart", path: "/buyer-wishlist", badge: wishlistCount },
    { label: t("bag"), icon: "bag-handle-outline", activeIcon: "bag-handle", path: "/buyer-cart", badge: cartCount },
    { label: t("orders"), icon: "receipt-outline", activeIcon: "receipt", path: "/buyer-orders" },
    { label: t("aiGuide"), icon: "sparkles-outline", activeIcon: "sparkles", path: "/buyer-assistant" }
  ];

  const items: NavItem[] = role === "seller" ? sellerItems : buyerItems;

  const navigateTo = (path: string) => {
    if (currentPath === path) return;
    router.replace(path as any);
  };

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.content}>
        {items.map((item) => {
          const isActive = currentPath === item.path;
          const iconColor = isActive
            ? theme.colors.primary
            : theme.colors.inkMuted;

          return (
            <Pressable
              key={item.path}
              style={({ pressed }) => [
                styles.tab,
                isActive && styles.tabActive,
                pressed && styles.tabPressed
              ]}
              onPress={() => navigateTo(item.path)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name={isActive ? item.activeIcon : item.icon}
                  size={21}
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
              {isActive && <View style={styles.activeDot} />}
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
    left: 14,
    right: 14,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(232, 226, 217, 0.9)",
    shadowColor: "#2A1E17",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 12,
    paddingVertical: 4,
    paddingHorizontal: 4
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around"
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 18
  },
  tabActive: {
    backgroundColor: "rgba(147, 61, 30, 0.08)"
  },
  tabPressed: {
    transform: [{ scale: 0.88 }],
    opacity: 0.8
  },
  heroTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20
  },
  heroTabPressed: {
    transform: [{ scale: 0.9 }],
    opacity: 0.9
  },
  heroButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8
  },
  heroButtonActive: {
    backgroundColor: "#7B2E15",
    borderColor: "#F59E0B"
  },
  heroLabel: {
    color: theme.colors.primary,
    fontWeight: "800",
    fontSize: 10,
    marginTop: 2
  },
  heroBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF"
  },
  heroBadgeText: {
    color: "#1C1917",
    fontSize: 9,
    fontWeight: "900"
  },
  iconContainer: {
    position: "relative",
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center"
  },
  tabLabel: {
    fontSize: 10,
    color: theme.colors.inkMuted,
    marginTop: 1.5,
    fontWeight: "600"
  },
  activeTabLabel: {
    color: theme.colors.primary,
    fontWeight: "800"
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginTop: 2
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -7,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "800"
  }
});
