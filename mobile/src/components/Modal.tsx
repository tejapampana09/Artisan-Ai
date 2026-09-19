import React from "react";
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ViewStyle
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  style
}) => {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.dialog, style]}>
          <View style={styles.header}>
            {title ? <Text style={styles.title}>{title}</Text> : <View />}
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={20} color={theme.colors.ink} />
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(28, 28, 28, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg
  },
  scrim: {
    ...StyleSheet.absoluteFillObject
  },
  dialog: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.xl,
    width: "100%",
    maxWidth: 480,
    maxHeight: "85%",
    overflow: "hidden",
    ...theme.shadows.lg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ink
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  body: {
    padding: theme.spacing.lg
  }
});
