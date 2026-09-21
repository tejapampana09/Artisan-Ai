import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
  Dimensions,
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { addToCart } from "../src/cart";

const { width } = Dimensions.get("window");

// expo-speech-recognition requires custom dev build — gracefully no-op in Expo Go
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: (event: string, cb: (e: any) => void) => void = () => {};
let speechRecognitionAvailable = false;
try {
  const mod = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
  speechRecognitionAvailable = !!ExpoSpeechRecognitionModule;
} catch {
  speechRecognitionAvailable = false;
}

const POPULAR_SEARCHES = [
  "Kalamkari",
  "Kondapalli Toys",
  "Pochampally Ikat",
  "Terracotta",
  "Brass Sculptures",
  "Blue Pottery",
  "Bidriware",
  "Handloom Sarees",
  "Wood Carving"
];

export default function SearchScreen() {
  const { language, t, getCategory } = useI18n();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q || "");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<TextInput>(null);

  // Voice search state
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  // ── Voice recognition event hooks ─────────────────────────────
  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("result", (event: any) => {
    const transcript = event?.results?.[0]?.transcript ?? "";
    if (transcript) setQuery(transcript);
    setIsListening(false);
  });
  useSpeechRecognitionEvent("error", (event: any) => {
    setVoiceError(event?.message ?? "Voice search failed");
    setIsListening(false);
    setTimeout(() => setVoiceError(""), 2500);
  });

  const handleVoiceMic = async () => {
    if (!speechRecognitionAvailable || !ExpoSpeechRecognitionModule) {
      // Expo Go — just focus the text input
      inputRef.current?.focus();
      return;
    }
    if (isListening) {
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setVoiceError("Mic permission denied");
        setTimeout(() => setVoiceError(""), 2500);
        return;
      }
      setVoiceError("");
      inputRef.current?.blur();
      ExpoSpeechRecognitionModule.start({
        lang: language === "te" ? "te-IN"
            : language === "hi" ? "hi-IN"
            : language === "ta" ? "ta-IN"
            : "en-IN",
        interimResults: true,
        maxAlternatives: 1,
      });
    } catch {
      setVoiceError("Voice search unavailable");
      setTimeout(() => setVoiceError(""), 2500);
    }
  };

  useEffect(() => {
    loadAllProducts();
    setTimeout(() => { inputRef.current?.focus(); }, 150);
  }, []);

  const loadAllProducts = async () => {
    try {
      setLoading(true);
      const data = await api.products();
      if (Array.isArray(data)) setProducts(data);
    } catch (e) {
      console.warn("Failed to load products for search:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return products.filter((item) => {
      const title = (item.title || "").toLowerCase();
      const desc = (item.description || "").toLowerCase();
      const cat = (item.category || "").toLowerCase();
      const artisan = (item.artisan_name || "").toLowerCase();
      const origin = (item.region_of_origin || "").toLowerCase();
      const craftStory = (item.craft_story || "").toLowerCase();
      return title.includes(q) || desc.includes(q) || cat.includes(q)
          || artisan.includes(q) || origin.includes(q) || craftStory.includes(q);
    });
  }, [products, query]);

  const handleSelectSearch = (term: string) => setQuery(term);

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const renderProductItem = ({ item }: { item: any }) => {
    const isOutOfStock = item.stock !== undefined && Number(item.stock) <= 0;
    const hasDiscount = item.original_price && Number(item.original_price) > Number(item.price);

    return (
      <Pressable
        style={styles.productCard}
        onPress={() => {
          router.push({ pathname: "/product", params: { id: String(item.id) } } as any);
        }}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: item.image_url || "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400" }}
            style={styles.productImage}
            resizeMode="cover"
          />
          {item.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText} numberOfLines={1}>
                {getCategory(item.category)}
              </Text>
            </View>
          ) : null}
          {isOutOfStock && (
            <View style={styles.soldOutBadge}>
              <Text style={styles.soldOutText}>OUT OF STOCK</Text>
            </View>
          )}
        </View>

        <View style={styles.cardDetails}>
          <Text style={styles.artisanCredit} numberOfLines={1}>
            {item.artisan_name || "HERITAGE ARTISAN"}
          </Text>
          <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceText}>₹{Number(item.price || 0).toLocaleString("en-IN")}</Text>
            {hasDiscount && (
              <Text style={styles.mrpText}>₹{Number(item.original_price).toLocaleString("en-IN")}</Text>
            )}
          </View>

          <Pressable
            style={[styles.viewCraftBtn, isOutOfStock && { backgroundColor: "#9CA3AF" }]}
            onPress={(e) => {
              e.stopPropagation();
              router.push({ pathname: "/product", params: { id: String(item.id) } } as any);
            }}
          >
            <Text style={styles.viewCraftBtnText}>
              {isOutOfStock ? "View Details" : "View Craft"}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Search Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/buyer"); }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color="#1C1917" />
        </Pressable>

        {/* Search bar with mic embedded on the right */}
        <View style={[styles.searchBarBox, isListening && styles.searchBarBoxListening]}>
          <Ionicons
            name="search"
            size={18}
            color={isListening ? theme.accent : "#9CA3AF"}
            style={{ marginRight: 8 }}
          />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={isListening ? "Listening... speak now" : t("searchCraftsPlaceholder")}
            placeholderTextColor={isListening ? theme.accent : "#9CA3AF"}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isListening}
          />

          {/* Clear button — only when text typed and not listening */}
          {query.length > 0 && !isListening && (
            <Pressable onPress={handleClear} hitSlop={8} style={{ marginRight: 4 }}>
              <Ionicons name="close-circle" size={18} color="#78716C" />
            </Pressable>
          )}

          {/* Voice mic — always visible, fills/pulses when listening */}
          <Pressable
            onPress={handleVoiceMic}
            hitSlop={8}
            style={[styles.voiceMicInner, isListening && styles.voiceMicInnerActive]}
            accessibilityLabel="Voice search"
          >
            <Ionicons
              name={isListening ? "mic" : "mic-outline"}
              size={19}
              color={isListening ? "#FFFFFF" : "#78716C"}
            />
          </Pressable>
        </View>
      </View>

      {/* Voice error strip */}
      {voiceError ? (
        <View style={styles.voiceErrorStrip}>
          <Ionicons name="alert-circle-outline" size={14} color="#DC2626" style={{ marginRight: 6 }} />
          <Text style={styles.voiceErrorText}>{voiceError}</Text>
        </View>
      ) : null}

      {/* Query Results or Discovery */}
      {query.trim().length === 0 ? (
        <ScrollView contentContainerStyle={styles.discoveryScroll} showsVerticalScrollIndicator={false}>
          {/* Voice search prompt when mic available */}
          {speechRecognitionAvailable && (
            <Pressable style={styles.voicePromptCard} onPress={handleVoiceMic}>
              <View style={styles.voicePromptIcon}>
                <Ionicons name="mic" size={22} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.voicePromptTitle}>Search by Voice</Text>
                <Text style={styles.voicePromptSub}>Tap mic and say what you're looking for</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#A8A29E" />
            </Pressable>
          )}

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Popular Heritage Searches</Text>
            </View>
            <View style={styles.tagWrap}>
              {POPULAR_SEARCHES.map((term) => (
                <Pressable
                  key={"pop-" + term}
                  style={styles.popularChip}
                  onPress={() => handleSelectSearch(term)}
                >
                  <Ionicons name="trending-up" size={13} color={theme.accent} style={{ marginRight: 5 }} />
                  <Text style={styles.popularChipText}>{term}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.heritageNoteBox}>
            <Ionicons name="shield-checkmark" size={24} color="#15803D" style={{ marginBottom: 6 }} />
            <Text style={styles.heritageNoteTitle}>100% Authentic Indian Craft Guarantee</Text>
            <Text style={styles.heritageNoteSub}>
              Direct connection to verified master artisans across India with zero middlemen markup.
            </Text>
          </View>
        </ScrollView>
      ) : loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.centerText}>Searching authentic crafts...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="search-outline" size={38} color="#A8A29E" />
          </View>
          <Text style={styles.emptyTitle}>No Crafts Found</Text>
          <Text style={styles.emptySub}>
            We couldn't find any crafts matching "{query}". Try Kalamkari, Sarees, Brass, or Wood.
          </Text>
          <Pressable style={styles.resetSearchBtn} onPress={handleClear}>
            <Text style={styles.resetSearchBtnText}>Clear & Browse All</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.resultsInfoRow}>
            <Text style={styles.resultsCountText}>
              Found <Text style={{ color: theme.accent, fontWeight: "800" }}>{filteredProducts.length}</Text> crafts for "{query}"
            </Text>
          </View>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            renderItem={renderProductItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAF9F6" },

  // ── Header ─────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 2 : 6,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE"
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6
  },
  searchBarBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F6",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
    borderWidth: 1.5,
    borderColor: "#E5E7EB"
  },
  searchBarBoxListening: {
    borderColor: theme.accent,
    backgroundColor: "#FFF8F5"
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1C1917",
    paddingVertical: 0
  },
  voiceMicInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDEAE4",
    marginLeft: 2
  },
  voiceMicInnerActive: {
    backgroundColor: theme.accent
  },

  // ── Voice error strip ───────────────────────────────────────────────
  voiceErrorStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5"
  },
  voiceErrorText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600"
  },

  // ── Voice prompt card ───────────────────────────────────────────────
  voicePromptCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E8DDD5",
    gap: 12
  },
  voicePromptIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF0EB",
    alignItems: "center",
    justifyContent: "center"
  },
  voicePromptTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1C1917",
    marginBottom: 2
  },
  voicePromptSub: {
    fontSize: 12,
    color: "#78716C"
  },

  // ── Discovery Scroll ────────────────────────────────────────────────
  discoveryScroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40
  },
  sectionBlock: { marginBottom: 22 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#78716C",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  popularChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DEC0B7",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 3
  },
  popularChipText: { fontSize: 12, fontWeight: "700", color: "#1C1917" },

  // ── Heritage note ───────────────────────────────────────────────────
  heritageNoteBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    alignItems: "center",
    marginTop: 10
  },
  heritageNoteTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#15803D",
    marginBottom: 3,
    textAlign: "center"
  },
  heritageNoteSub: {
    fontSize: 12,
    color: "#166534",
    textAlign: "center",
    lineHeight: 17
  },

  // ── Results ─────────────────────────────────────────────────────────
  resultsInfoRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE"
  },
  resultsCountText: { fontSize: 13, color: "#57534E", fontWeight: "600" },
  columnWrapper: { paddingHorizontal: 12, justifyContent: "space-between" },
  listContent: { paddingTop: 10, paddingBottom: 40 },
  productCard: {
    width: "48.2%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAE6DF",
    marginBottom: 12,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4
  },
  imageWrapper: {
    position: "relative",
    width: "100%",
    height: 160,
    backgroundColor: "#F7F5F0"
  },
  productImage: { width: "100%", height: "100%" },
  categoryPill: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(28, 28, 28, 0.8)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  categoryPillText: { fontSize: 9, fontWeight: "700", color: "#FFFFFF" },
  soldOutBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(220, 38, 38, 0.9)",
    paddingVertical: 2,
    alignItems: "center"
  },
  soldOutText: { fontSize: 8, fontWeight: "900", color: "#FFFFFF", letterSpacing: 0.5 },
  cardDetails: { padding: 10 },
  artisanCredit: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.accent,
    letterSpacing: 0.5,
    marginBottom: 2
  },
  productTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C1917",
    lineHeight: 16,
    minHeight: 32
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 6,
    marginBottom: 8
  },
  priceText: { fontSize: 14, fontWeight: "800", color: "#1C1917" },
  mrpText: { fontSize: 10, color: "#A8A29E", textDecorationLine: "line-through" },
  viewCraftBtn: {
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center"
  },
  viewCraftBtnText: { fontSize: 11, fontWeight: "800", color: "#FFFFFF" },

  // ── Empty / center ──────────────────────────────────────────────────
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  centerText: { marginTop: 12, fontSize: 13, color: "#78716C", fontWeight: "600" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 36 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F5F5F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#1C1917", marginBottom: 4 },
  emptySub: {
    fontSize: 13,
    color: "#78716C",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18
  },
  resetSearchBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10
  },
  resetSearchBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }
});
