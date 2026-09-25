import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, Compass, ShoppingBag, 
  CheckCircle2, Search, X, ChevronRight, Info, ShieldCheck,
  Store, Award, ArrowUpRight, LocateFixed, Layers, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { fetchCraftClusters, fetchArtisanMapPins } from '../api/index.js';
import { useNotification } from '../context/NotificationContext';
import ArtisanProfileModal from './ArtisanProfileModal';

// Calculate Great Circle Haversine distance in KM
function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
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
}

// Map Tile Providers
const TILE_LAYERS = {
  VOYAGER: {
    name: 'Heritage Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  OSM: {
    name: 'Standard Street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  SATELLITE: {
    name: 'Satellite View',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }
};

export default function CraftMapView({ onSelectMode, onSelectProduct, onOpenAuth }) {
  const notify = useNotification();

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [clusters, setClusters] = useState([]);
  const [artisanPins, setArtisanPins] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedState, setSelectedState] = useState('All');
  const [selectedCraft, setSelectedCraft] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTileType, setActiveTileType] = useState('VOYAGER');

  // Active Selected Cluster or Artisan Pin
  const [activeCluster, setActiveCluster] = useState(null);
  const [selectedArtisanId, setSelectedArtisanId] = useState(null);

  // User's Real Browser GPS Geolocation
  const [userLocation, setUserLocation] = useState(null);
  const [detectingGps, setDetectingGps] = useState(false);

  // Load canonical clusters and real artisan pins from the backend
  useEffect(() => {
    async function loadMapData() {
      setLoading(true);
      try {
        const [clustersData, pinsData] = await Promise.all([
          fetchCraftClusters(),
          fetchArtisanMapPins()
        ]);
        setClusters(clustersData || []);
        setArtisanPins(pinsData || []);

        if (clustersData && clustersData.length > 0) {
          const defaultCluster = clustersData.find(c => c.id === 'srikalahasti') || clustersData[0];
          setActiveCluster(defaultCluster);
        }
      } catch (err) {
        console.error('Failed to load craft map data:', err);
        notify.error('Could not load heritage craft map data');
      } finally {
        setLoading(false);
      }
    }
    loadMapData();
  }, []);

  // Initialize Real Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double init

    // Center on India [20.5937, 78.9629], Zoom level 5
    const map = L.map(mapContainerRef.current, {
      center: [21.5, 79.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false // Custom controls in UI
    });

    const tileCfg = TILE_LAYERS[activeTileType] || TILE_LAYERS.VOYAGER;
    const tileLayer = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: 19
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Layer group for pins
    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Clean up on unmount
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer if user switches (Voyager vs Satellite vs OSM)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const tileCfg = TILE_LAYERS[activeTileType] || TILE_LAYERS.VOYAGER;
    const newLayer = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: 19
    }).addTo(map);
    tileLayerRef.current = newLayer;
  }, [activeTileType]);

  // Request buyer's real-time GPS location
  const handleDetectUserLocation = () => {
    if (!navigator.geolocation) {
      notify.error('Geolocation is not supported by your browser');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        setDetectingGps(false);
        notify.success('Detected your location on the map! Showing nearest clusters.');

        // Find nearest cluster
        if (clusters.length > 0) {
          let closest = clusters[0];
          let minDist = getHaversineDistanceKm(latitude, longitude, closest.latitude, closest.longitude);
          clusters.forEach(c => {
            const d = getHaversineDistanceKm(latitude, longitude, c.latitude, c.longitude);
            if (d < minDist) {
              minDist = d;
              closest = c;
            }
          });
          setActiveCluster(closest);

          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([latitude, longitude], 8, { duration: 1.5 });
          }
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setDetectingGps(false);
        notify.warning('Could not detect location. Please allow browser location access.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Distinct states for filter
  const availableStates = useMemo(() => {
    const states = new Set(clusters.map(c => c.state).filter(Boolean));
    return ['All', ...Array.from(states).sort()];
  }, [clusters]);

  // Distinct crafts for filter
  const availableCrafts = useMemo(() => {
    const crafts = new Set(clusters.map(c => c.canonical_craft).filter(Boolean));
    return ['All', ...Array.from(crafts).sort()];
  }, [clusters]);

  // Filtered clusters based on user search and filters
  const filteredClusters = useMemo(() => {
    return clusters.filter(c => {
      const matchState = selectedState === 'All' || c.state === selectedState;
      const matchCraft = selectedCraft === 'All' || c.canonical_craft === selectedCraft;
      const matchQuery = !searchQuery.trim() || 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.canonical_craft.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.district.toLowerCase().includes(searchQuery.toLowerCase());
      return matchState && matchCraft && matchQuery;
    });
  }, [clusters, selectedState, selectedCraft, searchQuery]);

  // Filtered artisan pins
  const filteredPins = useMemo(() => {
    return artisanPins.filter(pin => {
      const matchState = selectedState === 'All' || pin.state === selectedState;
      const matchCraft = selectedCraft === 'All' || (pin.craft && pin.craft.toLowerCase().includes(selectedCraft.toLowerCase()));
      const matchQuery = !searchQuery.trim() || 
        pin.artisan_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pin.craft && pin.craft.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pin.craft_cluster && pin.craft_cluster.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchState && matchCraft && matchQuery;
    });
  }, [artisanPins, selectedState, selectedCraft, searchQuery]);

  // Render Real Markers onto the Leaflet Map Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const group = markersLayerRef.current;
    group.clearLayers();

    // 1. User GPS Marker if detected
    if (userLocation) {
      const userHtml = `
        <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:32px; height:32px; border-radius:50%; background:#3B82F6; opacity:0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width:16px; height:16px; border-radius:50%; background:#2563EB; border:3px solid #FFFFFF; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
        </div>
      `;
      const userIcon = L.divIcon({
        className: 'user-gps-marker',
        html: userHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      L.marker([userLocation.lat, userLocation.lon], { icon: userIcon, zIndexOffset: 1000 })
        .bindTooltip('<b>You are here</b><br>GPS Geolocation Active', { direction: 'top', offset: [0, -14] })
        .addTo(group);
    }

    // 2. Canonical Heritage Craft Clusters Markers
    filteredClusters.forEach((cluster) => {
      const isSelected = activeCluster?.id === cluster.id;
      const clusterHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; cursor:pointer;">
          <div style="position:relative; width:${isSelected ? '32px' : '26px'}; height:${isSelected ? '32px' : '26px'}; display:flex; align-items:center; justify-content:center;">
            ${isSelected ? '<div style="position:absolute; width:36px; height:36px; border-radius:50%; background:#A6533B; opacity:0.3; animation: pulse 2s infinite;"></div>' : ''}
            <div style="width:${isSelected ? '24px' : '20px'}; height:${isSelected ? '24px' : '20px'}; border-radius:50%; background:${isSelected ? '#8C3F2B' : '#A6533B'}; border:2.5px solid #FFFFFF; box-shadow:0 3px 8px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center;">
              <div style="width:6px; height:6px; border-radius:50%; background:#FFFFFF;"></div>
            </div>
          </div>
          <div style="margin-top:2px; background:${isSelected ? '#1C1C1C' : 'rgba(255,255,255,0.92)'}; color:${isSelected ? '#FFFFFF' : '#1C1C1C'}; font-size:10px; font-weight:700; padding:1px 6px; border-radius:6px; border:1px solid ${isSelected ? '#A6533B' : '#D1C7BA'}; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.15);">
            ${cluster.name}
          </div>
        </div>
      `;

      const clusterIcon = L.divIcon({
        className: 'craft-cluster-pin',
        html: clusterHtml,
        iconSize: [80, 50],
        iconAnchor: [40, 20]
      });

      const marker = L.marker([cluster.latitude, cluster.longitude], { icon: clusterIcon, zIndexOffset: isSelected ? 800 : 500 })
        .addTo(group);

      marker.on('click', () => {
        setActiveCluster(cluster);
        setSelectedArtisanId(null);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([cluster.latitude, cluster.longitude], 9, { duration: 1.2 });
        }
      });
    });

    // 3. Live Master Artisan Pins
    filteredPins.forEach((artisan) => {
      if (!artisan.latitude || !artisan.longitude) return;
      const artisanHtml = `
        <div style="display:flex; align-items:center; cursor:pointer;" title="${artisan.artisan_name}">
          <div style="width:20px; height:20px; border-radius:50%; background:#10B981; border:2px solid #FFFFFF; box-shadow:0 2px 6px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">
            <div style="width:6px; height:6px; border-radius:50%; background:#FFFFFF;"></div>
          </div>
        </div>
      `;
      const artisanIcon = L.divIcon({
        className: 'live-artisan-pin',
        html: artisanHtml,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([artisan.latitude, artisan.longitude], { icon: artisanIcon, zIndexOffset: 700 })
        .bindTooltip(`<b>${artisan.artisan_name}</b><br>${artisan.craft || 'Master Craftsman'}`, { direction: 'top', offset: [0, -10] })
        .addTo(group);

      marker.on('click', () => {
        setSelectedArtisanId(artisan.artisan_id);
      });
    });
  }, [filteredClusters, filteredPins, userLocation, activeCluster]);

  // Fly to active cluster when selected from external buttons
  const handleSelectClusterAndFly = (cluster) => {
    setActiveCluster(cluster);
    setSelectedArtisanId(null);
    if (mapInstanceRef.current && cluster.latitude && cluster.longitude) {
      mapInstanceRef.current.flyTo([cluster.latitude, cluster.longitude], 9, { duration: 1.2 });
    }
  };

  // Zoom helpers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };
  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([21.5, 79.5], 5, { duration: 1.2 });
    }
  };

  // Active cluster distance from user
  const activeClusterDistance = useMemo(() => {
    if (!userLocation || !activeCluster) return null;
    return getHaversineDistanceKm(
      userLocation.lat,
      userLocation.lon,
      activeCluster.latitude,
      activeCluster.longitude
    );
  }, [userLocation, activeCluster]);

  // Active cluster's associated artisan pins
  const clusterArtisans = useMemo(() => {
    if (!activeCluster) return [];
    return artisanPins.filter(pin => 
      (pin.cluster_id && pin.cluster_id === activeCluster.id) ||
      (pin.craft_cluster && pin.craft_cluster.toLowerCase() === activeCluster.name.toLowerCase()) ||
      (pin.state === activeCluster.state && pin.district === activeCluster.district)
    );
  }, [artisanPins, activeCluster]);

  // Add to Bag helper
  const handleAddToBag = (product) => {
    try {
      const raw = localStorage.getItem('artisan_ai_cart');
      const items = raw ? JSON.parse(raw) : [];
      const existing = items.find(i => i.id === product.id);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
        items.push({
          id: product.id,
          title: product.title,
          price: product.price,
          image_url: product.image_url,
          artisan_name: product.artisan_name || activeCluster?.name,
          quantity: 1
        });
      }
      localStorage.setItem('artisan_ai_cart', JSON.stringify(items));
      window.dispatchEvent(new Event('artisan_cart_updated'));
      notify.success(`Added "${product.title}" to your Bag!`);
    } catch (e) {
      notify.error('Could not add to bag');
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#8C3F2B]/10 text-[#8C3F2B] text-xs font-bold tracking-wider uppercase">
              <Compass className="w-3.5 h-3.5" />
              <span>Real-Time Craft Clusters & Master Artisans</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1C1C1C] tracking-tight">
              Interactive Heritage Craft Map of India
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 font-medium leading-relaxed">
              Explore authentic regional craft traditions on a live, interactive map of India.
              Discover master artisans at their real-world GPS studio coordinates across Geographical Indication (GI) heritage clusters.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <button
              onClick={handleDetectUserLocation}
              disabled={detectingGps}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-[#E8E2D9] text-[#1C1C1C] hover:border-[#A6533B] font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Detect your location to find nearest craft clusters"
            >
              <LocateFixed className={`w-4 h-4 text-[#A6533B] ${detectingGps ? 'animate-spin' : ''}`} />
              <span>{detectingGps ? 'Detecting GPS...' : userLocation ? '📍 Location Active' : 'Find Crafts Near Me'}</span>
            </button>

            <button
              onClick={() => onSelectMode && onSelectMode('BUY')}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#A6533B] hover:bg-[#8C3F2B] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Browse Catalog</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E8E2D9] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cluster (e.g. Srikalahasti, Jaipur, Pochampally, Bidar)..."
              className="w-full bg-[#FAF7F2] text-xs text-[#1C1C1C] pl-10 pr-9 py-2.5 rounded-xl border border-[#E8E2D9] focus:outline-none focus:border-[#A6533B] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* State Filter Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-bold text-stone-500 whitespace-nowrap">State:</span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-[#FAF7F2] text-xs font-semibold text-[#1C1C1C] px-3 py-2 rounded-xl border border-[#E8E2D9] focus:outline-none focus:border-[#A6533B] cursor-pointer"
            >
              {availableStates.map(st => (
                <option key={st} value={st}>{st === 'All' ? 'All States (భారతదేశం)' : st}</option>
              ))}
            </select>
          </div>

          {/* Craft Filter Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-bold text-stone-500 whitespace-nowrap">Craft:</span>
            <select
              value={selectedCraft}
              onChange={(e) => setSelectedCraft(e.target.value)}
              className="bg-[#FAF7F2] text-xs font-semibold text-[#1C1C1C] px-3 py-2 rounded-xl border border-[#E8E2D9] focus:outline-none focus:border-[#A6533B] cursor-pointer"
            >
              {availableCrafts.map(cr => (
                <option key={cr} value={cr}>{cr === 'All' ? 'All Heritage Crafts' : cr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Cluster Badges */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
          <span className="text-[11px] font-bold text-stone-400 shrink-0 uppercase tracking-wider">
            Popular Clusters:
          </span>
          {clusters.slice(0, 10).map(c => {
            const isSelected = activeCluster?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handleSelectClusterAndFly(c)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap font-bold transition-all cursor-pointer border text-[11px] flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-[#A6533B] text-white border-[#A6533B] shadow-xs'
                    : 'bg-[#FAF7F2] text-[#1C1C1C] border-[#E8E2D9] hover:border-[#A6533B]'
                }`}
              >
                <span>{c.name}</span>
                <span className={`text-[9px] px-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'}`}>
                  {c.state.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Real Map & Details Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Interactive Leaflet Map Canvas (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E8E2D9] p-4 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-2">
              <Compass className="w-5 h-5 text-[#A6533B]" />
              <h2 className="text-sm sm:text-base font-bold text-[#1C1C1C]">
                Real Heritage Craft Clusters Map
              </h2>
            </div>

            <div className="flex items-center space-x-2 text-[11px]">
              {/* Tile Style Picker */}
              <div className="flex items-center bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl p-0.5">
                <button
                  onClick={() => setActiveTileType('VOYAGER')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTileType === 'VOYAGER' ? 'bg-white text-[#A6533B] shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Heritage
                </button>
                <button
                  onClick={() => setActiveTileType('OSM')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTileType === 'OSM' ? 'bg-white text-[#A6533B] shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Street
                </button>
                <button
                  onClick={() => setActiveTileType('SATELLITE')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTileType === 'SATELLITE' ? 'bg-white text-[#A6533B] shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Satellite
                </button>
              </div>

              {/* Legend */}
              <span className="hidden sm:flex items-center space-x-1 text-stone-500 font-medium pl-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#A6533B] inline-block"></span>
                <span>Cluster</span>
              </span>
              <span className="hidden sm:flex items-center space-x-1 text-stone-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Artisan</span>
              </span>
            </div>
          </div>

          {/* Leaflet Map DOM Element */}
          <div className="relative w-full rounded-2xl overflow-hidden border border-[#E8E2D9] shadow-inner" style={{ height: '580px' }}>
            <div 
              ref={mapContainerRef} 
              className="w-full h-full z-10"
              style={{ background: '#F5EFE6' }}
            />

            {/* Custom Map Floating Controls */}
            <div className="absolute top-3 right-3 z-[400] flex flex-col space-y-1.5">
              <button
                onClick={handleZoomIn}
                className="w-9 h-9 bg-white/95 hover:bg-white rounded-xl shadow-md border border-[#E8E2D9] flex items-center justify-center text-[#1C1C1C] hover:text-[#A6533B] transition-all cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="w-9 h-9 bg-white/95 hover:bg-white rounded-xl shadow-md border border-[#E8E2D9] flex items-center justify-center text-[#1C1C1C] hover:text-[#A6533B] transition-all cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetView}
                className="w-9 h-9 bg-white/95 hover:bg-white rounded-xl shadow-md border border-[#E8E2D9] flex items-center justify-center text-[#1C1C1C] hover:text-[#A6533B] transition-all cursor-pointer"
                title="Reset All-India View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Floating Live Metrics Capsule */}
            <div className="absolute bottom-3 left-3 right-3 z-[400] bg-white/92 backdrop-blur-md border border-[#E8E2D9] px-3.5 py-2 rounded-xl flex items-center justify-between text-xs text-[#1C1C1C] shadow-sm">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold">
                  {filteredClusters.length} GI Heritage Clusters & {filteredPins.length} Active Master Artisans
                </span>
              </div>
              <span className="text-[11px] text-stone-500 hidden sm:inline">
                Real GPS Coordinates • Drag, zoom & tap pins
              </span>
            </div>
          </div>
        </div>

        {/* Right: Cluster & Master Artisan Showcase Drawer (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          {activeCluster ? (
            <div className="bg-white rounded-3xl border border-[#E8E2D9] p-6 shadow-xs space-y-6">
              {/* Cluster Title Header */}
              <div className="border-b border-[#E8E2D9] pb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3 text-amber-700" />
                    <span>GI Registered Heritage Cluster</span>
                  </span>

                  {activeClusterDistance !== null && (
                    <span className="text-[11px] font-bold text-[#A6533B] bg-[#FAF7F2] px-2.5 py-1 rounded-lg border border-[#E8E2D9]">
                      📍 {activeClusterDistance} km from you
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-[#1C1C1C] tracking-tight">
                      {activeCluster.name}
                    </h2>
                    <p className="text-xs text-[#6B6B6B] flex items-center mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-[#A6533B] mr-1 shrink-0" />
                      {activeCluster.district}, {activeCluster.state}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-[#A6533B] block">
                      {activeCluster.canonical_craft}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {activeCluster.latitude.toFixed(4)}°N, {activeCluster.longitude.toFixed(4)}°E
                    </span>
                  </div>
                </div>
              </div>

              {/* Cluster History & Significance */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-[#A6533B]" />
                  <span>Heritage Background & Materials</span>
                </h3>
                <p className="text-xs text-stone-700 leading-relaxed bg-[#FAF7F2] p-3.5 rounded-xl border border-[#E8E2D9]">
                  {activeCluster.historical_summary}
                </p>
                <div className="flex items-center justify-between text-[11px] text-stone-600 px-1 pt-1">
                  <span>Materials: <strong>{activeCluster.materials}</strong></span>
                  <span>GI Status: <strong>{activeCluster.gi_status ? 'Certified GI' : 'Heritage Legacy'}</strong></span>
                </div>
              </div>

              {/* Master Artisans from this specific cluster */}
              <div className="space-y-3 pt-2 border-t border-[#E8E2D9]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#1C1C1C] uppercase tracking-wider flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Master Artisans in this Cluster ({clusterArtisans.length})</span>
                  </h3>
                </div>

                {clusterArtisans.length > 0 ? (
                  <div className="space-y-3">
                    {clusterArtisans.map((artisan) => (
                      <div
                        key={artisan.artisan_id}
                        className="bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl p-4 space-y-3 hover:border-[#A6533B] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-[#1C1C1C] text-white flex items-center justify-center font-bold text-sm shrink-0">
                              {artisan.artisan_name ? artisan.artisan_name.charAt(0) : 'A'}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <h4 className="font-bold text-xs text-[#1C1C1C]">{artisan.artisan_name}</h4>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                              <p className="text-[10px] text-stone-500">{artisan.craft || activeCluster.canonical_craft}</p>
                              {artisan.latitude && artisan.longitude && (
                                <p className="text-[9px] text-stone-400 font-mono">
                                  Studio: {artisan.latitude.toFixed(4)}°N, {artisan.longitude.toFixed(4)}°E
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedArtisanId(artisan.artisan_id)}
                            className="px-3 py-1.5 rounded-lg bg-white border border-[#E8E2D9] hover:border-[#A6533B] text-[11px] font-bold text-[#1C1C1C] hover:text-[#A6533B] transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
                          >
                            <span>Studio</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Real Sample Products */}
                        {artisan.sample_products && artisan.sample_products.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-[#E8E2D9]/60">
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                              Available Creations ({artisan.sample_products.length})
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {artisan.sample_products.slice(0, 2).map((prod) => (
                                <div
                                  key={prod.id}
                                  className="bg-white border border-[#E8E2D9] rounded-xl p-2 space-y-1.5 flex flex-col justify-between"
                                >
                                  {prod.image_url ? (
                                    <img
                                      src={prod.image_url}
                                      alt={prod.title}
                                      className="w-full h-20 object-cover rounded-lg bg-stone-100"
                                    />
                                  ) : (
                                    <div className="w-full h-20 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-[10px]">
                                      Handcrafted
                                    </div>
                                  )}
                                  <div>
                                    <h5 className="font-bold text-[11px] text-[#1C1C1C] truncate">{prod.title}</h5>
                                    <span className="text-xs font-black text-[#A6533B]">₹{prod.price?.toLocaleString('en-IN')}</span>
                                  </div>
                                  <button
                                    onClick={() => handleAddToBag(prod)}
                                    className="w-full py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#A6533B] hover:text-white border border-[#E8E2D9] text-[10px] font-bold text-[#1C1C1C] transition-colors cursor-pointer flex items-center justify-center space-x-1"
                                  >
                                    <ShoppingBag className="w-3 h-3" />
                                    <span>Add to Bag</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#FAF7F2] border border-dashed border-[#E8E2D9] rounded-2xl p-6 text-center space-y-2">
                    <Store className="w-8 h-8 text-stone-400 mx-auto" />
                    <h4 className="font-bold text-xs text-[#1C1C1C]">Cluster Artisans Registering</h4>
                    <p className="text-[11px] text-stone-500 max-w-xs mx-auto leading-relaxed">
                      Master craftsmen from {activeCluster.name} are currently onboarding to the direct fair-trade network.
                    </p>
                    <button
                      onClick={() => onSelectMode && onSelectMode('BECOME_ARTISAN')}
                      className="mt-2 text-xs font-bold text-[#A6533B] hover:underline inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Are you a craftsman here? Register Studio</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-[#E8E2D9] p-8 text-center space-y-3">
              <Compass className="w-10 h-10 text-[#A6533B] mx-auto animate-pulse" />
              <h3 className="font-bold text-sm text-[#1C1C1C]">Select a Heritage Craft Cluster</h3>
              <p className="text-xs text-stone-500 leading-relaxed max-w-sm mx-auto">
                Click any craft cluster pin or live artisan node on the Indian map to view regional craft history and verified artisans.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Artisan Profile Modal Dialog if selected */}
      {selectedArtisanId && (
        <ArtisanProfileModal
          artisanId={selectedArtisanId}
          onClose={() => setSelectedArtisanId(null)}
          onOpenAuth={onOpenAuth}
        />
      )}
    </div>
  );
}
