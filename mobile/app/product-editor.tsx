import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ScrollView,
  Platform
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";
import {
  Screen,
  Header,
  Input,
  PrimaryButton,
  OutlineButton,
  LoadingSkeleton
} from "../src/components";

export default function ProductEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [craftStory, setCraftStory] = useState("");
  const [materials, setMaterials] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("5");

  // Cost inputs
  const [materialCost, setMaterialCost] = useState("0");
  const [labourCost, setLabourCost] = useState("0");
  const [packagingCost, setPackagingCost] = useState("0");
  const [otherCost, setOtherCost] = useState("0");
  const [minMarginPct, setMinMarginPct] = useState("0.20");

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      api
        .product(Number(id))
        .then((p) => {
          setTitle(p.title || "");
          setCategory(p.category || "");
          setDescription(p.description || "");
          setCraftStory(p.craft_story || "");
          setMaterials(p.materials || "");
          setPrice(String(p.price || ""));
          setStock(String(p.stock || "1"));
          setMaterialCost(String(p.material_cost || "0"));
          setLabourCost(String(p.labour_cost || "0"));
          setPackagingCost(String(p.packaging_cost || "0"));
          setOtherCost(String(p.other_cost || "0"));
          setMinMarginPct(String(p.min_margin_pct || "0.20"));
          setImageUri(p.enhanced_image_url || p.image_url || null);
        })
        .catch((err) => {
          Alert.alert("Error", err?.detail || err?.message || "Could not load product details.");
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Real-time cost floor calculation
  const numMat = parseFloat(materialCost) || 0;
  const numLab = parseFloat(labourCost) || 0;
  const numPack = parseFloat(packagingCost) || 0;
  const numOth = parseFloat(otherCost) || 0;
  const numMargin = parseFloat(minMarginPct) || 0.20;
  const totalBaseCost = numMat + numLab + numPack + numOth;
  const sovereignFloor = totalBaseCost > 0 ? Math.ceil(totalBaseCost * (1 + numMargin)) : 0;
  const currentPriceNum = parseFloat(price) || 0;
  const isBelowFloor = sovereignFloor > 0 && currentPriceNum > 0 && currentPriceNum < sovereignFloor;

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setImageUri(res.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera Permission", "Camera permission is required to capture photos.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setImageUri(res.assets[0].uri);
    }
  };

  const handleSave = async (targetStatus: "DRAFT" | "PENDING_APPROVAL" = "DRAFT") => {
    if (!title.trim()) {
      return Alert.alert("Missing Information", "Please provide a title for this craft.");
    }
    if (!category.trim()) {
      return Alert.alert("Missing Information", "Please provide a craft category.");
    }
    if (!price || parseFloat(price) <= 0) {
      return Alert.alert("Missing Information", "Please enter a valid selling price in ₹.");
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      title: title.trim(),
      category: category.trim(),
      description: description.trim() || undefined,
      craft_story: craftStory.trim() || undefined,
      materials: materials.trim() || undefined,
      price: parseFloat(price),
      stock: parseInt(stock, 10) || 1,
      material_cost: numMat,
      labour_cost: numLab,
      packaging_cost: numPack,
      other_cost: numOth,
      min_margin_pct: numMargin,
      image_url: imageUri || undefined,
      status: targetStatus
    };

    try {
      if (isEditing) {
        await api.updateProduct(Number(id), payload);
        Alert.alert("Success", "Craft item updated successfully.");
      } else {
        await api.createProduct(payload);
        Alert.alert("Success", "Craft item added to creations.");
      }
      router.back();
    } catch (err: any) {
      Alert.alert("Save Failed", err?.detail || err?.message || "Could not save craft item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scrollable withBottomNavPadding={false}>
      <Header
        title={isEditing ? "Edit Craft Item" : "Add New Craft"}
        subtitle={isEditing ? `Product #${id}` : "Manual catalog creation"}
        showBack
        roleBadge="ARTISAN"
      />

      {loading ? (
        <View style={{ padding: 20 }}>
          <LoadingSkeleton />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Image Picker Box */}
          <View style={styles.imageSection}>
            {imageUri ? (
              <View style={styles.previewWrapper}>
                <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="cover" />
                <Pressable style={styles.changeImgBtn} onPress={pickImage}>
                  <Ionicons name="camera-reverse" size={18} color="#FFFFFF" />
                  <Text style={styles.changeImgText}>Change Photo</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.pickerBox}>
                <Ionicons name="image-outline" size={40} color={theme.colors.primary} />
                <Text style={styles.pickerTitle}>Add Product Photo</Text>
                <Text style={styles.pickerSub}>Select from gallery or snap with camera</Text>
                <View style={styles.pickerActionRow}>
                  <Pressable style={styles.pickerBtn} onPress={pickImage}>
                    <Ionicons name="images-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.pickerBtnText}>Gallery</Text>
                  </Pressable>
                  <Pressable style={styles.pickerBtn} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.pickerBtnText}>Camera</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Basic Fields */}
          <Input
            label="Craft Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Hand-Painted Kalamkari Cotton Dupatta"
          />

          <Input
            label="Category *"
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Kalamkari, Blue Pottery, Brassware"
          />

          <Input
            label="Raw Materials"
            value={materials}
            onChangeText={setMaterials}
            placeholder="e.g. Pure Mulberry Silk, Natural Plant Dyes"
          />

          <Input
            label="Craft Story & Cultural Heritage"
            value={craftStory}
            onChangeText={setCraftStory}
            placeholder="Describe the generational lineage, village origin, and crafting method…"
            multiline
            numberOfLines={4}
          />

          <Input
            label="Product Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Detailed overview for connoisseurs and collectors…"
            multiline
            numberOfLines={3}
          />

          {/* Sovereign Cost Floor & Margin Calculator */}
          <View style={styles.costCard}>
            <View style={styles.costHeader}>
              <Ionicons name="shield-checkmark" size={18} color={theme.colors.primary} />
              <Text style={styles.costHeaderTitle}>Sovereign Cost-Floor Protection</Text>
            </View>
            <Text style={styles.costHeaderSub}>
              Ensure you earn at least a 20% guaranteed surplus over raw expenses.
            </Text>

            <View style={styles.costGrid}>
              <View style={styles.costCol}>
                <Input
                  label="Materials (₹)"
                  value={materialCost}
                  onChangeText={setMaterialCost}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.costCol}>
                <Input
                  label="Labour (₹)"
                  value={labourCost}
                  onChangeText={setLabourCost}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.costGrid}>
              <View style={styles.costCol}>
                <Input
                  label="Packaging (₹)"
                  value={packagingCost}
                  onChangeText={setPackagingCost}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.costCol}>
                <Input
                  label="Other Cost (₹)"
                  value={otherCost}
                  onChangeText={setOtherCost}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.costFloorResult}>
              <View>
                <Text style={styles.costFloorLabel}>Sovereign Fair Price Floor</Text>
                <Text style={styles.costFloorValue}>
                  ₹{sovereignFloor.toLocaleString("en-IN")}
                </Text>
              </View>
              <Text style={styles.costFloorExplain}>
                Base Cost: ₹{totalBaseCost} + {Math.round(numMargin * 100)}% Margin
              </Text>
            </View>

            {isBelowFloor && (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={16} color={theme.colors.warning} />
                <Text style={styles.warningText}>
                  Your target price (₹{currentPriceNum}) is below your cost floor (₹{sovereignFloor}). You risk losing money.
                </Text>
              </View>
            )}
          </View>

          {/* Pricing & Stock */}
          <View style={styles.costGrid}>
            <View style={styles.costCol}>
              <Input
                label="Selling Price (₹) *"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="e.g. 2400"
              />
            </View>
            <View style={styles.costCol}>
              <Input
                label="Available Stock *"
                value={stock}
                onChangeText={setStock}
                keyboardType="numeric"
                placeholder="e.g. 5"
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <OutlineButton
              title="Save as Draft"
              onPress={() => handleSave("DRAFT")}
              loading={saving}
              style={{ flex: 1, marginRight: 10 }}
            />
            <PrimaryButton
              title="Submit for Review"
              onPress={() => handleSave("PENDING_APPROVAL")}
              loading={saving}
              style={{ flex: 1.2 }}
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 40
  },
  imageSection: {
    marginBottom: theme.spacing.lg
  },
  pickerBox: {
    height: 160,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    borderStyle: "dashed",
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md
  },
  pickerTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: "700",
    color: theme.colors.ink,
    marginTop: 6
  },
  pickerSub: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.inkMuted,
    marginTop: 2,
    marginBottom: 10
  },
  pickerActionRow: {
    flexDirection: "row",
    gap: 12
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    gap: 4
  },
  pickerBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary
  },
  previewWrapper: {
    height: 200,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    position: "relative"
  },
  previewImg: {
    width: "100%",
    height: "100%"
  },
  changeImgBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(28, 28, 28, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    gap: 6
  },
  changeImgText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700"
  },
  costCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm
  },
  costHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2
  },
  costHeaderTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: "800",
    color: theme.colors.primary
  },
  costHeaderSub: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    marginBottom: 10
  },
  costGrid: {
    flexDirection: "row",
    gap: 10
  },
  costCol: {
    flex: 1
  },
  costFloorResult: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: 4
  },
  costFloorLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.inkMuted,
    textTransform: "uppercase"
  },
  costFloorValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: "900",
    color: theme.colors.primary
  },
  costFloorExplain: {
    fontSize: 11,
    color: theme.colors.inkMuted
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.warningLight,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.xs,
    marginTop: 8,
    gap: 6
  },
  warningText: {
    fontSize: 11,
    color: theme.colors.warning,
    fontWeight: "600",
    flex: 1
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: theme.spacing.md
  }
});
