import React from "react";
import { View, Text, StyleSheet, Image, Pressable, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

interface ArtisanCardProps {
  artisan: {
    id?: number;
    name?: string;
    craft?: string;
    location?: string;
    avatar_url?: string;
    average_rating?: number;
    experience_years?: number;
    verification_status?: string;
    bio?: string;
  };
  onPress?: () => void;
  style?: ViewStyle;
}

export const ArtisanCard: React.FC<ArtisanCardProps> = ({
  artisan,
  onPress,
  style
}) => {
  const avatarUri =
    artisan.avatar_url ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(artisan.name || "Artisan")}`;

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.topRow}>
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatar}
          resizeMode="cover"
        />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {artisan.name || "Master Artisan"}
            </Text>
            {artisan.verification_status && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={theme.colors.success}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
          <Text style={styles.craft} numberOfLines={1}>
            {artisan.craft || "Traditional Handcrafts"} • {artisan.location || "India"}
          </Text>
          <View style={styles.metricsRow}>
            {typeof artisan.average_rating === "number" && (
              <View style={styles.metricPill}>
                <Ionicons name="star" size={12} color="#FEB956" style={{ marginRight: 3 }} />
                <Text style={styles.metricText}>{artisan.average_rating} ★</Text>
              </View>
            )}
            {typeof artisan.experience_years === "number" && (
              <View style={styles.metricPill}>
                <Ionicons name="ribbon-outline" size={12} color={theme.colors.primary} style={{ marginRight: 3 }} />
                <Text style={styles.metricText}>{artisan.experience_years} yrs craft</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      {artisan.bio && (
        <Text style={styles.bio} numberOfLines={2}>
          "{artisan.bio}"
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: theme.colors.primaryLight
  },
  info: {
    flex: 1,
    marginLeft: theme.spacing.md
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  name: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ink
  },
  craft: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkMuted,
    marginTop: 2
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.xs
  },
  metricText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.ink
  },
  bio: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkSubtle,
    fontStyle: "italic",
    marginTop: theme.spacing.sm,
    lineHeight: 16
  }
});
