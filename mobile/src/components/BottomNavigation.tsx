import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Keyboard,
} from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { getCartCount, subscribeCart } from "../cart";
import { getWishlist, subscribeWishlist } from "../wishlist";
import { useI18n } from "../i18n";

export interface BottomNavProps {
  role: "seller" | "buyer";
  /** Pass the scroll Y offset ref from the parent screen's ScrollView/FlatList */
  scrollY?: Animated.Value;
  /** Explicit visibility toggle */
  visible?: boolean;
}

interface NavItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  path: string;
  badge?: number;
}

const NAV_HEIGHT = 70; // approximate pill height + padding

export const BottomNavigation: React.FC<BottomNavProps> = ({ role, scrollY, visible }) => {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const currentPath = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  // Auto-hide animation
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHidden = useRef(false);

  const showNav = useCallback(() => {
    if (isHidden.current) {
      isHidden.current = false;
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    }
  }, [translateY]);

  const hideNav = useCallback(() => {
    if (!isHidden.current) {
      isHidden.current = true;
      Animated.spring(translateY, {
        toValue: NAV_HEIGHT + insets.bottom + 20,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    }
  }, [translateY, insets.bottom]);

  // Keyboard auto-hide: when keyboard is shown, always hide floating nav
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => hideNav()
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => showNav()
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [hideNav, showNav]);

  // Controlled visibility prop
  useEffect(() => {
    if (visible === false) {
      hideNav();
    } else if (visible === true) {
      showNav();
    }
  }, [visible, hideNav, showNav]);

  useEffect(() => {
    if (!scrollY) return;
    const listener = scrollY.addListener(({ value }) => {
      const delta = value - lastScrollY.current;
      lastScrollY.current = value;
      if (value < 40) {
        showNav();
        return;
      }
      if (delta > 4) hideNav();
      else if (delta < -4) showNav();
    });
    return () => scrollY.removeListener(listener);
  }, [scrollY, showNav, hideNav]);

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
      return () => { unsubCart(); unsubWish(); };
    }
  }, [role]);

  const sellerItems: NavItem[] = [
    { label: t("studio"), icon: "storefront-outline", activeIcon: "storefront", path: "/seller" },
    { label: t("creations"), icon: "cube-outline", activeIcon: "cube", path: "/seller-products" },
    { label: t("aiStudio"), icon: "sparkles-outline", activeIcon: "sparkles", path: "/seller-ai" },
    { label: t("orders"), icon: "receipt-outline", activeIcon: "receipt", path: "/seller-orders" },
    { label: t("business"), icon: "trending-up-outline", activeIcon: "trending-up", path: "/seller-business" },
  ];

  const buyerItems: NavItem[] = [
    { label: t("explore"), icon: "compass-outline", activeIcon: "compass", path: "/buyer" },
    { label: t("saved"), icon: "heart-outline", activeIcon: "heart", path: "/buyer-wishlist", badge: wishlistCount },
    { label: t("bag"), icon: "bag-handle-outline", activeIcon: "bag-handle", path: "/buyer-cart", badge: cartCount },
    { label: t("orders"), icon: "receipt-outline", activeIcon: "receipt", path: "/buyer-orders" },
    { label: t("aiGuide"), icon: "sparkles-outline", activeIcon: "sparkles", path: "/buyer-assistant" },
  ];

  const items = role === "seller" ? sellerItems : buyerItems;

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, 12) },
        { transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        {items.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <NavTab
              key={item.path}
              item={item}
              isActive={isActive}
              onPress={() => {
                if (currentPath !== item.path) router.replace(item.path as any);
              }}
            />
          );
        })}
      </View>
    </Animated.View>
  );
};

// ── Individual tab with press scale animation ──────────────────────────────
const NavTab: React.FC<{
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
}> = ({ item, isActive, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, tension: 200, friction: 8 }).start();

  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }).start();

  return (
    <Pressable
      style={styles.tabOuter}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <Animated.View
        style={[
          styles.tabInner,
          isActive && styles.tabInnerActive,
          { transform: [{ scale }] },
        ]}
      >
        {/* Icon + badge */}
        <View style={styles.iconWrap}>
          <Ionicons
            name={isActive ? item.activeIcon : item.icon}
            size={20}
            color={isActive ? theme.colors.primary : theme.colors.inkMuted}
          />
          {typeof item.badge === "number" && item.badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.badge > 99 ? "99+" : item.badge}
              </Text>
            </View>
          )}
        </View>

        {/* Label */}
        <Text
          style={[
            styles.label,
            isActive && styles.labelActive,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>

        {/* Active indicator dot */}
        {isActive && <View style={styles.dot} />}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(232,226,217,0.85)",
    paddingVertical: 5,
    paddingHorizontal: 4,
    shadowColor: "#2A1E17",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 14,
  },
  tabOuter: {
    flex: 1,
    alignItems: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 20,
    width: "100%",
  },
  tabInnerActive: {
    backgroundColor: "rgba(147,61,30,0.09)",
  },
  iconWrap: {
    position: "relative",
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 9.5,
    color: theme.colors.inkMuted,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  labelActive: {
    color: theme.colors.primary,
    fontWeight: "800",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginTop: 2,
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
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
  },
});

/**
 * Hook to automatically hide the bottom navbar on scroll down,
 * and reveal it on scroll up. Pass the returned onScroll to your ScrollView or FlatList.
 */
export function useAutoHideNav() {
  const [navVisible, setNavVisible] = useState(true);
  const lastY = useRef(0);

  const onScroll = useCallback((event: any) => {
    const currentY = event?.nativeEvent?.contentOffset?.y || 0;
    const diff = currentY - lastY.current;
    if (currentY < 30) {
      setNavVisible(true);
    } else if (diff > 8) {
      setNavVisible(false); // scrolling down -> hide
    } else if (diff < -8) {
      setNavVisible(true);  // scrolling up -> show
    }
    lastY.current = currentY;
  }, []);

  return { navVisible, onScroll, scrollEventThrottle: 16 };
}

