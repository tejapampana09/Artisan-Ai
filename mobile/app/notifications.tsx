import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../src/theme";
import {
  Screen,
  Header,
  Card,
  EmptyState,
  SecondaryButton
} from "../src/components";
import {
  NotificationItem,
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  subscribeNotifications
} from "../src/notifications";
import { getSession } from "../src/storage";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [role, setRole] = useState<"seller" | "buyer">("seller");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getSession();
      const isSeller = session.domain === "STUDIO" || session.user?.role === "ARTISAN";
      setRole(isSeller ? "seller" : "buyer");
      await fetchNotifications(session.domain || undefined);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribeNotifications((items) => {
      setNotifications(items);
    });
    return () => unsub();
  }, [load]);

  const handleNotificationPress = async (item: NotificationItem) => {
    if (!item.is_read) {
      await markAsRead(item.id);
    }

    const type = (item.type || "").toUpperCase();
    if (type.includes("ENQUIRY")) {
      if (role === "seller") {
        router.push("/seller-enquiries");
      } else {
        router.push("/buyer-enquiries");
      }
    } else if (type.includes("ORDER")) {
      if (role === "seller") {
        router.push("/seller-orders");
      } else {
        router.push("/buyer-orders");
      }
    } else if (type.includes("PRICE") || type.includes("PRODUCT")) {
      if (role === "seller") {
        router.push("/seller-products");
      } else {
        router.push("/buyer");
      }
    }
  };

  const getIconMeta = (type: string = "") => {
    const t = type.toUpperCase();
    if (t.includes("ORDER")) {
      return { icon: "cube-outline" as const, color: theme.colors.primary, bg: theme.colors.primaryLight + "25" };
    }
    if (t.includes("ENQUIRY_REPLY")) {
      return { icon: "sparkles" as const, color: theme.colors.accent, bg: theme.colors.accentLight };
    }
    if (t.includes("ENQUIRY")) {
      return { icon: "chatbubble-ellipses-outline" as const, color: theme.colors.info, bg: theme.colors.infoLight };
    }
    if (t.includes("REVIEW")) {
      return { icon: "star-outline" as const, color: theme.colors.warning, bg: theme.colors.warningLight };
    }
    if (t.includes("PAYMENT")) {
      return { icon: "card-outline" as const, color: theme.colors.success, bg: theme.colors.successLight };
    }
    return { icon: "notifications-outline" as const, color: theme.colors.inkMuted, bg: theme.colors.surfaceVariant };
  };

  const filtered = notifications.filter((n) => {
    if (filter === "UNREAD") return !n.is_read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Screen scrollable={false} safeArea={false}>
      <Header
        title="Notification Center"
        subtitle={unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "All alerts caught up"}
        showBack={true}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace(role === "seller" ? "/seller" : "/buyer");
        }}
        rightAction={
          unreadCount > 0 ? (
            <Pressable
              style={styles.markAllBtn}
              onPress={() => markAllAsRead()}
              hitSlop={8}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.tabChip, filter === "ALL" && styles.tabChipActive]}
          onPress={() => setFilter("ALL")}
        >
          <Text style={[styles.tabText, filter === "ALL" && styles.tabTextActive]}>
            All ({notifications.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabChip, filter === "UNREAD" && styles.tabChipActive]}
          onPress={() => setFilter("UNREAD")}
        >
          <Text style={[styles.tabText, filter === "UNREAD" && styles.tabTextActive]}>
            Unread ({unreadCount})
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="notifications-off-outline"
              title="No Notifications"
              description={
                filter === "UNREAD"
                  ? "You have read all your notifications!"
                  : "Order updates, buyer questions, and pricing recommendations will appear here."
              }
            />
          ) : null
        }
        renderItem={({ item }) => {
          const meta = getIconMeta(item.type);
          const isUnread = !item.is_read;

          return (
            <Card
              style={[styles.card, isUnread && styles.unreadCard]}
            >
              <Pressable
                style={styles.cardPressable}
                onPress={() => handleNotificationPress(item)}
              >
                <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>

                <View style={styles.contentCol}>
                  <View style={styles.headRow}>
                    <Text style={[styles.title, isUnread && styles.unreadTitle]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {isUnread && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.message} numberOfLines={3}>
                    {item.message}
                  </Text>

                  <Text style={styles.timeText}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                      : "Recent alert"}
                  </Text>
                </View>
              </Pressable>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: 8,
    backgroundColor: theme.colors.background
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceVariant
  },
  tabChipActive: {
    backgroundColor: theme.colors.primary
  },
  tabText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    fontWeight: "600"
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant
  },
  markAllText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: "700"
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40
  },
  card: {
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    backgroundColor: "#FFFFFF"
  },
  cardPressable: {
    flexDirection: "row",
    gap: 12
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  contentCol: {
    flex: 1
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2
  },
  title: {
    ...theme.typography.subtitle,
    color: theme.colors.ink,
    flex: 1
  },
  unreadTitle: {
    fontWeight: "800",
    color: theme.colors.ink
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: 6
  },
  message: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkLight,
    lineHeight: 18,
    marginBottom: 6
  },
  timeText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    fontSize: 10
  }
});