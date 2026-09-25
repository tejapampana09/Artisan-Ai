import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, MapPin, Award, ShieldCheck, CheckCircle2, 
  LogOut, Store, Sparkles, Edit3, Globe, Smartphone, ChevronRight, PlusCircle, X, Save,
  Compass, Navigation, LocateFixed, Loader2
} from 'lucide-react';
import { logoutUser, updateUserProfile, fetchCraftClusters, updateArtisanStudioLocation } from '../api/index.js';
import { setStoredUser } from '../services/offlineSync.js';
import { useNotification } from '../context/NotificationContext';

export default function ProfileView({ user, onSelectMode, onAuthChange }) {
  const notify = useNotification();
  const isArtisan = user?.role === 'ARTISAN';

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Studio Geolocation & Clusters State
  const [clusters, setClusters] = useState([]);
  const [detectingGps, setDetectingGps] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({
    craft_cluster: user?.craft_cluster || '',
    latitude: user?.latitude || '',
    longitude: user?.longitude || '',
    state: user?.state || '',
    district: user?.district || '',
    pincode: user?.pincode || ''
  });

  const [form, setForm] = useState({
    name: '',
    phone: '',
    location: '',
    craft: '',
    craft_specialization: '',
    experience_years: 15,
    bio: ''
  });

  useEffect(() => {
    if (isArtisan) {
      fetchCraftClusters().then(data => {
        if (data) setClusters(data);
      });
    }
  }, [isArtisan]);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        location: user.location || '',
        craft: user.craft || '',
        craft_specialization: user.craft_specialization || '',
        experience_years: user.experience_years !== undefined && user.experience_years !== null ? user.experience_years : 15,
        bio: user.bio || ''
      });
      setLocationForm({
        craft_cluster: user.craft_cluster || '',
        latitude: user.latitude !== undefined && user.latitude !== null ? user.latitude : '',
        longitude: user.longitude !== undefined && user.longitude !== null ? user.longitude : '',
        state: user.state || '',
        district: user.district || '',
        pincode: user.pincode || ''
      });
    }
  }, [user]);

  const handleSelectCluster = (clusterName) => {
    const selected = clusters.find(c => c.name === clusterName);
    if (selected) {
      setLocationForm(prev => ({
        ...prev,
        craft_cluster: selected.name,
        latitude: selected.latitude,
        longitude: selected.longitude,
        state: selected.state,
        district: selected.district
      }));
    } else {
      setLocationForm(prev => ({ ...prev, craft_cluster: clusterName }));
    }
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      notify.error('Geolocation is not supported by your browser');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const lat = parseFloat(latitude.toFixed(6));
        const lng = parseFloat(longitude.toFixed(6));

        let detectedState = '';
        let detectedDistrict = '';
        let detectedPincode = '';

        // 1. High-accuracy OpenStreetMap Nominatim reverse geocode
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
            { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(4000) }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            detectedState = addr.state || '';
            detectedDistrict = addr.state_district || addr.county || addr.district || addr.city || addr.town || addr.village || '';
            detectedPincode = addr.postcode || '';
          }
        } catch {
          // Fallback to BigDataCloud client reverse geocode
          try {
            const bdcRes = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
              { signal: AbortSignal.timeout(4000) }
            );
            if (bdcRes.ok) {
              const bdcData = await bdcRes.json();
              detectedState = detectedState || bdcData.principalSubdivision || '';
              detectedDistrict = detectedDistrict || bdcData.city || bdcData.locality || '';
              detectedPincode = detectedPincode || bdcData.postcode || '';
            }
          } catch {}
        }

        // 2. Auto-match nearest canonical heritage craft cluster
        let closestClusterName = locationForm.craft_cluster;
        if (clusters && clusters.length > 0) {
          const haversineDist = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Earth radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          };

          let bestCluster = null;
          let minDistance = Infinity;
          for (const c of clusters) {
            if (c.latitude && c.longitude) {
              const d = haversineDist(lat, lng, c.latitude, c.longitude);
              if (d < minDistance) {
                minDistance = d;
                bestCluster = c;
              }
            }
          }

          if (bestCluster && (!locationForm.craft_cluster || minDistance < 150)) {
            closestClusterName = bestCluster.name;
          }
        }

        setLocationForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          state: detectedState || prev.state,
          district: detectedDistrict || prev.district,
          pincode: detectedPincode || prev.pincode,
          craft_cluster: closestClusterName || prev.craft_cluster
        }));

        setDetectingGps(false);
        const locationDetails = [detectedDistrict, detectedState, detectedPincode].filter(Boolean).join(', ');
        notify.success(
          locationDetails 
            ? `Location & Cluster auto-filled: ${locationDetails} (${lat}°N, ${lng}°E)` 
            : `GPS Location detected: ${lat}° N, ${lng}° E`
        );
      },
      (err) => {
        setDetectingGps(false);
        notify.warning('Could not retrieve GPS location. Please allow browser location access.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveLocation = async (e) => {
    e?.preventDefault();
    if (!locationForm.latitude || !locationForm.longitude) {
      notify.warning('Please provide latitude and longitude or detect GPS');
      return;
    }
    setSavingLocation(true);
    try {
      const updated = await updateArtisanStudioLocation({
        latitude: parseFloat(locationForm.latitude),
        longitude: parseFloat(locationForm.longitude),
        craft_cluster: locationForm.craft_cluster || undefined,
        state: locationForm.state || undefined,
        district: locationForm.district || undefined,
        pincode: locationForm.pincode || undefined
      });
      if (updated) {
        const mergedUser = {
          ...user,
          ...updated,
          role: updated.role || user?.role || 'ARTISAN',
          location: updated.location || [locationForm.district, locationForm.state, locationForm.pincode].filter(Boolean).join(', ')
        };
        setStoredUser(mergedUser, mergedUser.role);
        setForm(prev => ({
          ...prev,
          location: mergedUser.location || prev.location
        }));
        if (onAuthChange) {
          onAuthChange(mergedUser);
        }
        notify.success('Studio location and profile info updated!');
      }
    } catch (err) {
      notify.error(err.message || 'Failed to save location');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSignOut = () => {
    logoutUser();
    onAuthChange(null);
    onSelectMode('HOME');
    notify.success('Signed out cleanly');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateUserProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        craft: form.craft.trim(),
        craft_specialization: form.craft_specialization.trim(),
        experience_years: form.experience_years !== undefined ? parseInt(form.experience_years, 10) : undefined,
        bio: form.bio.trim()
      });

      if (updated) {
        const mergedUser = {
          ...user,
          ...updated,
          role: updated.role || user?.role || 'ARTISAN'
        };
        setStoredUser(mergedUser, mergedUser.role);
        onAuthChange(mergedUser);
        notify.success('Profile updated successfully!');
        setIsEditing(false);
      }
    } catch (err) {
      notify.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 font-sans">
      {/* Profile Header Banner */}
      <div className="bg-gradient-to-r from-[#1C1C1C] via-[#2A1E17] to-[#A6533B] text-white rounded-2xl p-6 sm:p-8 shadow-md border border-[#E8E2D9] relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl sm:text-3xl font-black text-white shadow-inner shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-3xl font-bold tracking-tight">{user?.name || 'Artisan AI Creator'}</h1>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  {user?.role || 'BUYER'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-300 mt-1">{user?.email || user?.phone || 'Authentic Marketplace User'}</p>
              {isArtisan && (
                <span className="inline-flex items-center text-xs font-semibold text-emerald-300 bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-400/40 mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  Verified Master Artisan
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs border border-white/30 transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Account Details & Verification Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details */}
        <div className="bg-white rounded-2xl border border-[#E8E2D9] p-6 space-y-4 shadow-2xs">
          <div className="border-b border-[#E8E2D9] pb-3 flex justify-between items-center">
            <h2 className="font-bold text-base text-[#1C1C1C] flex items-center space-x-2">
              <User className="w-4 h-4 text-[#A6533B]" />
              <span>Personal Information</span>
            </h2>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-[#A6533B] hover:text-[#8C432E] inline-flex items-center space-x-1 cursor-pointer bg-[#FAF7F2] px-2.5 py-1 rounded-lg border border-[#E8E2D9]"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#6B6B6B] block">Full Name</span>
              <span className="font-bold text-[#1C1C1C]">{user?.name || 'Not provided'}</span>
            </div>
            <div>
              <span className="text-[#6B6B6B] block">Email Address</span>
              <span className="font-bold text-[#1C1C1C]">{user?.email || 'Not provided'}</span>
            </div>
            <div>
              <span className="text-[#6B6B6B] block">Phone Number</span>
              {user?.phone ? (
                <span className="font-bold text-[#1C1C1C]">{user.phone}</span>
              ) : (
                <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                  Not provided — Click edit to add phone
                </span>
              )}
            </div>
            <div>
              <span className="text-[#6B6B6B] block">Location / Delivery Address</span>
              <span className="font-bold text-[#1C1C1C] flex items-center mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#A6533B] mr-1 shrink-0" />
                {user?.location ? (
                  <span>{user.location}</span>
                ) : (
                  <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                    Not provided — Click edit to add address
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Heritage Credentials / Buyer Badges */}
        <div className="bg-white rounded-2xl border border-[#E8E2D9] p-6 space-y-4 shadow-2xs">
          <div className="border-b border-[#E8E2D9] pb-3 flex justify-between items-center">
            <h2 className="font-bold text-base text-[#1C1C1C] flex items-center space-x-2">
              <Award className="w-4 h-4 text-[#A6533B]" />
              <span>{isArtisan ? 'Traditional Heritage Credentials' : 'Direct Fair Trade Supporter'}</span>
            </h2>
            {isArtisan && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs font-bold text-[#A6533B] hover:text-[#8C432E] inline-flex items-center space-x-1 cursor-pointer bg-[#FAF7F2] px-2.5 py-1 rounded-lg border border-[#E8E2D9]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
          </div>

          <div className="space-y-3 text-xs">
            {isArtisan ? (
              <>
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8E2D9]">
                  <span className="text-[10px] font-bold text-[#A6533B] uppercase flex items-center justify-between">
                    <span>Heritage Craft Cluster / హస్తకళ క్లస్టర్</span>
                    {user?.craft_cluster && (
                      <span className="bg-amber-100 text-[#A6533B] text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300">
                        GI Registered Cluster
                      </span>
                    )}
                  </span>
                  <span className="font-bold text-[#1C1C1C] text-sm block mt-0.5">
                    {user?.craft_cluster 
                      ? `${user.craft_cluster} (${user.state || 'India'})` 
                      : (user?.location || 'Not assigned yet — Detect GPS or select below')}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8E2D9]">
                  <span className="text-[10px] font-bold text-[#A6533B] uppercase block">Specialization / నైపుణ్యం</span>
                  <span className="font-bold text-[#1C1C1C] text-sm block mt-0.5">
                    {user?.craft_specialization && user.craft_specialization !== 'Connoisseur Collection'
                      ? user.craft_specialization
                      : (user?.craft && user.craft !== 'Connoisseur Collection' 
                          ? user.craft 
                          : 'Not specified — click Edit to add')}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8E2D9] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#A6533B] uppercase block">Craft Experience / అనుభవం</span>
                    <span className="font-bold text-[#1C1C1C] text-sm block mt-0.5">
                      {user?.experience_years ? `${user.experience_years} Years Master Tradition` : 'Not specified — click Edit to add'}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    user?.verification_status === 'VERIFIED_ARTISAN' || user?.verification_status === 'GI_VERIFIED'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-stone-100 text-stone-700 border-stone-300'
                  }`}>
                    {user?.verification_status === 'VERIFIED_ARTISAN' ? 'Verified Master' : (user?.verification_status || 'Registered Artisan')}
                  </span>
                </div>
              </>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200/60 space-y-2 text-[#1C1C1C]">
                <span className="font-bold block text-sm">Protected Fair-Trade Buyer</span>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Every order you place protects rural Indian craftspeople with a minimum 20% profit margin floor and zero middleman cuts.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Studio Geolocation & Craft Cluster (For Verified Artisans) */}
      {isArtisan && (
        <div className="bg-white rounded-2xl border border-[#E8E2D9] p-6 space-y-5 shadow-2xs">
          <div className="border-b border-[#E8E2D9] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Compass className="w-5 h-5 text-[#A6533B]" />
                <h2 className="font-bold text-base text-[#1C1C1C]">
                  Studio Geolocation & Heritage Craft Cluster / వర్క్‌షాప్ స్థానం
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Your coordinates power your real-time pin on the Interactive Craft Map of India.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={detectingGps}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#A6533B] border border-amber-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <LocateFixed className={`w-3.5 h-3.5 ${detectingGps ? 'animate-spin' : ''}`} />
                <span>{detectingGps ? 'Detecting GPS...' : '📍 Detect Current Location (GPS)'}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectMode('CRAFT_MAP')}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-stone-100 text-[#1C1C1C] border border-[#E8E2D9] font-bold text-xs transition-colors cursor-pointer"
              >
                <span>View on Map</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveLocation} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              {/* Canonical Cluster Selector */}
              <div>
                <label className="block font-bold text-[#1C1C1C] mb-1">
                  Heritage Craft Cluster / హస్తకళ క్లస్టర్
                </label>
                <select
                  value={locationForm.craft_cluster}
                  onChange={(e) => handleSelectCluster(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] focus:outline-none focus:border-[#A6533B] font-medium"
                >
                  <option value="">Select or Custom Cluster</option>
                  {clusters.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.state})
                    </option>
                  ))}
                </select>
              </div>

              {/* Latitude */}
              <div>
                <label className="block font-bold text-[#1C1C1C] mb-1">Latitude (° N)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 13.7498"
                  value={locationForm.latitude}
                  onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                />
              </div>

              {/* Longitude */}
              <div>
                <label className="block font-bold text-[#1C1C1C] mb-1">Longitude (° E)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 79.6984"
                  value={locationForm.longitude}
                  onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                />
              </div>

              {/* District */}
              <div>
                <label className="block font-bold text-[#1C1C1C] mb-1">District / జిల్లా</label>
                <input
                  type="text"
                  placeholder="e.g. Tirupati"
                  value={locationForm.district}
                  onChange={(e) => setLocationForm({ ...locationForm, district: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                />
              </div>

              {/* State */}
              <div>
                <label className="block font-bold text-[#1C1C1C] mb-1">State / రాష్ట్రం</label>
                <input
                  type="text"
                  placeholder="e.g. Andhra Pradesh"
                  value={locationForm.state}
                  onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                />
              </div>

              {/* Pincode */}
              <div>
                <label className="block font-bold text-[#1C1C1C] mb-1">Pincode / పిన్‌కోడ్</label>
                <input
                  type="text"
                  placeholder="e.g. 517644"
                  value={locationForm.pincode}
                  onChange={(e) => setLocationForm({ ...locationForm, pincode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E8E2D9]">
              <div className="flex items-center space-x-1.5 text-xs text-stone-500">
                <span className={`w-2 h-2 rounded-full ${locationForm.latitude && locationForm.longitude ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                <span>
                  {locationForm.latitude && locationForm.longitude 
                    ? `Studio Active on Map (${parseFloat(locationForm.latitude).toFixed(3)}°N, ${parseFloat(locationForm.longitude).toFixed(3)}°E)` 
                    : 'Coordinates not yet saved'}
                </span>
              </div>

              <button
                type="submit"
                disabled={savingLocation}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-[#A6533B] hover:bg-[#8C3F2B] text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingLocation ? 'Saving Location...' : 'Save Studio Coordinates'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account Navigation Quick Links */}
      <div className="bg-white rounded-2xl border border-[#E8E2D9] p-6 space-y-4 shadow-2xs">
        <h2 className="font-bold text-base text-[#1C1C1C]">Quick Account Shortcuts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <button
            onClick={() => onSelectMode('ORDERS')}
            className="p-4 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl font-bold text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B] transition-all flex items-center justify-between cursor-pointer"
          >
            <span>My Orders & Sales</span>
            <ChevronRight className="w-4 h-4 text-[#A6533B]" />
          </button>
          <button
            onClick={() => onSelectMode('WISHLIST')}
            className="p-4 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl font-bold text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B] transition-all flex items-center justify-between cursor-pointer"
          >
            <span>Saved Wishlist</span>
            <ChevronRight className="w-4 h-4 text-[#A6533B]" />
          </button>
          <button
            onClick={() => onSelectMode('ENQUIRIES')}
            className="p-4 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl font-bold text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B] transition-all flex items-center justify-between cursor-pointer"
          >
            <span>Custom Enquiries</span>
            <ChevronRight className="w-4 h-4 text-[#A6533B]" />
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[110] bg-[#2A1E17]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FBF8F3] rounded-3xl max-w-lg w-full shadow-2xl border border-[#EADFCF] overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-6 border-b border-[#EADFCF] flex items-center justify-between bg-white">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-[#A6533B]" />
                <h3 className="font-serif font-bold text-xl text-[#2A1E17]">
                  Edit Profile / ప్రొఫైల్ ఎడిట్ చేయండి
                </h3>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#2A1E17] mb-1">Full Name / పేరు</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Teja Pampana"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#2A1E17] mb-1">Phone Number / ఫోన్ నంబర్</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#2A1E17] mb-1">Location / Delivery Address / అడ్రస్</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Visakhapatnam, Andhra Pradesh, India"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                />
              </div>

              {isArtisan && (
                <>
                  <div>
                    <label className="block font-bold text-[#2A1E17] mb-1">Craft Category / Specialization</label>
                    <input
                      type="text"
                      value={form.craft_specialization || form.craft}
                      onChange={(e) => setForm({ ...form, craft_specialization: e.target.value, craft: e.target.value })}
                      placeholder="e.g. Kalamkari Handloom Painting"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#2A1E17] mb-1">Bio / Artisan Craft Story</label>
                    <textarea
                      rows={3}
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      placeholder="Share your craft heritage and story..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D9] bg-white focus:outline-none focus:border-[#A6533B]"
                    />
                  </div>
                </>
              )}

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-[#EADFCF]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E8E2D9] text-[#6B5B51] font-semibold hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#933D1E] hover:bg-[#7A3218] text-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
