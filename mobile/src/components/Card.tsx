import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp, Pressable } from "react-native";
import { theme } from "../theme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: "elevated" | "flat" | "outlined";
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = "elevated"
}) => {
  const cardStyle = [
    styles.card,
    variant === "elevated" && styles.elevated,
    variant === "flat" && styles.flat,
    variant === "outlined" && styles.outlined,
    style
  ];

  if (onPress) {
    return (
      <Pressable style={cardStyle} onPress={onPress}>
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.lg
  },
  elevated: {
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight
  },
  flat: {
    backgroundColor: theme.colors.surfaceMuted
  },
  outlined: {
    borderWidth: 1,
    borderColor: theme.colors.border
  }
});
