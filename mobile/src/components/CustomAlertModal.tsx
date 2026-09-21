import React, { useEffect, useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import {
  CustomAlertData,
  AlertButton,
  hideCustomAlert,
  setCustomAlertListener
} from "../alertService";

export const CustomAlertModal: React.FC = () => {
  const [data, setData] = useState<CustomAlertData | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    setCustomAlertListener((alertData) => {
      setData(alertData);
    });

    return () => {
      setCustomAlertListener(null);
    };
  }, []);

  useEffect(() => {
    if (data) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [data]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 140,
        useNativeDriver: true
      })
    ]).start(() => {
      if (data?.options?.onDismiss) {
        data.options.onDismiss();
      }
      hideCustomAlert();
      setData(null);
    });
  };

  const handleButtonPress = (btn: AlertButton) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 120,
        useNativeDriver: true
      })
    ]).start(() => {
      hideCustomAlert();
      setData(null);
      if (btn.onPress) {
        btn.onPress();
      }
    });
  };

  if (!data) return null;

  const titleLower = (data.title || "").toLowerCase();
  const messageLower = (data.message || "").toLowerCase();
  const combined = `${titleLower} ${messageLower}`;

  // Smart Context Detection
  let iconName: keyof typeof Ionicons.glyphMap = "sparkles-outline";
  let badgeBg = "#FBF3F0";
  let iconColor = theme.colors.primary; // #9F3C16
  let accentBarColor = theme.colors.primary;

  if (
    combined.includes("out of stock") ||
    combined.includes("sold out") ||
    combined.includes("unavailable")
  ) {
    iconName = "cube-outline";
    badgeBg = "#FDF2E9";
    iconColor = "#C05621";
    accentBarColor = "#C05621";
  } else if (
    combined.includes("review") ||
    combined.includes("published") ||
    combined.includes("verified") ||
    combined.includes("success") ||
    combined.includes("saved") ||
    combined.includes("sent") ||
    combined.includes("updated")
  ) {
    iconName = "checkmark-circle";
    badgeBg = "#ECFDF5";
    iconColor = "#059669";
    accentBarColor = "#059669";
  } else if (
    combined.includes("privacy") ||
    combined.includes("security") ||
    combined.includes("encrypt")
  ) {
    iconName = "shield-checkmark-outline";
    badgeBg = "#EFF6FF";
    iconColor = "#2563EB";
    accentBarColor = "#2563EB";
  } else if (
    combined.includes("terms") ||
    combined.includes("policy") ||
    combined.includes("legal") ||
    combined.includes("rule")
  ) {
    iconName = "document-text-outline";
    badgeBg = "#FEF3C7";
    iconColor = "#D97706";
    accentBarColor = "#D97706";
  } else if (
    combined.includes("cancel") ||
    combined.includes("delete") ||
    combined.includes("remove") ||
    combined.includes("error") ||
    combined.includes("fail")
  ) {
    iconName = "alert-circle-outline";
    badgeBg = "#FEF2F2";
    iconColor = "#DC2626";
    accentBarColor = "#DC2626";
  }

  const buttons = data.buttons && data.buttons.length > 0
    ? data.buttons
    : [{ text: "OK", style: "default" as const }];

  // If 2 buttons and both have short labels, we can arrange them side-by-side
  const isSideBySide =
    buttons.length === 2 &&
    buttons.every((b) => (b.text || "").length <= 10);

  return (
    <Modal
      transparent
      visible={true}
      animationType="none"
      onRequestClose={() => {
        if (data.options?.cancelable !== false) {
          handleDismiss();
        }
      }}
    >
      <View style={styles.backdrop}>
        {/* Scrim tap dismisses if allowed */}
        <Pressable
          style={styles.scrim}
          onPress={() => {
            if (data.options?.cancelable !== false) {
              handleDismiss();
            }
          }}
        />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* Top Decorative Indicator */}
          <View style={[styles.topBar, { backgroundColor: accentBarColor }]} />

          {/* Close X Button (top right) */}
          <Pressable
            hitSlop={14}
            onPress={handleDismiss}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color="#8A726A" />
          </Pressable>

          {/* Icon Badge */}
          <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
            <Ionicons name={iconName} size={28} color={iconColor} />
          </View>

          {/* Title */}
          {!!data.title && (
            <Text style={styles.title}>{data.title}</Text>
          )}

          {/* Message */}
          {!!data.message && (
            <Text style={styles.message}>{data.message}</Text>
          )}

          {/* Action Buttons */}
          <View
            style={[
              styles.buttonContainer,
              isSideBySide ? styles.buttonRow : styles.buttonCol
            ]}
          >
            {buttons.map((btn, index) => {
              const isCancel =
                btn.style === "cancel" ||
                (btn.text && btn.text.toLowerCase() === "cancel");
              const isDestructive = btn.style === "destructive";

              return (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.buttonBase,
                    isSideBySide && { flex: 1 },
                    isCancel
                      ? styles.cancelButton
                      : isDestructive
                      ? styles.destructiveButton
                      : styles.primaryButton,
                    pressed && { opacity: 0.86, transform: [{ scale: 0.98 }] }
                  ]}
                  onPress={() => handleButtonPress(btn)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel
                        ? styles.cancelButtonText
                        : styles.primaryButtonText
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(28, 20, 16, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20
  },
  scrim: {
    ...StyleSheet.absoluteFillObject
  },
  card: {
    width: Math.min(width - 40, 390),
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8E5DF",
    position: "relative",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#1C1C1C",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 24
      },
      android: {
        elevation: 16
      }
    })
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F3EF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    marginTop: 4
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1C",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 12
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5C554F",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 6
  },
  buttonContainer: {
    width: "100%"
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12
  },
  buttonCol: {
    flexDirection: "column",
    gap: 10
  },
  buttonBase: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  primaryButton: {
    backgroundColor: theme.colors.primary, // Terracotta #9F3C16
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6
      },
      android: {
        elevation: 2
      }
    })
  },
  destructiveButton: {
    backgroundColor: "#DC2626"
  },
  cancelButton: {
    backgroundColor: "#F5F3EF",
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF"
  },
  cancelButtonText: {
    color: "#6B5B51"
  }
});
