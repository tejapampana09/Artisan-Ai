import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { PrimaryButton, OutlineButton } from "./Buttons";

interface PriceCardProps {
  currentPrice: number;
  recommendedPrice: number;
  costFloor?: number;
  marketRange?: { min: number; max: number; median?: number };
  demandFactor?: number;
  reasoning?: string[];
  explanation?: string;
  onAccept?: () => void;
  onReject?: () => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
  style?: ViewStyle;
}

export const PriceCard: React.FC<PriceCardProps> = ({
  currentPrice,
  recommendedPrice,
  costFloor,
  marketRange,
  demandFactor,
  reasoning,
  explanation,
  onAccept,
  onReject,
  isAccepting = false,
  isRejecting = false,
  style
}) => {
  const diff = recommendedPrice - currentPrice;
  const isIncrease = diff > 0;

  return (
    <View style={[styles.card, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={13} color="#FFFFFF" />
          <Text style={styles.badgeText}>EXPLAINABLE DYNAMIC PRICING</Text>
        </View>
        <Text style={styles.subtext}>Sovereign Cost-Floor Protected</Text>
      </View>

      {/* Main Prices Comparison */}
      <View style={styles.priceRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>CURRENT LISTING</Text>
          <Text style={styles.currentPrice}>₹{currentPrice.toLocaleString("en-IN")}</Text>
        </View>

        <Ionicons name="arrow-forward" size={20} color={theme.colors.primary} />

        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>AI RECOMMENDED</Text>
          <Text style={styles.recommendedPrice}>
            ₹{recommendedPrice.toLocaleString("en-IN")}
          </Text>
          {diff !== 0 && (
            <Text
              style={[
                styles.diffText,
                { color: isIncrease ? theme.colors.success : theme.colors.warning }
              ]}
            >
              {isIncrease ? `+₹${diff.toLocaleString("en-IN")}` : `-₹${Math.abs(diff).toLocaleString("en-IN")}`}
            </Text>
          )}
        </View>
      </View>

      {/* Rationale Indicators */}
      <View style={styles.factorsGrid}>
        {costFloor !== undefined && (
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>COST FLOOR (MIN)</Text>
            <Text style={styles.factorValue}>₹{costFloor.toLocaleString("en-IN")}</Text>
            <Text style={styles.factorSub}>Guaranteed &gt;= 20% Margin</Text>
          </View>
        )}

        {demandFactor !== undefined && (
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>DEMAND SURGE</Text>
            <Text style={styles.factorValue}>
              {demandFactor > 1 ? `+${Math.round((demandFactor - 1) * 100)}%` : "Baseline"}
            </Text>
            <Text style={styles.factorSub}>ML Telemetry Score</Text>
          </View>
        )}

        {marketRange && (
          <View style={styles.factorItem}>
            <Text style={styles.factorLabel}>MARKET BENCHMARK</Text>
            <Text style={styles.factorValue}>
              ₹{marketRange.min.toLocaleString("en-IN")} - ₹{marketRange.max.toLocaleString("en-IN")}
            </Text>
            <Text style={styles.factorSub}>
              {marketRange.median ? `Median: ₹${marketRange.median.toLocaleString("en-IN")}` : "Market Observation Signal"}
            </Text>
          </View>
        )}
      </View>

      {/* Explanation Text */}
      {(explanation || (reasoning && reasoning.length > 0)) && (
        <View style={styles.explanationBox}>
          <Ionicons
            name="information-circle"
            size={16}
            color={theme.colors.primary}
            style={{ marginRight: 6, marginTop: 1 }}
          />
          <View style={{ flex: 1 }}>
            {explanation && <Text style={styles.explanationText}>{explanation}</Text>}
            {reasoning &&
              reasoning.map((r, i) => (
                <Text key={i} style={styles.reasoningBullet}>
                  • {r}
                </Text>
              ))}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      {(onAccept || onReject) && (
        <View style={styles.actionsRow}>
          {onReject && (
            <OutlineButton
              title="Keep Current"
              onPress={onReject}
              loading={isRejecting}
              disabled={isAccepting}
              style={{ flex: 1, marginRight: theme.spacing.sm }}
            />
          )}
          {onAccept && (
            <PrimaryButton
              title="Accept Price"
              onPress={onAccept}
              loading={isAccepting}
              disabled={isRejecting}
              icon="checkmark-sharp"
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.md
  },
  header: {
    marginBottom: theme.spacing.md
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.xs,
    gap: 4
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  subtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkMuted,
    marginTop: 4
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  priceBlock: {
    alignItems: "center"
  },
  priceLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: theme.colors.inkSubtle,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  currentPrice: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.inkMuted
  },
  recommendedPrice: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.black,
    color: theme.colors.primary
  },
  diffText: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1
  },
  factorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  factorItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  factorLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: theme.colors.inkSubtle
  },
  factorValue: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ink,
    marginTop: 2
  },
  factorSub: {
    fontSize: 9,
    color: theme.colors.inkMuted,
    marginTop: 2
  },
  explanationBox: {
    flexDirection: "row",
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  explanationText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primaryDark,
    lineHeight: 18
  },
  reasoningBullet: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primaryDark,
    marginTop: 2
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center"
  }
});
