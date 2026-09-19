import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";
import {
  Screen,
  Header,
  BottomNavigation,
  Card,
  StatusBadge,
  EmptyState
} from "../src/components";

export default function BuyerEnquiriesScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.enquiries("buyer");
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to load your inquiries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  return (
    <Screen scrollable={false} safeArea={false}>
      <Header
        title="My Craft Inquiries"
        subtitle="Conversations with master artisans"
        showBack={true}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/buyer");
        }}
        rightAction={{
          icon: "refresh-outline",
          onPress: fetchEnquiries
        }}
      />

      <FlatList
        data={items}
        keyExtractor={(item, idx) => String(item.id || idx)}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={fetchEnquiries}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="No Inquiries Yet"
              description="Have questions about craft customization or bulk orders? You can message artisans directly from any product page."
              actionLabel="Browse Crafts"
              onAction={() => router.replace("/buyer")}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const hasReply = Boolean(item.artisan_reply);

          return (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.productTitle}>
                  {item.product_title || `Craft Query #${item.product_id || ""}`}
                </Text>
                <StatusBadge status={hasReply ? "RESPONDED" : "PENDING"} />
              </View>

              <Text style={styles.queryDate}>
                Sent on {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Recently"}
              </Text>

              <View style={styles.queryBox}>
                <Text style={styles.queryLabel}>Your Message:</Text>
                <Text style={styles.queryText}>
                  {item.message || item.enquiry_text || "Sent an inquiry."}
                </Text>
              </View>

              {hasReply ? (
                <View style={styles.replyBox}>
                  <View style={styles.replyHeader}>
                    <Ionicons name="sparkles" size={14} color={theme.colors.primary} />
                    <Text style={styles.replyTitle}>Artisan Response:</Text>
                  </View>
                  <Text style={styles.replyText}>{item.artisan_reply}</Text>
                </View>
              ) : (
                <View style={styles.waitingBox}>
                  <Ionicons name="time-outline" size={14} color={theme.colors.warning} />
                  <Text style={styles.waitingText}>
                    The artisan is reviewing your query. Response will appear here.
                  </Text>
                </View>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40
  },
  card: {
    marginBottom: theme.spacing.md
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4
  },
  productTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.ink,
    flex: 1,
    marginRight: 8
  },
  queryDate: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    marginBottom: 10
  },
  queryBox: {
    backgroundColor: theme.colors.surfaceVariant,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: 10
  },
  queryLabel: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    fontWeight: "700",
    marginBottom: 2
  },
  queryText: {
    ...theme.typography.bodySmall,
    color: theme.colors.ink
  },
  replyBox: {
    backgroundColor: theme.colors.primaryLight + "12",
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4
  },
  replyTitle: {
    ...theme.typography.caption,
    fontWeight: "800",
    color: theme.colors.primary
  },
  replyText: {
    ...theme.typography.body,
    color: theme.colors.ink
  },
  waitingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceVariant
  },
  waitingText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted
  }
});
