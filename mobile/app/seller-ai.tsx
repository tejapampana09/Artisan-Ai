import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule
} from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";
import {
  Screen,
  Header,
  Input,
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
  Chip
} from "../src/components";

const BACKDROPS = [
  { id: "marble_pedestal", label: "Marble Pedestal" },
  { id: "terracotta_studio", label: "Terracotta Earth" },
  { id: "natural_linen", label: "Natural Linen" },
  { id: "temple_wood", label: "Carved Teak" }
];

export default function SellerAICatalogStudio() {
  // Step tracker (1: Photo & Voice -> 2: AI Processing -> 3: Review & Publish)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Inputs
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [voiceDescription, setVoiceDescription] = useState("");
  const [categoryHint, setCategoryHint] = useState("");
  const [language, setLanguage] = useState("en");

  // Cost inputs
  const [materialCost, setMaterialCost] = useState("0");
  const [labourCost, setLabourCost] = useState("0");
  const [packagingCost, setPackagingCost] = useState("0");
  const [otherCost, setOtherCost] = useState("0");
  const [targetPrice, setTargetPrice] = useState("");

  // Audio recording state
  const [isRecordingPermissionGranted, setIsRecordingPermissionGranted] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  // AI Pipeline output state
  const [draftResult, setDraftResult] = useState<any>(null);
  const [selectedBackdrop, setSelectedBackdrop] = useState("marble_pedestal");
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedImageUri, setEnhancedImageUri] = useState<string | null>(null);

  // Editable generated fields
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editMaterials, setEditMaterials] = useState("");
  const [editStory, setEditStory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("5");

  // Publishing state
  const [publishing, setPublishing] = useState(false);

  // Image actions
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setImageUri(res.assets[0].uri);
    }
  };

  const snapPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return Alert.alert("Permission Required", "Camera access is needed to photograph craft items.");
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setImageUri(res.assets[0].uri);
    }
  };

  // Audio recording controls
  const handleToggleRecord = async () => {
    try {
      if (!isRecordingPermissionGranted) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          return Alert.alert(
            "Microphone Permission",
            "Microphone access is required to record voice descriptions."
          );
        }
        setIsRecordingPermissionGranted(true);
      }

      if (recorderState.isRecording) {
        await recorder.stop();
        if (recorder.uri) {
          setAudioUri(recorder.uri);
        }
      } else {
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch (err: any) {
      Alert.alert("Audio Error", err?.message || "Recording could not be started.");
    }
  };

  // Step 3: Run AI Multimodal Catalog Generation
  const handleRunAIGeneration = async () => {
    if (!voiceDescription.trim() && !imageUri) {
      return Alert.alert(
        "Craft Details Needed",
        "Please provide either a product photograph or describe your craft in words/voice."
      );
    }

    setCurrentStep(2);
    try {
      const payload: Record<string, unknown> = {
        voice_description: voiceDescription.trim() || undefined,
        language,
        category_hint: categoryHint.trim() || undefined,
        image_url: imageUri || undefined,
        material_cost: parseFloat(materialCost) || 0,
        labour_cost: parseFloat(labourCost) || 0,
        packaging_cost: parseFloat(packagingCost) || 0,
        other_cost: parseFloat(otherCost) || 0,
        selling_price: parseFloat(targetPrice) || undefined,
        artisan_facts: {
          craft: categoryHint || "Handicraft",
          description: voiceDescription
        }
      };

      const res = await api.processCatalog(payload);
      setDraftResult(res);

      // Pre-fill editable state from AI draft
      setEditTitle(res.title || res.catalog?.title || "Handcrafted Heritage Piece");
      setEditCategory(res.category || res.catalog?.category || categoryHint || "Handicrafts");
      setEditMaterials(res.materials || res.catalog?.materials || "");
      setEditStory(res.craft_story || res.catalog?.craft_story || "");
      setEditDescription(res.description || res.catalog?.description || "");
      const suggested = res.suggested_price || res.price_recommendation?.recommended_price;
      setEditPrice(suggested ? String(suggested) : targetPrice || "1500");

      setCurrentStep(3);
    } catch (err: any) {
      Alert.alert("AI Cataloging Error", err?.detail || err?.message || "AI pipeline timed out. Please retry.");
      setCurrentStep(1);
    }
  };

  // Step 6: Dedicated studio Image Enhancement
  const handleEnhanceImage = async () => {
    const targetImg = imageUri;
    if (!targetImg) {
      return Alert.alert("No Image", "Add a photo first to enhance it.");
    }
    setEnhancing(true);
    try {
      const res = await api.enhanceImage(targetImg, selectedBackdrop);
      if (res && res.enhanced_image_url) {
        setEnhancedImageUri(res.enhanced_image_url);
        Alert.alert("Studio Lighting Enhanced", res.notice || "Backdrop normalization and contrast balanced.");
      }
    } catch (err: any) {
      Alert.alert("Enhancement Notice", err?.detail || err?.message || "Enhancement preview unavailable.");
    } finally {
      setEnhancing(false);
    }
  };

  // Step 8: Approve and Publish
  const handleApproveAndPublish = async () => {
    if (!draftResult?.draft_token) {
      return Alert.alert("Error", "Missing verified server draft token.");
    }
    if (!editTitle.trim()) {
      return Alert.alert("Title Required", "Please specify a product title.");
    }
    if (!editPrice || parseFloat(editPrice) <= 0) {
      return Alert.alert("Price Required", "Please enter a valid selling price.");
    }

    setPublishing(true);
    const publishPayload: Record<string, unknown> = {
      draft_token: draftResult.draft_token,
      title: editTitle.trim(),
      category: editCategory.trim(),
      materials: editMaterials.trim() || undefined,
      description: editDescription.trim() || undefined,
      craft_story: editStory.trim() || undefined,
      price: parseFloat(editPrice),
      stock: parseInt(editStock, 10) || 5,
      material_cost: parseFloat(materialCost) || 0,
      labour_cost: parseFloat(labourCost) || 0,
      packaging_cost: parseFloat(packagingCost) || 0,
      other_cost: parseFloat(otherCost) || 0,
      image_url: imageUri || undefined,
      enhanced_image_url: enhancedImageUri || undefined,
      status: "PUBLISHED"
    };

    try {
      await api.approveCatalog(publishPayload);
      Alert.alert(
        "🎉 Catalog Published!",
        `"${editTitle}" is now published and eligible for ONDC discoverability.`,
        [
          {
            text: "View My Creations",
            onPress: () => router.replace("/seller-products")
          }
        ]
      );
    } catch (err: any) {
      Alert.alert("Publish Failed", err?.detail || err?.message || "Failed to publish catalogue.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Screen scrollable withBottomNavPadding={false}>
      <Header
        title="AI Catalog Studio"
        subtitle="Voice-First Multimodal Cataloging"
        showBack
        roleBadge="ARTISAN"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step Indicator Header */}
        <View style={styles.stepIndicatorRow}>
          <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, currentStep >= 1 && styles.stepDotTextActive]}>1</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, currentStep >= 2 && styles.stepDotTextActive]}>2</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 3 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep >= 3 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, currentStep >= 3 && styles.stepDotTextActive]}>3</Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* STEP 1: PHOTO & CRAFT DESCRIPTION (INPUT)                                 */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <View>
            <View style={styles.stepTitleBox}>
              <Text style={styles.stepTitle}>1. Capture Craft & Tell Your Story</Text>
              <Text style={styles.stepSub}>
                Upload a photograph and describe your materials, lineage, or village craft tradition.
              </Text>
            </View>

            {/* Photo Capture Frame */}
            <View style={styles.photoContainer}>
              {imageUri ? (
                <View style={styles.photoPreviewWrapper}>
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} resizeMode="cover" />
                  <Pressable style={styles.repickBtn} onPress={pickImage}>
                    <Ionicons name="camera-reverse" size={16} color="#FFFFFF" />
                    <Text style={styles.repickText}>Retake / Replace</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.photoPickerBox}>
                  <Ionicons name="camera" size={36} color={theme.colors.primary} />
                  <Text style={styles.photoPickerTitle}>Craft Product Photo</Text>
                  <Text style={styles.photoPickerSub}>High-resolution photo on clear background</Text>
                  <View style={styles.photoBtnRow}>
                    <Pressable style={styles.photoBtn} onPress={pickImage}>
                      <Ionicons name="images-outline" size={16} color={theme.colors.primary} />
                      <Text style={styles.photoBtnText}>Gallery</Text>
                    </Pressable>
                    <Pressable style={styles.photoBtn} onPress={snapPhoto}>
                      <Ionicons name="camera-outline" size={16} color={theme.colors.primary} />
                      <Text style={styles.photoBtnText}>Camera</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* Native Audio Recording Section */}
            <View style={styles.audioSection}>
              <View style={styles.audioHeader}>
                <Ionicons name="mic-circle" size={20} color={theme.colors.primary} />
                <Text style={styles.audioTitle}>Voice Storytelling (Native Microphone)</Text>
              </View>
              <Text style={styles.audioSub}>
                Speak in Hindi, Telugu, Tamil, Bengali, or English. You can also type below.
              </Text>

              <View style={styles.recordControls}>
                <Pressable
                  style={[
                    styles.recordBtn,
                    recorderState.isRecording && styles.recordingActiveBtn
                  ]}
                  onPress={handleToggleRecord}
                >
                  <Ionicons
                    name={recorderState.isRecording ? "stop" : "mic"}
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={styles.recordBtnText}>
                    {recorderState.isRecording
                      ? `Recording (${Math.round(recorderState.durationMillis / 1000)}s) - Tap to Stop`
                      : audioUri
                      ? "Re-record Voice Note"
                      : "Record Voice Note"}
                  </Text>
                </Pressable>
              </View>

              {audioUri && (
                <View style={styles.audioRecordedBanner}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                  <Text style={styles.audioRecordedText}>Voice note captured successfully.</Text>
                </View>
              )}
            </View>

            {/* Text Description Fallback */}
            <Input
              label="Craft Story & Techniques (Voice or Text) *"
              value={voiceDescription}
              onChangeText={setVoiceDescription}
              placeholder="e.g. This is a Kalamkari tree-of-life wall hanging hand-painted using natural madder root and indigo dyes in Pedana, Andhra Pradesh…"
              multiline
              numberOfLines={4}
            />

            <Input
              label="Craft Category Hint (Optional)"
              value={categoryHint}
              onChangeText={setCategoryHint}
              placeholder="e.g. Kalamkari, Dokra, Bidriware"
            />

            {/* Cost Basis Inputs for Real-Time Fair Floor */}
            <View style={styles.costBox}>
              <Text style={styles.costBoxTitle}>Cost Basis (In ₹ - INR)</Text>
              <View style={styles.costGrid}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Materials (₹)"
                    value={materialCost}
                    onChangeText={setMaterialCost}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Labour (₹)"
                    value={labourCost}
                    onChangeText={setLabourCost}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.costGrid}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Packaging (₹)"
                    value={packagingCost}
                    onChangeText={setPackagingCost}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Target Price (₹)"
                    value={targetPrice}
                    onChangeText={setTargetPrice}
                    keyboardType="numeric"
                    placeholder="Optional"
                  />
                </View>
              </View>
            </View>

            <PrimaryButton
              title="Process with Multimodal AI"
              onPress={handleRunAIGeneration}
              icon="sparkles"
              size="lg"
              style={{ marginTop: 12 }}
            />
          </View>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: AI PROCESSING ANIMATION                                           */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.processingTitle}>Orchestrating Multimodal AI Pipeline</Text>
            <Text style={styles.processingSub}>
              Extracting cultural motifs, analyzing raw materials, querying market benchmarks, and calculating fair-price floors…
            </Text>

            <View style={styles.pipelineSteps}>
              <View style={styles.pipelineStepRow}>
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                <Text style={styles.pipelineStepText}>Parallel Gemini Multimodal Vision</Text>
              </View>
              <View style={styles.pipelineStepRow}>
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                <Text style={styles.pipelineStepText}>Cultural Heritage & GI Attribution</Text>
              </View>
              <View style={styles.pipelineStepRow}>
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                <Text style={styles.pipelineStepText}>Live Market Comparables Intelligence</Text>
              </View>
              <View style={styles.pipelineStepRow}>
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                <Text style={styles.pipelineStepText}>Explainable Cost-Floor Dynamic Pricing</Text>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: REVIEW, ENHANCE & PUBLISH                                         */}
        {/* ========================================================================= */}
        {currentStep === 3 && draftResult && (
          <View>
            <View style={styles.stepTitleBox}>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                <Text style={styles.successBadgeText}>CATALOG GENERATED</Text>
              </View>
              <Text style={styles.stepTitle}>3. Review, Enhance & Publish</Text>
              <Text style={styles.stepSub}>
                Review AI-generated titles, craft heritage story, and fair pricing. You have final sovereign editing power.
              </Text>
            </View>

            {/* Image Enhancement Section */}
            <View style={styles.enhanceCard}>
              <View style={styles.enhanceHeader}>
                <Ionicons name="color-wand" size={18} color={theme.colors.primary} />
                <Text style={styles.enhanceTitle}>Studio Backdrop Enhancement</Text>
              </View>
              <Text style={styles.enhanceSub}>
                Normalize lighting, balance contrast, and place on a clean studio palette.
              </Text>

              {/* Backdrop Palette Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                {BACKDROPS.map((b) => (
                  <Chip
                    key={b.id}
                    label={b.label}
                    selected={selectedBackdrop === b.id}
                    onPress={() => setSelectedBackdrop(b.id)}
                  />
                ))}
              </ScrollView>

              <View style={styles.enhanceComparison}>
                <View style={styles.enhanceThumbCol}>
                  <Text style={styles.enhanceLabel}>ORIGINAL</Text>
                  <Image source={{ uri: imageUri || "" }} style={styles.compareThumb} resizeMode="cover" />
                </View>
                {enhancedImageUri && (
                  <View style={styles.enhanceThumbCol}>
                    <Text style={[styles.enhanceLabel, { color: theme.colors.primary }]}>ENHANCED</Text>
                    <Image source={{ uri: enhancedImageUri }} style={styles.compareThumb} resizeMode="cover" />
                  </View>
                )}
              </View>

              <SecondaryButton
                title={enhancedImageUri ? "Re-Enhance Palette" : "Enhance with Studio Lighting"}
                onPress={handleEnhanceImage}
                loading={enhancing}
                icon="sparkles"
                size="sm"
                style={{ marginTop: 8 }}
              />
            </View>

            {/* Editable Fields */}
            <Input
              label="Craft Title *"
              value={editTitle}
              onChangeText={setEditTitle}
            />

            <Input
              label="Craft Category *"
              value={editCategory}
              onChangeText={setEditCategory}
            />

            <Input
              label="Raw Materials"
              value={editMaterials}
              onChangeText={setEditMaterials}
            />

            <Input
              label="Cultural Heritage & Craft Story"
              value={editStory}
              onChangeText={setEditStory}
              multiline
              numberOfLines={4}
            />

            <Input
              label="Buyer Catalog Description"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={3}
            />

            {/* Price & Stock */}
            <View style={styles.costGrid}>
              <View style={{ flex: 1.2 }}>
                <Input
                  label="Selling Price (₹) *"
                  value={editPrice}
                  onChangeText={setEditPrice}
                  keyboardType="numeric"
                  helperText={
                    draftResult.min_fair_price
                      ? `Cost floor: ₹${draftResult.min_fair_price}`
                      : undefined
                  }
                />
              </View>
              <View style={{ flex: 0.8 }}>
                <Input
                  label="Stock Units *"
                  value={editStock}
                  onChangeText={setEditStock}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Market Research Indicators */}
            {draftResult.market_summary && (
              <View style={styles.marketSummaryBox}>
                <Ionicons name="analytics-outline" size={16} color={theme.colors.info} />
                <Text style={styles.marketSummaryText}>
                  Market Range: ₹{draftResult.market_summary.min_price || 1200} - ₹{draftResult.market_summary.max_price || 3500} (Median: ₹{draftResult.market_summary.median_price || 2200})
                </Text>
              </View>
            )}

            {/* Publish & Cancel Buttons */}
            <View style={styles.publishActionRow}>
              <OutlineButton
                title="Start Over"
                onPress={() => {
                  setCurrentStep(1);
                  setDraftResult(null);
                }}
                disabled={publishing}
                style={{ flex: 1, marginRight: 10 }}
              />
              <PrimaryButton
                title="Approve & Publish"
                onPress={handleApproveAndPublish}
                loading={publishing}
                icon="checkmark-done"
                size="lg"
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 40
  },
  stepIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: theme.spacing.md
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  stepDotActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.inkMuted
  },
  stepDotTextActive: {
    color: "#FFFFFF"
  },
  stepLine: {
    width: 48,
    height: 2,
    backgroundColor: theme.colors.border
  },
  stepLineActive: {
    backgroundColor: theme.colors.primary
  },
  stepTitleBox: {
    marginBottom: theme.spacing.md
  },
  stepTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.ink,
    marginBottom: 4
  },
  stepSub: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkMuted,
    lineHeight: 18
  },
  photoContainer: {
    marginBottom: theme.spacing.md
  },
  photoPreviewWrapper: {
    height: 220,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    position: "relative"
  },
  photoPreview: {
    width: "100%",
    height: "100%"
  },
  repickBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(28, 28, 28, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    gap: 6
  },
  repickText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700"
  },
  photoPickerBox: {
    height: 160,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    borderStyle: "dashed",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md
  },
  photoPickerTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: "700",
    color: theme.colors.ink,
    marginTop: 6
  },
  photoPickerSub: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkMuted,
    marginTop: 2,
    marginBottom: 10
  },
  photoBtnRow: {
    flexDirection: "row",
    gap: 12
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    gap: 4
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary
  },
  audioSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm
  },
  audioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2
  },
  audioTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: "800",
    color: theme.colors.primary
  },
  audioSub: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    marginBottom: 10
  },
  recordControls: {
    marginVertical: 4
  },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    gap: 8
  },
  recordingActiveBtn: {
    backgroundColor: theme.colors.danger
  },
  recordBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  audioRecordedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.xs,
    marginTop: 8,
    gap: 6
  },
  audioRecordedText: {
    fontSize: 11,
    color: theme.colors.success,
    fontWeight: "600"
  },
  costBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm
  },
  costBoxTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: "800",
    color: theme.colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10
  },
  costGrid: {
    flexDirection: "row",
    gap: 10
  },
  processingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  processingTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: "800",
    color: theme.colors.ink,
    marginTop: 16,
    textAlign: "center"
  },
  processingSub: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkMuted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 300
  },
  pipelineSteps: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: 24,
    width: "100%",
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm
  },
  pipelineStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  pipelineStepText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.ink,
    fontWeight: "600"
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.xs,
    gap: 4,
    marginBottom: 6
  },
  successBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  enhanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm
  },
  enhanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  enhanceTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: "800",
    color: theme.colors.primary
  },
  enhanceSub: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    marginTop: 2
  },
  enhanceComparison: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 10
  },
  enhanceThumbCol: {
    flex: 1,
    alignItems: "center"
  },
  enhanceLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.colors.inkSubtle,
    letterSpacing: 0.5,
    marginBottom: 4
  },
  compareThumb: {
    width: "100%",
    height: 120,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted
  },
  marketSummaryBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.infoLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    gap: 8
  },
  marketSummaryText: {
    fontSize: 11,
    color: theme.colors.info,
    fontWeight: "600",
    flex: 1
  },
  publishActionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8
  }
});
