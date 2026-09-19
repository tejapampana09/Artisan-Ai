import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator
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
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  OutlineButton
} from "../src/components";
import { useRoleGuard } from "../src/authGuard";

export default function SellerEnquiries() {
  useRoleGuard("seller");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.enquiries("seller");
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to load enquiries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const handleOpenReply = (enquiry: any) => {
    setSelectedEnquiry(enquiry);
    setReplyText(enquiry.artisan_reply || "");
  };

  const handleSendReply = async () => {
    if (!selectedEnquiry) return;
    if (!replyText.trim()) {
      Alert.alert("Empty Reply", "Please write a response to the buyer.");
      return;
    }

    setSubmitting(true);
    try {
      await api.replyEnquiry(selectedEnquiry.id, replyText.trim());
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedEnquiry.id
            ? { ...item, artisan_reply: replyText.trim(), status: "RESPONDED" }
            : item
        )
      );
      setSelectedEnquiry(null);
      setReplyText("");
      Alert.alert("Reply Sent", "Your response has been sent directly to the prospective buyer.");
    } catch (e: any) {
      Alert.alert("Failed to Send Reply", e?.detail || e?.message || "Unable to send response.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scrollable={false} safeArea={false}>
      <Header
        title="Buyer Inquiries"
        subtitle={`${items.length} conversations received`}
        showBack={false}
        rightAction={{
          icon: "refresh-outline",
          onPress: fetchEnquiries
        }}
      />

      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(x, i) => String(x.id ?? i)}
        refreshing={loading}
        onRefresh={fetchEnquiries}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="chatbubbles-outline"
              title="No Inquiries Yet"
              description="When prospective patrons ask questions about your handcrafted items or custom orders, they will appear here."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const hasReplied = Boolean(item.artisan_reply);

          return (
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>INQUIRY #{item.id || "NEW"}</Text>
                </View>
                <StatusBadge status={hasReplied ? "RESPONDED" : "PENDING"} />
              </View>

              <Text style={styles.name}>
                {item.product_title || item.subject || `Inquiry on Craft #${item.product_id || ""}`}
              </Text>

              <View style={styles.buyerRow}>
                <Ionicons name="person-outline" size={14} color={theme.colors.inkMuted} />
                <Text style={styles.buyerName}>
                  From: {item.buyer_name || "Verified Patron"}
                </Text>
                <Text style={styles.dateText}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                </Text>
              </View>

              <View style={styles.messageBox}>
                <Text style={styles.messageLabel}>Customer Message:</Text>
                <Text style={styles.messageText}>
                  {item.message || item.enquiry_text || "Customer has enquired about this craft."}
                </Text>
              </View>

              {hasReplied && (
                <View style={styles.replyBox}>
                  <View style={styles.replyHead}>
                    <Ionicons name="sparkles" size={14} color={theme.colors.primary} />
                    <Text style={styles.replyHeadText}>Your Artisan Reply</Text>
                  </View>
                  <Text style={styles.replyText}>{item.artisan_reply}</Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <SecondaryButton
                  title={hasReplied ? "Edit Response" : "Reply to Buyer"}
                  size="small"
                  icon="arrow-undo-outline"
                  onPress={() => handleOpenReply(item)}
                />
              </View>
            </Card>
          );
        }}
      />

      {/* Reply Composer Modal */}
      <Modal
        visible={!!selectedEnquiry}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEnquiry(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Respond to Patron</Text>
              <Pressable onPress={() => setSelectedEnquiry(null)}>
                <Ionicons name="close" size={24} color={theme.colors.ink} />
              </Pressable>
            </View>

            <Text style={styles.modalContext}>
              Replying to {selectedEnquiry?.buyer_name || "Buyer"} on{" "}
              <Text style={{ fontWeight: "700" }}>{selectedEnquiry?.product_title || "Craft"}</Text>
            </Text>

            <View style={styles.quoteBox}>
              <Text style={styles.quoteText}>
                "{selectedEnquiry?.message || selectedEnquiry?.enquiry_text || ""}"
              </Text>
            </View>

            <Text style={styles.inputLabel}>Your Artisan Response</Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={4}
              placeholder="Provide craft context, customization availability, or dispatch timelines..."
              placeholderTextColor={theme.colors.inkMuted}
              value={replyText}
              onChangeText={setReplyText}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <PrimaryButton
                title={submitting ? "Sending..." : "Send Response"}
                icon="send-outline"
                onPress={handleSendReply}
                disabled={submitting}
              />
              <OutlineButton
                title="Cancel"
                onPress={() => setSelectedEnquiry(null)}
                disabled={submitting}
              />
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavigation role="seller" />
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
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs
  },
  badgePill: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm
  },
  badgeText: {
    ...theme.typography.caption,
    fontWeight: "800",
    color: theme.colors.primary
  },
  name: {
    ...theme.typography.h3,
    color: theme.colors.ink,
    marginBottom: 6
  },
  buyerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: theme.spacing.sm
  },
  buyerName: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkMuted,
    fontWeight: "600",
    flex: 1
  },
  dateText: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted
  },
  messageBox: {
    backgroundColor: theme.colors.surfaceVariant,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm
  },
  messageLabel: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted,
    fontWeight: "700",
    marginBottom: 4
  },
  messageText: {
    ...theme.typography.body,
    color: theme.colors.ink
  },
  replyBox: {
    backgroundColor: theme.colors.primaryLight + "10",
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.sm
  },
  replyHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4
  },
  replyHeadText: {
    ...theme.typography.caption,
    fontWeight: "700",
    color: theme.colors.primary
  },
  replyText: {
    ...theme.typography.body,
    color: theme.colors.inkLight
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: theme.spacing.xs
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    paddingBottom: 36
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  modalTitle: {
    ...theme.typography.h3,
    color: theme.colors.ink
  },
  modalContext: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkMuted,
    marginBottom: 12
  },
  quoteBox: {
    backgroundColor: theme.colors.surfaceVariant,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md
  },
  quoteText: {
    ...theme.typography.bodySmall,
    fontStyle: "italic",
    color: theme.colors.inkLight
  },
  inputLabel: {
    ...theme.typography.subtitle,
    color: theme.colors.ink,
    marginBottom: 6
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...theme.typography.body,
    color: theme.colors.ink,
    backgroundColor: "#FFFFFF",
    minHeight: 100,
    marginBottom: theme.spacing.md
  },
  modalActions: {
    gap: 8
  }
});

