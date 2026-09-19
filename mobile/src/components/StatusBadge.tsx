import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { theme } from "../theme";

interface StatusBadgeProps {
  status: string;
  type?: "order" | "product";
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = "product",
  style
}) => {
  const normalized = (status || "").toUpperCase();

  let bg = theme.colors.surfaceMuted;
  let color = theme.colors.inkMuted;
  let border = theme.colors.border;
  let label = status;

  if (type === "order") {
    switch (normalized) {
      case "CONFIRMED":
        bg = theme.colors.warningLight;
        color = theme.colors.warning;
        border = theme.colors.warningBorder;
        label = "Confirmed";
        break;
      case "PROCESSING":
        bg = theme.colors.infoLight;
        color = theme.colors.info;
        border = theme.colors.infoBorder;
        label = "Processing";
        break;
      case "SHIPPED":
        bg = "#EDE7F6";
        color = "#512DA8";
        border = "#D1C4E9";
        label = "Shipped";
        break;
      case "DELIVERED":
        bg = theme.colors.successLight;
        color = theme.colors.success;
        border = theme.colors.successBorder;
        label = "Delivered";
        break;
      case "CANCELLED":
        bg = theme.colors.dangerLight;
        color = theme.colors.danger;
        border = theme.colors.dangerBorder;
        label = "Cancelled";
        break;
      default:
        label = status;
    }
  } else {
    switch (normalized) {
      case "PUBLISHED":
        bg = theme.colors.successLight;
        color = theme.colors.success;
        border = theme.colors.successBorder;
        label = "Published";
        break;
      case "APPROVED":
        bg = theme.colors.infoLight;
        color = theme.colors.info;
        border = theme.colors.infoBorder;
        label = "Approved";
        break;
      case "PENDING_APPROVAL":
        bg = theme.colors.warningLight;
        color = theme.colors.warning;
        border = theme.colors.warningBorder;
        label = "In Review";
        break;
      case "DRAFT":
      case "AI_GENERATED":
        bg = theme.colors.primaryLight;
        color = theme.colors.primary;
        border = theme.colors.primaryMuted;
        label = "AI Draft";
        break;
      case "SUSPENDED":
        bg = theme.colors.dangerLight;
        color = theme.colors.danger;
        border = theme.colors.dangerBorder;
        label = "Suspended";
        break;
      case "VERIFIED":
      case "ACTIVE":
        bg = theme.colors.successLight;
        color = theme.colors.success;
        border = theme.colors.successBorder;
        label = normalized === "VERIFIED" ? "Verified" : "Active";
        break;
      case "CONFIGURED":
      case "PENDING":
        bg = theme.colors.infoLight;
        color = theme.colors.info;
        border = theme.colors.infoBorder;
        label = normalized === "PENDING" ? "Pending" : "Configured";
        break;
      case "SANDBOX":
        bg = theme.colors.warningLight;
        color = theme.colors.warning;
        border = theme.colors.warningBorder;
        label = "Sandbox";
        break;
      case "NOT_CONFIGURED":
      case "UNAVAILABLE":
        bg = theme.colors.surfaceMuted;
        color = theme.colors.inkMuted;
        border = theme.colors.border;
        label = normalized === "NOT_CONFIGURED" ? "Not configured" : "Unavailable";
        break;
      default:
        label = status;
    }
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }, style]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    alignSelf: "flex-start"
  },
  text: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.3
  }
});
