import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  icon,
  count,
  style,
  textStyle
}) => {
  return (
    <Pressable
      style={[
        styles.chip,
        selected && styles.selectedChip,
        style
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? "#FFFFFF" : theme.colors.inkMuted}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={[
          styles.text,
          selected && styles.selectedText,
          textStyle
        ]}
      >
        {label}
      </Text>
      {typeof count === "number" && (
        <Text
          style={[
            styles.count,
            selected && styles.selectedCount
          ]}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm
  },
  selectedChip: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  text: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.inkMuted,
    fontWeight: theme.typography.weights.medium
  },
  selectedText: {
    color: "#FFFFFF",
    fontWeight: theme.typography.weights.bold
  },
  count: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkSubtle,
    marginLeft: 4,
    fontWeight: theme.typography.weights.semibold
  },
  selectedCount: {
    color: "rgba(255, 255, 255, 0.85)"
  }
});
