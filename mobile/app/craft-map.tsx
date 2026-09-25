import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  StatusBar,
  Modal
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
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

type TileType = "STREET" | "SATELLITE" | "TOPO" | "OSM";

export default function CraftMapScreen() {
  const { t } = useI18n();
  const webViewRef = useRef<any>(null);
  const WebViewComponent = WebView as any;

  const [clusters, setClusters] = useState<CraftCluster[]>([]);
  const [pins, setPins] = useState<ArtisanPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"clusters" | "artisans">("clusters");
  const [selectedState, setSelectedState] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTileType, setActiveTileType] = useState<TileType>("STREET");

  // Selection & Geolocation
  const [selectedCluster, setSelectedCluster] = useState<CraftCluster | null>(null);
  const [selectedArtisan, setSelectedArtisan] = useState<ArtisanPin | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);

  // Modals & Panels
  const [showListModal, setShowListModal] = useState(false);
  const [showLayerModal, setShowLayerModal] = useState(false);

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

      if (clusterList && clusterList.length > 0) {
        const defaultCluster = clusterList.find((c: any) => c.id === "srikalahasti") || clusterList[0];
        setSelectedCluster(defaultCluster);
      }
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
    return Math.round(R * c);
  };

  const detectUserGps = async () => {
    setDetectingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        };
        setUserLocation(coords);

        if (mapReady && webViewRef.current) {
          webViewRef.current.injectJavaScript(
            `if (window.flyToUser) { window.flyToUser(${coords.latitude}, ${coords.longitude}); } true;`
          );
        }
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

  // Sync markers to Leaflet WebView whenever filters, data, or active items change
  const syncMarkersToWebView = useCallback(() => {
    if (!mapReady || !webViewRef.current) return;
    const payload = JSON.stringify({
      clusters: filteredClusters,
      pins: filteredPins,
      userLocation: userLocation,
      selectedClusterId: selectedCluster?.id || null,
      selectedArtisanId: selectedArtisan?.id || null,
      tileType: activeTileType
    });
    webViewRef.current.injectJavaScript(`if (window.updateMapData) { window.updateMapData(${payload}); } true;`);
  }, [mapReady, filteredClusters, filteredPins, userLocation, selectedCluster, selectedArtisan, activeTileType]);

  useEffect(() => {
    syncMarkersToWebView();
  }, [syncMarkersToWebView]);

  const handleSelectCluster = (c: CraftCluster) => {
    setSelectedCluster(c);
    setSelectedArtisan(null);
    if (mapReady && webViewRef.current && c.latitude && c.longitude) {
      webViewRef.current.injectJavaScript(
        `if (window.flyToCoords) { window.flyToCoords(${c.latitude}, ${c.longitude}, 9); } true;`
      );
    }
  };

  const handleSelectArtisan = (a: ArtisanPin) => {
    setSelectedArtisan(a);
    setSelectedCluster(null);
    if (mapReady && webViewRef.current && a.latitude && a.longitude) {
      webViewRef.current.injectJavaScript(
        `if (window.flyToCoords) { window.flyToCoords(${a.latitude}, ${a.longitude}, 10); } true;`
      );
    }
  };

  const handleZoomIn = () => {
    webViewRef.current?.injectJavaScript(`if (window.zoomIn) { window.zoomIn(); } true;`);
  };

  const handleZoomOut = () => {
    webViewRef.current?.injectJavaScript(`if (window.zoomOut) { window.zoomOut(); } true;`);
  };

  const handleRecenterIndia = () => {
    webViewRef.current?.injectJavaScript(`if (window.recenterIndia) { window.recenterIndia(); } true;`);
  };

  const handleSetTileLayer = (type: TileType) => {
    setActiveTileType(type);
    setShowLayerModal(false);
    webViewRef.current?.injectJavaScript(`if (window.setTileLayer) { window.setTileLayer("${type}"); } true;`);
  };

  const openInMaps = (lat: number, lng: number, label: string) => {
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latLng}`,
      android: `geo:0,0?q=${latLng}(${label})`
    }) || `https://www.google.com/maps/search/?api=1&query=${latLng}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
    });
  };

  // Full interactive Leaflet map HTML
  const leafletHtml = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; overflow:hidden; background:#E5E7EB; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
    
    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.35); opacity: 0.2; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    @keyframes ping {
      0% { transform: scale(1); opacity: 0.8; }
      80%, 100% { transform: scale(2.2); opacity: 0; }
    }

    .pulse-ring {
      position: absolute;
      top: -6px; left: -6px;
      width: 36px; height: 36px;
      border-radius: 50%;
      background: #A6533B;
      animation: pulse 1.8s infinite;
    }
    .artisan-pulse-ring {
      position: absolute;
      top: -6px; left: -6px;
      width: 34px; height: 34px;
      border-radius: 50%;
      background: #10B981;
      animation: pulse 1.8s infinite;
    }
    .gps-ring {
      position: absolute;
      top: -8px; left: -8px;
      width: 36px; height: 36px;
      border-radius: 50%;
      background: #3B82F6;
      animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map;
    var currentTileLayer;
    var markersLayerGroup;
    var userLocationMarker;

    var TILE_URLS = {
      STREET: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      SATELLITE: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      TOPO: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      OSM: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    };

    function initMap() {
      map = L.map('map', {
        center: [21.5, 79.5],
        zoom: 5,
        minZoom: 4,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false
      });

      currentTileLayer = L.tileLayer(TILE_URLS.STREET, { maxZoom: 19 }).addTo(map);
      markersLayerGroup = L.layerGroup().addTo(map);

      // Tell React Native map is ready
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
      }
    }

    window.setTileLayer = function(type) {
      if (!map || !TILE_URLS[type]) return;
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      currentTileLayer = L.tileLayer(TILE_URLS[type], { maxZoom: 19 }).addTo(map);
    };

    window.flyToCoords = function(lat, lng, zoom) {
      if (!map) return;
      map.flyTo([lat, lng], zoom || 9, { duration: 1.2 });
    };

    window.flyToUser = function(lat, lng) {
      if (!map) return;
      map.flyTo([lat, lng], 8, { duration: 1.5 });
    };

    window.zoomIn = function() {
      if (map) map.zoomIn();
    };

    window.zoomOut = function() {
      if (map) map.zoomOut();
    };

    window.recenterIndia = function() {
      if (map) map.flyTo([21.5, 79.5], 5, { duration: 1.2 });
    };

    window.updateMapData = function(data) {
      if (!map || !markersLayerGroup) return;
      markersLayerGroup.clearLayers();

      // 1. User GPS beacon
      if (data.userLocation && data.userLocation.latitude && data.userLocation.longitude) {
        var uLat = data.userLocation.latitude;
        var uLng = data.userLocation.longitude;
        var gpsHtml = '<div style="position:relative; width:20px; height:20px; display:flex; align-items:center; justify-content:center;">' +
          '<div class="gps-ring"></div>' +
          '<div style="width:16px; height:16px; border-radius:50%; background:#2563EB; border:3px solid #FFFFFF; box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>' +
          '</div>';

        var gpsIcon = L.divIcon({
          className: 'user-gps-icon',
          html: gpsHtml,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        L.marker([uLat, uLng], { icon: gpsIcon, zIndexOffset: 1000 })
          .bindTooltip('<b>You are here</b><br>GPS Geolocation Active', { direction: 'top', offset: [0, -10] })
          .addTo(markersLayerGroup);
      }

      // 2. Clusters markers
      if (data.clusters && data.clusters.length > 0) {
        data.clusters.forEach(function(cluster) {
          if (!cluster.latitude || !cluster.longitude) return;
          var isSelected = (data.selectedClusterId === cluster.id);
          var clusterHtml = '<div style="display:flex; flex-direction:column; align-items:center; cursor:pointer;">' +
            '<div style="position:relative; width:' + (isSelected ? '32px' : '26px') + '; height:' + (isSelected ? '32px' : '26px') + '; display:flex; align-items:center; justify-content:center;">' +
            (isSelected ? '<div class="pulse-ring"></div>' : '') +
            '<div style="width:' + (isSelected ? '24px' : '20px') + '; height:' + (isSelected ? '24px' : '20px') + '; border-radius:50%; background:' + (isSelected ? '#8C3F2B' : '#A6533B') + '; border:2.5px solid #FFFFFF; box-shadow:0 3px 8px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center;">' +
            '<div style="width:6px; height:6px; border-radius:50%; background:#FFFFFF;"></div>' +
            '</div>' +
            '</div>' +
            '<div style="margin-top:2px; background:' + (isSelected ? '#1C1917' : 'rgba(255,255,255,0.95)') + '; color:' + (isSelected ? '#FFFFFF' : '#1C1917') + '; font-size:10px; font-weight:700; padding:1px 6px; border-radius:6px; border:1px solid ' + (isSelected ? '#A6533B' : '#D1C7BA') + '; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.2);">' +
            cluster.name +
            '</div>' +
            '</div>';

          var clusterIcon = L.divIcon({
            className: 'cluster-pin-icon',
            html: clusterHtml,
            iconSize: [80, 50],
            iconAnchor: [40, 20]
          });

          var marker = L.marker([cluster.latitude, cluster.longitude], {
            icon: clusterIcon,
            zIndexOffset: isSelected ? 800 : 500
          }).addTo(markersLayerGroup);

          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SELECT_CLUSTER',
                id: cluster.id
              }));
            }
          });
        });
      }

      // 3. Artisans pins
      if (data.pins && data.pins.length > 0) {
        data.pins.forEach(function(pin) {
          if (!pin.latitude || !pin.longitude) return;
          var isSelected = (data.selectedArtisanId === pin.id);
          var artisanHtml = '<div style="display:flex; flex-direction:column; align-items:center; cursor:pointer;">' +
            '<div style="position:relative; width:' + (isSelected ? '30px' : '24px') + '; height:' + (isSelected ? '30px' : '24px') + '; display:flex; align-items:center; justify-content:center;">' +
            (isSelected ? '<div class="artisan-pulse-ring"></div>' : '') +
            '<div style="width:' + (isSelected ? '22px' : '18px') + '; height:' + (isSelected ? '22px' : '18px') + '; border-radius:50%; background:' + (isSelected ? '#065F46' : '#10B981') + '; border:2.5px solid #FFFFFF; box-shadow:0 3px 6px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">' +
            '<div style="width:5px; height:5px; border-radius:50%; background:#FFFFFF;"></div>' +
            '</div>' +
            '</div>' +
            '<div style="margin-top:2px; background:' + (isSelected ? '#064E3B' : 'rgba(255,255,255,0.95)') + '; color:' + (isSelected ? '#FFFFFF' : '#065F46') + '; font-size:9.5px; font-weight:700; padding:1px 5px; border-radius:5px; border:1px solid ' + (isSelected ? '#10B981' : '#A7F3D0') + '; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.18);">' +
            (pin.name || 'Studio') +
            '</div>' +
            '</div>';

          var artisanIcon = L.divIcon({
            className: 'artisan-pin-icon',
            html: artisanHtml,
            iconSize: [80, 48],
            iconAnchor: [40, 16]
          });

          var marker = L.marker([pin.latitude, pin.longitude], {
            icon: artisanIcon,
            zIndexOffset: isSelected ? 750 : 600
          }).addTo(markersLayerGroup);

          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SELECT_ARTISAN',
                id: pin.id
              }));
            }
          });
        });
      }
    };

    window.onload = initMap;
  </script>
