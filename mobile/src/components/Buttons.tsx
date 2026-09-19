import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: "sm" | "md" | "lg" | "small" | "medium" | "large";
}

export const PrimaryButton: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  size = "md"
}) => {
  const isInactive = disabled || loading;
  const isSm = size === "sm" || size === "small";
  const isLg = size === "lg" || size === "large";
  const paddingVertical = isSm ? 8 : isLg ? 16 : 12;
  const fontSize = isSm ? 13 : isLg ? 16 : 14;

  return (
    <Pressable
      style={[
        styles.baseButton,
        styles.primaryButton,
        { paddingVertical },
        isInactive && styles.disabledButton,
        style
      ]}
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons
              name={icon}
              size={fontSize + 3}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
          )}
          <Text style={[styles.primaryText, { fontSize }, textStyle]}>
            {title}
          </Text>
          {icon && iconPosition === "right" && (
            <Ionicons
              name={icon}
              size={fontSize + 3}
              color="#FFFFFF"
              style={{ marginLeft: 6 }}
            />
          )}
        </>
      )}
    </Pressable>
  );
};

export const SecondaryButton: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  size = "md"
}) => {
  const isInactive = disabled || loading;
  const isSm = size === "sm" || size === "small";
  const isLg = size === "lg" || size === "large";
  const paddingVertical = isSm ? 8 : isLg ? 16 : 12;
  const fontSize = isSm ? 13 : isLg ? 16 : 14;

  return (
    <Pressable
      style={[
        styles.baseButton,
        styles.secondaryButton,
        { paddingVertical },
        isInactive && styles.disabledButton,
        style
      ]}
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} size="small" />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons
              name={icon}
              size={fontSize + 3}
              color={theme.colors.primary}
              style={{ marginRight: 6 }}
            />
          )}
          <Text style={[styles.secondaryText, { fontSize }, textStyle]}>
            {title}
          </Text>
          {icon && iconPosition === "right" && (
            <Ionicons
              name={icon}
              size={fontSize + 3}
              color={theme.colors.primary}
              style={{ marginLeft: 6 }}
            />
          )}
        </>
      )}
    </Pressable>
  );
};

export const OutlineButton: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  size = "md"
}) => {
  const isInactive = disabled || loading;
  const isSm = size === "sm" || size === "small";
  const isLg = size === "lg" || size === "large";
  const paddingVertical = isSm ? 8 : isLg ? 16 : 12;
  const fontSize = isSm ? 13 : isLg ? 16 : 14;

  return (
    <Pressable
      style={[
        styles.baseButton,
        styles.outlineButton,
        { paddingVertical },
        isInactive && styles.disabledButton,
        style
      ]}
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.ink} size="small" />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons
              name={icon}
              size={fontSize + 3}
              color={theme.colors.ink}
              style={{ marginRight: 6 }}
            />
          )}
          <Text style={[styles.outlineText, { fontSize }, textStyle]}>
            {title}
          </Text>
          {icon && iconPosition === "right" && (
            <Ionicons
              name={icon}
              size={fontSize + 3}
              color={theme.colors.ink}
              style={{ marginLeft: 6 }}
            />
          )}
        </>
      )}
    </Pressable>
  );
};

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
  badge?: number;
  accessibilityLabel?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 20,
  color = theme.colors.ink,
  backgroundColor = theme.colors.surface,
  style,
  badge,
  accessibilityLabel
}) => {
  return (
    <Pressable
      style={[
        styles.iconButton,
        { backgroundColor, width: size * 1.8, height: size * 1.8, borderRadius: (size * 1.8) / 2 },
        style
      ]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={size} color={color} />
      {!!badge && badge > 0 && (
        <Text style={styles.iconBadge}>
          {badge > 9 ? "9+" : badge}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    ...theme.shadows.sm
  },
  primaryButton: {
    backgroundColor: theme.colors.primary
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: theme.typography.weights.bold,
    textAlign: "center"
  },
  secondaryButton: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted
  },
  secondaryText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
    textAlign: "center"
  },
  outlineButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  outlineText: {
    color: theme.colors.ink,
    fontWeight: theme.typography.weights.semibold,
    textAlign: "center"
  },
  disabledButton: {
    opacity: 0.55
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    position: "relative"
  },
  iconBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: theme.colors.primary,
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 4,
    borderRadius: 8,
    overflow: "hidden"
  }
});
