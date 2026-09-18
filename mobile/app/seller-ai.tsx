import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
  SafeAreaView,
  Image,
  ActivityIndicator
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";

export default function SellerAI() {
  const [story, setStory] = useState("");
  const [category, setCategory] = useState("Handcrafted");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<any>(null);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85
    });
    if (!r.canceled && r.assets && r.assets.length > 0) {
      setImage(r.assets[0].uri);
    }
  };

  const generate = async () => {
    if (!story.trim()) {
      return Alert.alert("Add product story", "Describe the craft and materials first.");
    }
    setBusy(true);
    try {
      const result = await api.processCatalog({
        artisan_facts: { description: story, category, materials: "" },
        voice_description: story,
        language: "en",
        image_url: image || undefined,
        category,
        selling_price: price ? Number(price) : undefined,
        material_cost: 0,
        labour_cost: 0,
        packaging_cost: 0,
        other_cost: 0
      });
      setDraft(result);
    } catch (e: any) {
      Alert.alert("AI catalog failed", e?.detail || e?.message || "Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCF9F8" />

      {/* Top App Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color="#9F3C16" />
        </Pressable>
        <Text style={styles.topBarTitle}>AI Catalog Studio</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgePill}>
          <Ionicons name="sparkles" size={13} color="#9F3C16" />
          <Text style={styles.badgeText}>INTELLIGENT ONBOARDING</Text>
        </View>

        <Text style={styles.title}>Turn your craft story into a catalog draft</Text>
        <Text style={styles.subtitle}>
          Provide a photo and description of your craft. Our AI transforms it into standard ONDC listings.
        </Text>

        {/* Image Picker */}
        <Pressable style={styles.imageBox} onPress={pick}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.placeholderBox}>
              <Ionicons name="camera-outline" size={36} color="#9F3C16" />
              <Text style={styles.imagePickerText}>Select or Take Product Photo</Text>
              <Text style={styles.imagePickerSub}>PNG, JPG up to 10MB</Text>
            </View>
          )}
        </Pressable>

        {/* Form Fields */}
        <Text style={styles.fieldLabel}>CATEGORY</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Handcrafted Pottery, Kalamkari Silk"
          placeholderTextColor="#8A726A"
          value={category}
          onChangeText={setCategory}
        />

        <Text style={styles.fieldLabel}>CRAFT STORY & MATERIALS</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your raw materials, traditional weaving or sculpting techniques, time taken, and cultural origin…"
          placeholderTextColor="#8A726A"
          value={story}
          onChangeText={setStory}
          multiline
          numberOfLines={5}
        />

        <Text style={styles.fieldLabel}>TARGET SELLING PRICE (₹ OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 1850"
          placeholderTextColor="#8A726A"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />

        {/* Generate Button */}
        <Pressable
          style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
          onPress={generate}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="sparkles-sharp" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Generate AI Catalog Draft</Text>
            </>
          )}
        </Pressable>

        {/* Result Preview */}
        {draft && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
              <Text style={styles.resultKicker}>DRAFT CREATED</Text>
            </View>
            <Text style={styles.resultTitle}>
              {draft.title || draft.catalog?.title || "Catalog Draft Generated"}
            </Text>
            <Text style={styles.resultDesc}>
              {draft.description || draft.catalog?.description || "Draft details ready for review."}
            </Text>
            <View style={styles.noteBox}>
              <Ionicons name="information-circle-outline" size={16} color="#9F3C16" />
              <Text style={styles.noteText}>
                Draft saved! You can review and publish it from your Creations screen.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FCF9F8"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 10 : 12,
    paddingBottom: 12,
    backgroundColor: "#FCF9F8",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDED"
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F6F3F2",
    alignItems: "center",
    justifyContent: "center"
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#9F3C16"
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFDBCF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
    marginBottom: 10
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#822801",
    letterSpacing: 0.8
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B1C1C",
    lineHeight: 28,
    marginBottom: 6
  },
  subtitle: {
    fontSize: 13,
    color: "#8A726A",
    lineHeight: 18,
    marginBottom: 16
  },
  imageBox: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#DEC0B7",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
    overflow: "hidden"
  },
  previewImage: {
    width: "100%",
    height: "100%"
  },
  placeholderBox: {
    alignItems: "center",
    justifyContent: "center"
  },
  imagePickerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9F3C16",
    marginTop: 8
  },
  imagePickerSub: {
    fontSize: 11,
    color: "#8A726A",
    marginTop: 2
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#57423B",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 2
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(222, 192, 183, 0.6)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1B1C1C",
    marginBottom: 14
  },
  textArea: {
    height: 110,
    textAlignVertical: "top"
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#9F3C16",
    paddingVertical: 15,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
    shadowColor: "#9F3C16",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3
  },
  primaryBtnDisabled: {
    opacity: 0.7
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(222, 192, 183, 0.6)",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8
  },
  resultKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
    letterSpacing: 1
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B1C1C",
    marginBottom: 8
  },
  resultDesc: {
    fontSize: 13,
    color: "#57423B",
    lineHeight: 18,
    marginBottom: 12
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFDBCF",
    padding: 10,
    borderRadius: 10,
    gap: 8
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: "#822801",
    fontWeight: "600"
  }
});