</body>
</html>
    `;
  }, []);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "MAP_READY") {
        setMapReady(true);
      } else if (data.type === "SELECT_CLUSTER") {
        const found = clusters.find((c) => c.id === data.id);
        if (found) {
          setSelectedCluster(found);
          setSelectedArtisan(null);
        }
      } else if (data.type === "SELECT_ARTISAN") {
        const found = pins.find((p) => p.id === data.id);
        if (found) {
          setSelectedArtisan(found);
          setSelectedCluster(null);
        }
      }
    } catch (err) {
      console.warn("Error parsing map message:", err);
    }
  };

  const selectedDistanceKm = useMemo(() => {
    if (!userLocation) return null;
    if (selectedCluster && selectedCluster.latitude && selectedCluster.longitude) {
      return calculateDistance(userLocation.latitude, userLocation.longitude, selectedCluster.latitude, selectedCluster.longitude);
    }
    if (selectedArtisan && selectedArtisan.latitude && selectedArtisan.longitude) {
      return calculateDistance(userLocation.latitude, userLocation.longitude, selectedArtisan.latitude, selectedArtisan.longitude);
    }
    return null;
  }, [userLocation, selectedCluster, selectedArtisan]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF8F3" />

      {/* 1. Full Screen Interactive Leaflet Map */}
      <View style={styles.mapWrapper}>
        <WebViewComponent
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: leafletHtml }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          bounces={false}
        />

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.mapLoadingOverlay}>
            <ActivityIndicator size="large" color="#A6533B" />
            <Text style={styles.mapLoadingText}>Loading Interactive Heritage Map...</Text>
          </View>
        )}

        {/* 2. Floating Top Header & Search Bar */}
        <View style={styles.floatingHeaderArea}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color="#1C1917" />
            </Pressable>

            <View style={styles.searchBarBox}>
              <Ionicons name="search" size={16} color="#78716C" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search craft, cluster, state..."
                placeholderTextColor="#A8A29E"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color="#78716C" />
                </Pressable>
              )}
            </View>

            <Pressable
              style={styles.listToggleBtn}
              onPress={() => setShowListModal(true)}
              hitSlop={8}
            >
              <Ionicons name="list" size={18} color="#1C1917" />
            </Pressable>
          </View>

          {/* Mode Switch Tabs: Heritage Crafts vs Artisan Studios */}
          <View style={styles.modeTabRow}>
            <Pressable
              style={[styles.modeTabBtn, activeTab === "clusters" && styles.modeTabBtnActive]}
              onPress={() => {
                setActiveTab("clusters");
                if (filteredClusters.length > 0) handleSelectCluster(filteredClusters[0]);
              }}
            >
              <Ionicons
                name="shapes"
                size={13}
                color={activeTab === "clusters" ? "#FFFFFF" : "#57534E"}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.modeTabBtnText, activeTab === "clusters" && styles.modeTabBtnTextActive]}>
                Heritage Crafts ({filteredClusters.length})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeTabBtn, activeTab === "artisans" && styles.modeTabBtnActive]}
              onPress={() => {
                setActiveTab("artisans");
                if (filteredPins.length > 0) handleSelectArtisan(filteredPins[0]);
              }}
            >
              <Ionicons
                name="storefront"
                size={13}
                color={activeTab === "artisans" ? "#FFFFFF" : "#57534E"}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.modeTabBtnText, activeTab === "artisans" && styles.modeTabBtnTextActive]}>
                Artisan Studios ({filteredPins.length})
              </Text>
            </Pressable>
          </View>

          {/* Horizontally Scrolling State Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stateScroll}
          >
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

        {/* 3. Floating Right Map Controls */}
        <View style={styles.floatingControls}>
          {/* Layer switcher */}
          <Pressable
            style={styles.mapControlBtn}
            onPress={() => setShowLayerModal(true)}
            hitSlop={6}
          >
            <Ionicons name="layers-outline" size={20} color="#1C1917" />
          </Pressable>

          {/* GPS Locate Me */}
          <Pressable
            style={[styles.mapControlBtn, detectingGps && { opacity: 0.6 }]}
            onPress={detectUserGps}
            disabled={detectingGps}
            hitSlop={6}
          >
            <Ionicons
              name="navigate"
              size={20}
              color={userLocation ? "#059669" : "#A6533B"}
            />
          </Pressable>

          {/* Recenter India */}
          <Pressable
            style={styles.mapControlBtn}
            onPress={handleRecenterIndia}
            hitSlop={6}
          >
            <Text style={{ fontSize: 16 }}>🇮🇳</Text>
          </Pressable>

          {/* Zoom controls */}
          <View style={styles.zoomControlGroup}>
            <Pressable style={styles.zoomBtn} onPress={handleZoomIn} hitSlop={4}>
              <Ionicons name="add" size={20} color="#1C1917" />
            </Pressable>
            <View style={styles.zoomDivider} />
            <Pressable style={styles.zoomBtn} onPress={handleZoomOut} hitSlop={4}>
              <Ionicons name="remove" size={20} color="#1C1917" />
            </Pressable>
          </View>
        </View>

        {/* 4. Bottom Detail Card (Selected Cluster or Artisan) */}
        {selectedCluster ? (
          <View style={styles.bottomCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{selectedCluster.name}</Text>
                  <View style={styles.giBadge}>
                    <Text style={styles.giBadgeText}>GI REGISTRY</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  {selectedCluster.state} • {selectedCluster.category}
                </Text>
              </View>

              {selectedDistanceKm !== null && (
                <View style={styles.distanceBadge}>
                  <Ionicons name="navigate-circle" size={14} color="#A6533B" />
                  <Text style={styles.distanceText}>{selectedDistanceKm} km away</Text>
                </View>
              )}

              <Pressable
                onPress={() => setSelectedCluster(null)}
                style={styles.cardCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color="#78716C" />
              </Pressable>
            </View>

            <Text style={styles.craftLabel}>
              Traditional Craft: <Text style={{ color: "#1C1917", fontWeight: "700" }}>{selectedCluster.craft}</Text>
            </Text>

            <Text style={styles.cardDesc} numberOfLines={2}>
              {selectedCluster.description}
            </Text>

            <View style={styles.cardStatsRow}>
              <View style={styles.statPill}>
                <Ionicons name="people" size={13} color="#78716C" />
                <Text style={styles.statPillText}>
                  {selectedCluster.artisans_count ?? "Verified"} Artisans
                </Text>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="cube" size={13} color="#78716C" />
                <Text style={styles.statPillText}>
                  {selectedCluster.products_count ?? "Live"} Crafts
                </Text>
              </View>
            </View>

            <View style={styles.cardActionRow}>
              <Pressable
                style={styles.directionsBtn}
                onPress={() => openInMaps(selectedCluster.latitude, selectedCluster.longitude, `${selectedCluster.name} Heritage Craft Cluster`)}
              >
                <Ionicons name="navigate-outline" size={16} color="#A6533B" style={{ marginRight: 6 }} />
                <Text style={styles.directionsBtnText}>Directions</Text>
              </Pressable>

              <Pressable
                style={styles.exploreBtn}
                onPress={() => {
                  router.push({
                    pathname: "/search",
                    params: { q: selectedCluster.craft }
                  } as any);
                }}
              >
                <Ionicons name="sparkles" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.exploreBtnText}>View Crafts</Text>
              </Pressable>
            </View>
          </View>
        ) : selectedArtisan ? (
          <View style={styles.bottomCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{selectedArtisan.name}</Text>
                  <View style={[styles.giBadge, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
                    <Text style={[styles.giBadgeText, { color: "#166534" }]}>VERIFIED ARTISAN</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  {selectedArtisan.location || selectedArtisan.state || "Studio Location"}
                </Text>
              </View>

              {selectedDistanceKm !== null && (
                <View style={styles.distanceBadge}>
                  <Ionicons name="navigate-circle" size={14} color="#A6533B" />
                  <Text style={styles.distanceText}>{selectedDistanceKm} km</Text>
                </View>
              )}

              <Pressable
                onPress={() => setSelectedArtisan(null)}
                style={styles.cardCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color="#78716C" />
              </Pressable>
            </View>

            <Text style={styles.craftLabel}>
              Master Craftsman: <Text style={{ color: "#1C1917", fontWeight: "700" }}>{selectedArtisan.craft}</Text>
            </Text>

            <View style={styles.cardActionRow}>
              <Pressable
                style={styles.directionsBtn}
                onPress={() => openInMaps(selectedArtisan.latitude, selectedArtisan.longitude, `${selectedArtisan.name} Studio`)}
              >
                <Ionicons name="navigate-outline" size={16} color="#A6533B" style={{ marginRight: 6 }} />
                <Text style={styles.directionsBtnText}>Directions</Text>
              </Pressable>

              <Pressable
                style={styles.exploreBtn}
                onPress={() => {
                  router.push({
                    pathname: "/search",
                    params: { q: selectedArtisan.craft }
                  } as any);
                }}
              >
                <Ionicons name="sparkles" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.exploreBtnText}>Browse Works</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.bottomHintCard}>
            <Ionicons name="information-circle-outline" size={18} color="#A6533B" style={{ marginRight: 8 }} />
            <Text style={styles.bottomHintText}>
              Tap any pin on the map to view heritage details, directions & live crafts.
            </Text>
          </View>
        )}
      </View>

      {/* 5. Layer Switcher Modal */}
      <Modal
        visible={showLayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLayerModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLayerModal(false)}>
          <View style={styles.layerModalBox}>
            <Text style={styles.layerModalTitle}>Select Map Style</Text>

            <Pressable
              style={[styles.layerOption, activeTileType === "STREET" && styles.layerOptionActive]}
              onPress={() => handleSetTileLayer("STREET")}
            >
              <Text style={styles.layerOptionEmoji}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.layerOptionName}>Street Map</Text>
                <Text style={styles.layerOptionDesc}>ArcGIS high-detail street layout</Text>
              </View>
              {activeTileType === "STREET" && <Ionicons name="checkmark" size={18} color="#A6533B" />}
            </Pressable>

            <Pressable
              style={[styles.layerOption, activeTileType === "SATELLITE" && styles.layerOptionActive]}
              onPress={() => handleSetTileLayer("SATELLITE")}
            >
              <Text style={styles.layerOptionEmoji}>🛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.layerOptionName}>Satellite Imagery</Text>
                <Text style={styles.layerOptionDesc}>Photorealistic earth imagery</Text>
              </View>
              {activeTileType === "SATELLITE" && <Ionicons name="checkmark" size={18} color="#A6533B" />}
            </Pressable>

            <Pressable
              style={[styles.layerOption, activeTileType === "TOPO" && styles.layerOptionActive]}
              onPress={() => handleSetTileLayer("TOPO")}
            >
              <Text style={styles.layerOptionEmoji}>🏔️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.layerOptionName}>Terrain & Topo</Text>
                <Text style={styles.layerOptionDesc}>Contour & regional topography</Text>
              </View>
              {activeTileType === "TOPO" && <Ionicons name="checkmark" size={18} color="#A6533B" />}
            </Pressable>

            <Pressable
              style={[styles.layerOption, activeTileType === "OSM" && styles.layerOptionActive]}
              onPress={() => handleSetTileLayer("OSM")}
            >
              <Text style={styles.layerOptionEmoji}>🧭</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.layerOptionName}>OpenStreetMap</Text>
                <Text style={styles.layerOptionDesc}>Open community global map</Text>
              </View>
              {activeTileType === "OSM" && <Ionicons name="checkmark" size={18} color="#A6533B" />}
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 6. List View Modal */}
      <Modal
        visible={showListModal}
        animationType="slide"
        onRequestClose={() => setShowListModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF9F6" }}>
          <View style={styles.listModalHeader}>
            <Text style={styles.listModalTitle}>
              {activeTab === "clusters"
                ? `Heritage Craft Clusters (${filteredClusters.length})`
                : `Verified Artisan Studios (${filteredPins.length})`}
            </Text>
            <Pressable onPress={() => setShowListModal(false)} style={styles.listModalCloseBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color="#1C1917" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {activeTab === "clusters" ? (
              filteredClusters.map((c) => {
                const dist =
                  userLocation && c.latitude && c.longitude
                    ? calculateDistance(userLocation.latitude, userLocation.longitude, c.latitude, c.longitude)
                    : null;

                return (
                  <Pressable
                    key={"modal-cluster-" + c.id}
                    style={styles.modalClusterCard}
                    onPress={() => {
                      setShowListModal(false);
                      handleSelectCluster(c);
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.modalClusterName}>{c.name}</Text>
                        <Text style={styles.modalClusterCraft}>Craft: {c.craft}</Text>
                        <Text style={styles.modalClusterRegion}>{c.state} • {c.category}</Text>
                      </View>
                      {dist !== null && (
                        <View style={styles.modalDistanceBadge}>
                          <Text style={styles.modalDistanceText}>{dist} km</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modalClusterDesc} numberOfLines={2}>{c.description}</Text>
                    <View style={styles.modalCardFooter}>
                      <Text style={styles.modalTapHint}>Tap to view & focus on map →</Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              filteredPins.map((p) => {
                const dist =
                  userLocation && p.latitude && p.longitude
                    ? calculateDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude)
                    : null;

                return (
                  <Pressable
                    key={"modal-artisan-" + p.id}
                    style={styles.modalClusterCard}
                    onPress={() => {
                      setShowListModal(false);
                      handleSelectArtisan(p);
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.modalClusterName}>{p.name}</Text>
                        <Text style={styles.modalClusterCraft}>Craft: {p.craft}</Text>
                        <Text style={styles.modalClusterRegion}>{p.location || p.state || "India"}</Text>
                      </View>
                      {dist !== null && (
                        <View style={styles.modalDistanceBadge}>
                          <Text style={styles.modalDistanceText}>{dist} km</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.modalCardFooter}>
                      <Text style={styles.modalTapHint}>Tap to view studio on map →</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF8F3"
  },
  mapWrapper: {
    flex: 1,
    position: "relative"
  },
  webView: {
    flex: 1,
    backgroundColor: "#E5E7EB"
  },
  mapLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(251, 248, 243, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "700",
    color: "#78350F"
  },
  floatingHeaderArea: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    zIndex: 50
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6
  },
  searchBarBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#1C1917",
    padding: 0
  },
  listToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6
  },
  modeTabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  modeTabBtnActive: {
    backgroundColor: "#A6533B",
    borderColor: "#A6533B"
  },
  modeTabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#57534E"
  },
  modeTabBtnTextActive: {
    color: "#FFFFFF"
  },
  stateScroll: {
    paddingVertical: 2,
    gap: 6
  },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  stateChipActive: {
    backgroundColor: "#A6533B",
    borderColor: "#A6533B"
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#44403C"
  },
  stateChipTextActive: {
    color: "#FFFFFF"
  },
  floatingControls: {
    position: "absolute",
    right: 14,
    top: 110,
    alignItems: "center",
    gap: 10,
    zIndex: 40
  },
  mapControlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 6
  },
  zoomControlGroup: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    overflow: "hidden"
  },
  zoomBtn: {
    width: 42,
    height: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  zoomDivider: {
    height: 1,
    backgroundColor: "#E5E5E5"
  },
  bottomCard: {
    position: "absolute",
    bottom: 16,
    left: 14,
    right: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    zIndex: 60
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1917"
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#78716C",
    marginTop: 2
  },
  giBadge: {
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  giBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.4
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6
  },
  distanceText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A6533B",
    marginLeft: 3
  },
  cardCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F5F5F4",
    alignItems: "center",
    justifyContent: "center"
  },
  craftLabel: {
    fontSize: 13,
    color: "#57534E",
    marginBottom: 4
  },
  cardDesc: {
    fontSize: 12,
    color: "#78716C",
    lineHeight: 17,
    marginBottom: 10
  },
  cardStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FAF9F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E7E5E4"
  },
  statPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#57534E"
  },
  cardActionRow: {
    flexDirection: "row",
    gap: 10
  },
  directionsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FAF9F6",
    borderWidth: 1,
    borderColor: "#A6533B"
  },
  directionsBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#A6533B"
  },
  exploreBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#A6533B"
  },
  exploreBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  bottomHintCard: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: "#E7E5E4"
  },
  bottomHintText: {
    fontSize: 12,
    color: "#57534E",
    flex: 1,
    fontWeight: "500"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  layerModalBox: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  layerModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1C1917",
    marginBottom: 12
  },
  layerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#FAF9F6",
    marginBottom: 8
  },
  layerOptionActive: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  layerOptionEmoji: {
    fontSize: 22,
    marginRight: 10
  },
  layerOptionName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1917"
  },
  layerOptionDesc: {
    fontSize: 11,
    color: "#78716C",
    marginTop: 1
  },
  listModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E7E5E4"
  },
  listModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1917"
  },
  listModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F5F4",
    alignItems: "center",
    justifyContent: "center"
  },
  modalClusterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  modalClusterName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1C1917"
  },
  modalClusterCraft: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A6533B",
    marginTop: 2
  },
  modalClusterRegion: {
    fontSize: 12,
    color: "#78716C",
    marginTop: 1
  },
  modalDistanceBadge: {
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  modalDistanceText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A6533B"
  },
  modalClusterDesc: {
    fontSize: 12,
    color: "#57534E",
    marginTop: 8,
    lineHeight: 16
  },
  modalCardFooter: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F4",
    paddingTop: 8
  },
  modalTapHint: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A6533B"
  }
});
