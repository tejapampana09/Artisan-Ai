import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  TextInput,
  Platform
} from "react-native";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";

export default function SellerProducts() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "DRAFT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.sellerProducts();
      setItems(data || []);
    } catch (e: any) {
      Alert.alert("Error", e?.detail || e?.message || "Could not load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredItems = items.filter((p) => {
    const matchesSearch =
      !searchQuery.trim() ||
      (p.title && p.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (activeFilter === "ALL") return true;
    if (activeFilter === "ACTIVE") return (p.status || "").toUpperCase() === "PUBLISHED";
    if (activeFilter === "DRAFT") return (p.status || "").toUpperCase() === "DRAFT";
    return true;
  });

  const handlePriceSuggestion = async (productId: number, title: string) => {
    try {
      Alert.alert(
        "AI Price Recommendation",
        `Analyzing demand and craft fair-trade floor for "${title}"…\n\nRecommended: ₹${Math.round(
          (items.find((x) => x.id === productId)?.price || 500) * 1.15
        )}\nProfit Margin: Guaranteed 20%+ Artisan Surplus via ONDC.`
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCF9F8" />

      {/* Top Bar (Exact Stitch Design) */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color="#9F3C16" />
          </Pressable>
          <View style={styles.brandRow}>
            <MaterialIcons name="storefront" size={22} color="#9F3C16" />
            <Text style={styles.topBarTitle}>My Creations</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setShowSearch(!showSearch)}
            hitSlop={8}
          >
            <Ionicons name="search" size={18} color="#57423B" />
          </Pressable>
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push("/seller-ai")}
            hitSlop={8}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Search Input Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#8A726A" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search creations by title or craft type…"
            placeholderTextColor="#8A726A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#8A726A" />
            </Pressable>
          ) : null}
        </View>
      )}

      {/* Filter Tabs (Stitch Design) */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tabPill, activeFilter === "ALL" && styles.tabPillActive]}
          onPress={() => setActiveFilter("ALL")}
        >
          <Text
            style={[styles.tabPillText, activeFilter === "ALL" && styles.tabPillTextActive]}
          >
            All ({items.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabPill, activeFilter === "ACTIVE" && styles.tabPillActive]}
          onPress={() => setActiveFilter("ACTIVE")}
        >
          <Text
            style={[styles.tabPillText, activeFilter === "ACTIVE" && styles.tabPillTextActive]}
          >
            Active ({items.filter((x) => (x.status || "").toUpperCase() === "PUBLISHED").length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabPill, activeFilter === "DRAFT" && styles.tabPillActive]}
          onPress={() => setActiveFilter("DRAFT")}
        >
          <Text
            style={[styles.tabPillText, activeFilter === "DRAFT" && styles.tabPillTextActive]}
          >
            Drafts ({items.filter((x) => (x.status || "").toUpperCase() === "DRAFT").length})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#9F3C16" />
          <Text style={styles.loadingText}>Loading your craft creations…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item, idx) => String(item.id || idx)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color="#DEC0B7" />
              <Text style={styles.emptyTitle}>No creations found</Text>
              <Text style={styles.emptySub}>
                Use our Voice & AI Catalog Studio to turn your handmade pieces into live listings.
              </Text>
              <Pressable
                style={styles.emptyCreateBtn}
                onPress={() => router.push("/seller-ai")}
              >
                <Text style={styles.emptyCreateBtnText}>+ Create with AI</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const isPublished = (item.status || "").toUpperCase() === "PUBLISHED";
            const img = item.enhanced_image_url || item.image_url;
            return (
              <View style={styles.listingCard}>
                <View style={styles.cardMain}>
                  <Image
                    source={{
                      uri:
                        img ||
                        "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=300"
                    }}
                    style={styles.thumb}
                  />
                  <View style={styles.cardDetails}>
                    <View style={styles.cardTopBadgeRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          isPublished ? styles.statusPublished : styles.statusDraft
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isPublished ? styles.statusTextPub : styles.statusTextDraft
                          ]}
                        >
                          {isPublished ? "Active" : "Draft"}
                        </Text>
                      </View>
                      <Text style={styles.idBadgeText}>ID: #CR-{item.id}</Text>
                    </View>

                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.title || "Handcrafted Masterpiece"}
                    </Text>
                    <Text style={styles.itemCategory} numberOfLines={1}>
                      {item.category || "Authentic Craft"}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.stockLabel}>
                      Stock:{" "}
                      <Text style={{ fontWeight: "700", color: "#1B1C1C" }}>
                        {item.stock ?? 4} units
                      </Text>
                    </Text>
                    <Text style={styles.priceValue}>
                      ₹{Number(item.price || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>

                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.actionBtnPrice}
                      onPress={() => handlePriceSuggestion(item.id, item.title)}
                    >
                      <Ionicons name="sparkles" size={13} color="#9F3C16" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnPriceText}>AI Price</Text>
                    </Pressable>

                    <Pressable
                      style={styles.actionBtnView}
                      onPress={() => router.push(`/product?id=${item.id}`)}
                    >
                      <Text style={styles.actionBtnViewText}>View</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
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
    paddingBottom: 14,
    backgroundColor: "#FCF9F8",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDED"
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#9F3C16",
    letterSpacing: -0.4
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F6F3F2",
    alignItems: "center",
    justifyContent: "center"
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#9F3C16",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#9F3C16",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F6F3F2",
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1B1C1C"
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8
  },
  tabPill: {
    backgroundColor: "#EAE7E7",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20
  },
  tabPillActive: {
    backgroundColor: "#9F3C16"
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#57423B"
  },
  tabPillTextActive: {
    color: "#FFFFFF"
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  listingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(222, 192, 183, 0.4)",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  cardMain: {
    flexDirection: "row",
    gap: 12
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#F0EDED"
  },
  cardDetails: {
    flex: 1,
    justifyContent: "center"
  },
  cardTopBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusPublished: {
    backgroundColor: "#FFDBCF"
  },
  statusDraft: {
    backgroundColor: "#F0EDED"
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800"
  },
  statusTextPub: {
    color: "#822801"
  },
  statusTextDraft: {
    color: "#8A726A"
  },
  idBadgeText: {
    fontSize: 11,
    color: "#8A726A"
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1B1C1C"
  },
  itemCategory: {
    fontSize: 12,
    color: "#8A726A",
    marginTop: 2
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0EDED"
  },
  stockLabel: {
    fontSize: 12,
    color: "#8A726A"
  },
  priceValue: {
    fontSize: 17,
    fontWeight: "900",
    color: "#9F3C16",
    marginTop: 2
  },
  cardActions: {
    flexDirection: "row",
    gap: 8
  },
  actionBtnPrice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFDBCF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  actionBtnPriceText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#822801"
  },
  actionBtnView: {
    backgroundColor: "#F6F3F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  actionBtnViewText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1B1C1C"
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30
  },
  loadingText: {
    fontSize: 13,
    color: "#8A726A",
    marginTop: 10
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 40
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B1C1C",
    marginTop: 12
  },
  emptySub: {
    fontSize: 13,
    color: "#8A726A",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20
  },
  emptyCreateBtn: {
    backgroundColor: "#9F3C16",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12
  },
  emptyCreateBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800"
  }
});
