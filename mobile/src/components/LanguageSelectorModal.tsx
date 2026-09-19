import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppLanguage, useI18n } from "../i18n";
import { theme } from "../theme";

const LANGUAGES: {
  code: AppLanguage;
  name: string;
  label: string;
  flag: string;
  region: string;
}[] = [
  { code: "te", name: "తెలుగు", label: "Telugu", flag: "🇮🇳", region: "ఆంధ్రప్రదేశ్ & తెలంగాణ" },
  { code: "hi", name: "हिन्दी", label: "Hindi", flag: "🇮🇳", region: "उत्तर एवं मध्य भारत" },
  { code: "en", name: "English", label: "English", flag: "🇬🇧", region: "Global / All Regions" },
  { code: "ta", name: "தமிழ்", label: "Tamil", flag: "🇮🇳", region: "தமிழ்நாடு" },
  { code: "bn", name: "বাংলা", label: "Bengali", flag: "🇮🇳", region: "পশ্চিমবঙ্গ / West Bengal" }
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const LanguageSelectorModal: React.FC<Props> = ({ visible, onClose }) => {
  const { language, setLanguage, t } = useI18n();

  const handleSelect = async (code: AppLanguage) => {
    await setLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleBox}>
              <Text style={styles.title}>{t("appLanguage")}</Text>
              <Text style={styles.sub}>{t("selectInterfaceLanguage")}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={20} color={theme.colors.ink} />
            </Pressable>
          </View>

          {/* Options */}
          <View style={styles.list}>
            {LANGUAGES.map((item) => {
              const active = language === item.code;
              return (
                <Pressable
                  key={item.code}
                  style={[styles.langItem, active && styles.langItemActive]}
                  onPress={() => handleSelect(item.code)}
                >
                  <View style={styles.langLeft}>
                    <View style={[styles.flagCircle, active && styles.flagCircleActive]}>
                      <Text style={{ fontSize: 18 }}>{item.flag}</Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={[styles.langName, active && styles.langNameActive]}>
                        {item.name}
                      </Text>
                      <Text style={styles.langSub}>
                        {item.label} • {item.region}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(28, 28, 28, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  scrim: {
    ...StyleSheet.absoluteFillObject
  },
  dialog: {
    backgroundColor: "#FAF7F2",
    borderRadius: 24,
    width: "100%",
    maxWidth: 420,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EADFCF",
    ...theme.shadows.lg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EADFCF"
  },
  headerTitleBox: {
    flex: 1,
    paddingRight: 10
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2C1A0E"
  },
  sub: {
    fontSize: 12,
    color: "#786C5E",
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFE6DB",
    alignItems: "center",
    justifyContent: "center"
  },
  list: {
    padding: 16,
    gap: 10
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#EADFCF"
  },
  langItemActive: {
    borderColor: "#4A2E1B",
    backgroundColor: "#FFFDF9"
  },
  langLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  flagCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F4EBE1",
    alignItems: "center",
    justifyContent: "center"
  },
  flagCircleActive: {
    backgroundColor: "#F2E2CE"
  },
  langName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C1A0E"
  },
  langNameActive: {
    color: "#8B4513"
  },
  langSub: {
    fontSize: 11,
    color: "#8C7A6B",
    marginTop: 1
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#C4B29E",
    alignItems: "center",
    justifyContent: "center"
  },
  radioCircleActive: {
    borderColor: "#8B4513"
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8B4513"
  }
});
