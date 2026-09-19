import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  trend?: string;
  trendPositive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  iconColor = theme.colors.primary,
  trend,
  trendPositive = true,
  onPress,
  style
}) => {
  const content = (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.iconBox, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>

      {trend ? (
        <View style={styles.trendRow}>
          <Ionicons
            name={trendPositive ? "trending-up" : "trending-down"}
            size={13}
            color={trendPositive ? theme.colors.success : theme.colors.danger}
          />
          <Text
            style={[
              styles.trendText,
              { color: trendPositive ? theme.colors.success : theme.colors.danger }
            ]}
          >
            {trend}
          </Text>
        </View>
      ) : subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
    minWidth: 140
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkMuted,
    fontWeight: theme.typography.weights.medium,
    flex: 1
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  value: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.black,
    color: theme.colors.ink,
    letterSpacing: -0.5,
    marginVertical: 2
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2
  },
  trendText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold
  },
  subtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkSubtle,
    marginTop: 2
  }
});
