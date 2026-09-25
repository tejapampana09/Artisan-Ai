import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { theme } from "../src/theme";
import { api } from "../src/api";
import { useI18n } from "../src/i18n";

interface CraftCluster {
  id: string;
  name: string;
  state: string;
  district?: string;
  craft: string;
  category: string;
  latitude: number;
  longitude: number;
  description: string;
  artisans_count?: number;
  products_count?: number;
}

interface ArtisanPin {
  id: number;
  name: string;
  craft: string;
  craft_specialization?: string;
  craft_cluster: string;
  latitude: number;
  longitude: number;
  state?: string;
  district?: string;
  location?: string;
  verification_status?: string;
}

export default function CraftMapScreen() {
  const { t } = useI18n();
  const [clusters, setClusters] = useState<CraftCluster[]>([]);
  const [pins, setPins] = useState<ArtisanPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"clusters" | "artisans">("clusters");
  const [selectedState, setSelectedState] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<CraftCluster | null>(null);

  useEffect(() => {
    loadMapData();
    detectUserGps();
  }, []);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const [clusterList, pinList] = await Promise.all([
        api.getCraftClusters().catch(() => []),
        api.getArtisanMapPins().catch(() => [])
      ]);
      setClusters(clusterList || []);
      setPins(pinList || []);
    } catch (err) {
      console.warn("Failed to load craft map data:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const detectUserGps = async () => {
    setDetectingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
      }
    } catch (e) {
      console.warn("GPS error on craft map:", e);
    } finally {
      setDetectingGps(false);
    }
  };

  const availableStates = useMemo(() => {
    const s = new Set<string>();
    clusters.forEach((c) => {
      if (c.state) s.add(c.state);
    });
    return ["All", ...Array.from(s).sort()];
  }, [clusters]);

  const filteredClusters = useMemo(() => {
    return clusters.filter((c) => {
      const matchState = selectedState === "All" || c.state.toLowerCase() === selectedState.toLowerCase();
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.craft.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q);
      return matchState && matchQuery;
    });
  }, [clusters, selectedState, searchQuery]);

  const filteredPins = useMemo(() => {
    return pins.filter((p) => {
      const matchState = selectedState === "All" || (p.state && p.state.toLowerCase() === selectedState.toLowerCase());
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.craft.toLowerCase().includes(q) ||
        p.craft_cluster.toLowerCase().includes(q);
      return matchState && matchQuery;
    });
  }, [pins, selectedState, searchQuery]);

  const openInMaps = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: "maps:0,0?q=", android: "geo:0,0?q=" });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    }) || `https://www.google.com/maps/search/?api=1&query=${latLng}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF8F3" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1917" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Heritage Craft Map of India</Text>
          <Text style={styles.headerSubtitle}>భారతీయ హస్తకళల క్లస్టర్లు & కళాకారుల స్టూడియోలు</Text>
        </View>
        <Pressable
          style={[styles.gpsBtn, detectingGps && { opacity: 0.6 }]}
          onPress={detectUserGps}
          disabled={detectingGps}
          hitSlop={6}
        >
          <Ionicons name="navigate" size={16} color={userLocation ? "#059669" : "#A6533B"} />
          <Text style={[styles.gpsBtnText, userLocation ? { color: "#059669" } : null]}>
            {userLocation ? "Near You" : "My GPS"}
          </Text>
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchBoxContainer}>
        <Ionicons name="search" size={18} color="#78716C" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Kalamkari, Pochampally, Jaipur, Etikoppaka..."
          placeholderTextColor="#A8A29E"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#78716C" />
          </Pressable>
        )}
      </View>

      {/* Mode Tabs (Clusters vs Active Artisans) */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === "clusters" && styles.tabBtnActive]}
          onPress={() => setActiveTab("clusters")}
        >
          <Ionicons
            name="shapes"
            size={16}
            color={activeTab === "clusters" ? "#FFFFFF" : "#78716C"}
          />
          <Text style={[styles.tabBtnText, activeTab === "clusters" && styles.tabBtnTextActive]}>
            GI Craft Clusters ({clusters.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "artisans" && styles.tabBtnActive]}
          onPress={() => setActiveTab("artisans")}
        >
          <Ionicons
            name="location"
            size={16}
            color={activeTab === "artisans" ? "#FFFFFF" : "#78716C"}
          />
          <Text style={[styles.tabBtnText, activeTab === "artisans" && styles.tabBtnTextActive]}>
            Artisan Studio Pins ({pins.length})
          </Text>
        </Pressable>
      </View>

      {/* State Filter Scroll */}
      <View style={styles.stateFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stateScroll}>
          {availableStates.map((st) => {
            const isSel = selectedState.toLowerCase() === st.toLowerCase();
            return (
              <Pressable
                key={"state-" + st}
                style={[styles.stateChip, isSel && styles.stateChipActive]}
                onPress={() => setSelectedState(st)}
              >
                <Text style={[styles.stateChipText, isSel && styles.stateChipTextActive]}>{st}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#A6533B" />
          <Text style={styles.loadingText}>Loading Heritage Map & Craft Clusters...</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: 40 }}>
          {activeTab === "clusters" ? (
            filteredClusters.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="map-outline" size={44} color="#D6D3D1" />
                <Text style={styles.emptyTitle}>No craft clusters match your search</Text>
                <Text style={styles.emptySub}>Try searching for another state or craft category.</Text>
              </View>
            ) : (
              filteredClusters.map((c) => {
                const distanceKm =
                  userLocation && c.latitude && c.longitude
                    ? Math.round(calculateDistance(userLocation.latitude, userLocation.longitude, c.latitude, c.longitude))
                    : null;

                return (
                  <View key={"cluster-" + c.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={styles.clusterName}>{c.name}</Text>
                          <View style={styles.giBadge}>
                            <Text style={styles.giBadgeText}>GI REGISTRY</Text>
                          </View>
                        </View>
                        <Text style={styles.clusterRegion}>
                          {c.state} • {c.category}
                        </Text>
                      </View>
                      {distanceKm !== null && (
                        <View style={styles.distanceBadge}>
                          <Ionicons name="navigate-circle" size={14} color="#A6533B" />
                          <Text style={styles.distanceText}>{distanceKm} km</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.craftTitle}>
                      Traditional Craft: <Text style={{ color: "#1C1917", fontWeight: "700" }}>{c.craft}</Text>
                    </Text>

                    <Text style={styles.description} numberOfLines={2}>
                      {c.description}
                    </Text>

                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Ionicons name="people" size={13} color="#78716C" />
                        <Text style={styles.statText}>
                          {c.artisans_count !== undefined ? `${c.artisans_count} Active Artisans` : "Heritage Cluster"}
                        </Text>
                      </View>
                      <View style={styles.statBox}>
                        <Ionicons name="cube" size={13} color="#78716C" />
                        <Text style={styles.statText}>
                          {c.products_count !== undefined ? `${c.products_count} Published Works` : "Handcrafted"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.mapActionBtn}
                        onPress={() => openInMaps(c.latitude, c.longitude, `${c.name} Heritage Craft Cluster`)}
                      >
                        <Ionicons name="map" size={14} color="#A6533B" />
                        <Text style={styles.mapActionBtnText}>Directions / Maps</Text>
                      </Pressable>
                      <Pressable
                        style={styles.browseActionBtn}
                        onPress={() => {
                          router.push({
                            pathname: "/search",
                            params: { q: c.craft }
                          } as any);
                        }}
                      >
                        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                        <Text style={styles.browseActionBtnText}>View Crafts</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )
          ) : (
            filteredPins.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="person-outline" size={44} color="#D6D3D1" />
                <Text style={styles.emptyTitle}>No active artisan studio pins found</Text>
                <Text style={styles.emptySub}>Artisans appear here once their studio GPS is active.</Text>
              </View>
            ) : (
              filteredPins.map((p) => {
                const distanceKm =
                  userLocation && p.latitude && p.longitude
                    ? Math.round(calculateDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude))
                    : null;

                return (
                  <View key={"pin-" + p.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clusterName}>{p.name}</Text>
                        <Text style={styles.clusterRegion}>
                          {p.craft_cluster} Cluster • {p.state || "India"}
                        </Text>
                      </View>
                      <View style={styles.verificationBadge}>
                        <Ionicons name="shield-checkmark" size={12} color="#065F46" />
                        <Text style={styles.verificationBadgeText}>
                          {p.verification_status === "GI_VERIFIED" ? "GI VERIFIED" : "REGISTERED"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.craftTitle}>
                      Artisan Craft: <Text style={{ color: "#1C1917", fontWeight: "700" }}>{p.craft}</Text>
                    </Text>

                    {p.location && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <Ionicons name="location-outline" size={14} color="#78716C" />
                        <Text style={{ fontSize: 12, color: "#57534E" }}>{p.location}</Text>
                      </View>
                    )}

                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.mapActionBtn}
                        onPress={() => openInMaps(p.latitude, p.longitude, `${p.name} Studio`)}
                      >
                        <Ionicons name="navigate-outline" size={14} color="#A6533B" />
                        <Text style={styles.mapActionBtnText}>
                          {distanceKm !== null ? `${distanceKm} km • Get Directions` : "View Studio Location"}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.browseActionBtn}
                        onPress={() => {
                          router.push({
                            pathname: "/search",
                            params: { q: p.name }
                          } as any);
                        }}
                      >
                        <Ionicons name="storefront-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.browseActionBtnText}>Studio Works</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF8F3"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D9",
    backgroundColor: "#FFFFFF"
  },
  backBtn: {
    padding: 6,
    marginRight: 8
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1917"
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#78716C",
    fontWeight: "500",
    marginTop: 1
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#FAF7F2",
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  gpsBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A6533B"
  },
  searchBoxContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#1C1917",
    paddingVertical: 2
  },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#EFEAE1",
    borderRadius: 12,
    padding: 3,
    gap: 4
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10
  },
  tabBtnActive: {
    backgroundColor: "#A6533B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78716C"
  },
  tabBtnTextActive: {
    color: "#FFFFFF"
  },
  stateFilterContainer: {
    paddingVertical: 10
  },
  stateScroll: {
    paddingHorizontal: 16,
    gap: 8
  },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  stateChipActive: {
    backgroundColor: "#A6533B",
    borderColor: "#A6533B"
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#57534E"
  },
  stateChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
    color: "#78716C"
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1917",
    marginTop: 12
  },
  emptySub: {
    fontSize: 12,
    color: "#78716C",
    textAlign: "center",
    marginTop: 4
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6
  },
  clusterName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1917"
  },
  clusterRegion: {
    fontSize: 12,
    color: "#78716C",
    marginTop: 2
  },
  giBadge: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8
  },
  giBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#92400E"
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FAF7F2",
    borderWidth: 1,
    borderColor: "#E8E2D9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  distanceText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A6533B"
  },
  craftTitle: {
    fontSize: 13,
    color: "#57534E",
    marginTop: 4
  },
  description: {
    fontSize: 12,
    color: "#78716C",
    lineHeight: 18,
    marginTop: 6
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F5F0E8"
  },
  statBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  statText: {
    fontSize: 11,
    color: "#78716C",
    fontWeight: "500"
  },
  verificationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#D1FAE5",
    borderWidth: 1,
    borderColor: "#6EE7B7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  verificationBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#065F46"
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E8E2D9"
  },
  mapActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#FAF7F2",
    borderWidth: 1,
    borderColor: "#E8E2D9"
  },
  mapActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A6533B"
  },
  browseActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#A6533B"
  },
  browseActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
