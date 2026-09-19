import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { SecondaryButton } from "./Buttons";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
  style
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={32} color={theme.colors.danger} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <SecondaryButton
          title="Try Again"
          onPress={onRetry}
          icon="reload"
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md
  },
  title: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ink,
    marginBottom: theme.spacing.xs
  },
  message: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.inkMuted,
    textAlign: "center",
    marginBottom: theme.spacing.md,
    lineHeight: 18
  },
  button: {
    minWidth: 140
  }
});
