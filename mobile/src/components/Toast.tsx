import React, { useEffect, useRef } from "react";
import { Text, StyleSheet, Animated, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  visible: boolean;
  onDismiss?: () => void;
  duration?: number;
  style?: ViewStyle;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = "success",
  visible,
  onDismiss,
  duration = 2400,
  style
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true
          }),
          Animated.timing(translateY, {
            toValue: 20,
            duration: 200,
            useNativeDriver: true
          })
        ]).start(() => {
          onDismiss?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const bg =
    type === "success"
      ? theme.colors.success
      : type === "error"
      ? theme.colors.danger
      : theme.colors.ink;

  const iconName: keyof typeof Ionicons.glyphMap =
    type === "success"
      ? "checkmark-circle"
      : type === "error"
      ? "alert-circle"
      : "information-circle";

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: bg, opacity, transform: [{ translateY }] },
        style
      ]}
    >
      <Ionicons name={iconName} size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    ...theme.shadows.lg,
    zIndex: 9999
  },
  text: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    flex: 1
  }
});
