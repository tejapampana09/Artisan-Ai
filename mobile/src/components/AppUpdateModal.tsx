import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useI18n } from "../i18n";
import {
  AppUpdateInfo,
  CURRENT_APP_VERSION,
  openAppUpdate,
  dismissUpdateForNow
} from "../services/appUpdater";

interface AppUpdateModalProps {
  visible: boolean;
  updateInfo: AppUpdateInfo | null;
  onClose: () => void;
}

export function AppUpdateModal({
  visible,
  updateInfo,
  onClose
}: AppUpdateModalProps) {
  const { language } = useI18n();
  const [downloading, setDownloading] = React.useState(false);

  if (!visible || !updateInfo) return null;

  const handleUpdate = async () => {
    setDownloading(true);
    await dismissUpdateForNow(updateInfo.version_code, updateInfo.release_id);
    await openAppUpdate(updateInfo.release_url);
    setDownloading(false);
    onClose();
  };

  const handleDismiss = async () => {
    await dismissUpdateForNow(updateInfo.version_code, updateInfo.release_id);
    onClose();
  };

  const title =
    language === "te"
      ? "కొత్త అప్‌డేట్ అందుబాటులో ఉంది! 🚀"
      : language === "hi"
      ? "नया अपडेट उपलब्ध है! 🚀"
      : "New Update Available! 🚀";

  const notes =
    (language === "te" && updateInfo.release_notes_te) ||
    (language === "hi" && updateInfo.release_notes_hi) ||
    updateInfo.release_notes ||
    "Enhanced AI assistant, faster performance, and updated heritage craft catalog.";

  const updateBtnLabel =
    language === "te"
      ? "ఇప్పుడే అప్‌డేట్ చేయండి"
      : language === "hi"
      ? "अभी अपडेट करें"
      : "Update Now";

  const laterBtnLabel =
    language === "te" ? "తరువాత" : language === "hi" ? "बाद में" : "Later";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={28} color="#D97706" />
          </View>

          {/* Title & Version Pills */}
          <Text style={styles.title}>{title}</Text>
          <View style={styles.versionRow}>
            <View style={styles.versionBadgeOld}>
              <Text style={styles.versionBadgeOldText}>v{CURRENT_APP_VERSION}</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color="#A8A29E" style={{ marginHorizontal: 6 }} />
            <View style={styles.versionBadgeNew}>
              <Text style={styles.versionBadgeNewText}>v{updateInfo.version}</Text>
            </View>
          </View>

          {/* Release Notes */}
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>
              {language === "te" ? "కొత్త ఫీచర్లు & మార్పులు:" : language === "hi" ? "नई सुविधाएं:" : "What's New:"}
            </Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>

          {/* Actions */}
          <View style={styles.btnRow}>
            <Pressable
              style={styles.laterBtn}
              onPress={handleDismiss}
              disabled={downloading}
            >
              <Text style={styles.laterBtnText}>{laterBtnLabel}</Text>
            </Pressable>

            <Pressable
              style={[styles.updateBtn, downloading && { opacity: 0.7 }]}
              onPress={handleUpdate}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.updateBtnText}>{updateBtnLabel}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(28, 25, 23, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#292524",
    textAlign: "center",
    marginBottom: 8
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  versionBadgeOld: {
    backgroundColor: "#F5F5F4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  versionBadgeOldText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#78716C"
  },
  versionBadgeNew: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  versionBadgeNewText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D"
  },
  notesBox: {
    width: "100%",
    backgroundColor: "#FAF8F5",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    marginBottom: 20
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#57534E",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#44403C"
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%"
  },
  laterBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E7E5E4",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF"
  },
  laterBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#78716C"
  },
  updateBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.accent || "#933D1E",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center"
  },
  updateBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
