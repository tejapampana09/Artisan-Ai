import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { subscribeNotifications, fetchNotifications } from "../notifications";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode | { icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
  roleBadge?: "ARTISAN" | "BUYER";
  showNotificationBell?: boolean;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  roleBadge,
  showNotificationBell = true,
  style
}) => {
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    if (showNotificationBell) {
      fetchNotifications().catch(() => {});
      const unsub = subscribeNotifications((_, count) => {
        setUnreadNotifs(count);
      });
      return () => unsub();
    }
  }, [showNotificationBell]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(roleBadge === "ARTISAN" ? "/seller" : "/buyer");
    }
  };

  return (
    <View style={[styles.header, style]}>
      <View style={styles.left}>
        {showBack && (
          <Pressable
            style={styles.backBtn}
            onPress={handleBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.ink} />
          </Pressable>
        )}
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {roleBadge && (
              <View
                style={[
                  styles.roleBadge,
                  roleBadge === "ARTISAN" ? styles.artisanBadge : styles.buyerBadge
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    roleBadge === "ARTISAN" ? styles.artisanBadgeText : styles.buyerBadgeText
                  ]}
                >
                  {roleBadge === "ARTISAN" ? "STUDIO" : "BUYER"}
                </Text>
              </View>
            )}
          </View>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.right}>
        {rightAction && (
          React.isValidElement(rightAction) ? (
            rightAction
          ) : (
            <Pressable
              style={styles.backBtn}
              onPress={(rightAction as any).onPress}
              hitSlop={8}
            >
              <Ionicons
                name={(rightAction as any).icon}
                size={18}
                color={theme.colors.ink}
              />
            </Pressable>
          )
        )}

        {showNotificationBell && (
          <Pressable
            style={styles.bellBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={8}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={theme.colors.ink} />
            {unreadNotifs > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadNotifs > 99 ? "99+" : unreadNotifs}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight
  },
  titleContainer: {
    flex: 1
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ink,
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkMuted,
    marginTop: 2
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.xs
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.5
  },
  artisanBadge: {
    backgroundColor: theme.colors.primaryLight
  },
  artisanBadgeText: {
    color: theme.colors.primary
  },
  buyerBadge: {
    backgroundColor: theme.colors.accentLight
  },
  buyerBadgeText: {
    color: theme.colors.accentDark
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    position: "relative"
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: theme.colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF"
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800"
  }
});
