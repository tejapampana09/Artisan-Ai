import React, { useState, useEffect } from 'react';
import { X, Award, MapPin, CheckCircle2, Star, Sparkles, Shield, User, Edit3 } from 'lucide-react';
import { getArtisanProfile, updateArtisanProfile } from '../api/trust.js';
import { useNotification } from '../context/NotificationContext.jsx';

export default function ArtisanProfileModal({ artisanId, isOpen, onClose, currentUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    bio: '',
    craft_specialization: '',
    experience_years: 5,
    location: ''
  });
  const { addNotification } = useNotification();

  useEffect(() => {
    if (isOpen && artisanId) {
      fetchProfile();
    }
  }, [isOpen, artisanId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await getArtisanProfile(artisanId);
      setProfile(data);
      setEditForm({
        bio: data.bio || '',
        craft_specialization: data.craft_specialization || data.craft || '',
        experience_years: data.experience_years || 5,
        location: data.location || ''
      });
    } catch (err) {
      console.error('Failed to load artisan profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const updated = await updateArtisanProfile(editForm);
      setProfile(updated);
      setIsEditing(false);
      addNotification('Artisan Profile updated successfully! ✨', 'success');
    } catch (err) {
      addNotification('Failed to update profile: ' + (err.message || 'Error'), 'error');
    }
  };

  if (!isOpen) return null;

  const isSelf = currentUser && profile && currentUser.id === profile.id;

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Top Decorative Banner */}
        <div className="h-24 -mx-6 -mt-6 bg-gradient-to-r from-amber-800 via-orange-700 to-amber-900 p-4 flex justify-between items-start">
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-200 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-500/40">
            Master Artisan Digital Card
          </span>
          <button
            onClick={onClose}
            className="p-1.5 bg-amber-950/40 text-amber-200 hover:text-white rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 font-medium text-xs">
            Loading Artisan Profile...
          </div>
        ) : profile ? (
          <div className="space-y-5 -mt-10 relative">
            {/* Avatar & Header */}
            <div className="flex items-end justify-between">
              <div className="flex items-end space-x-4">
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-20 h-20 rounded-2xl border-4 border-white shadow-xl bg-amber-50 object-cover"
                />
                <div className="pb-1">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-bold text-slate-900">{profile.name}</h2>
                    {profile.verification_status === 'VERIFIED_ARTISAN' ? (
                      <span className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200" title="Verified Govt/GI Heritage Artisan">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Verified Artisan
                      </span>
                    ) : profile.verification_status === 'PROFILE_COMPLETE' ? (
                      <span className="flex items-center text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200" title="Profile Complete">
                        <Shield className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                        Profile Complete
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        Unverified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium flex items-center mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 mr-1" />
                    <span>{profile.location}</span>
                  </p>
                </div>
              </div>

              {isSelf && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-300 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Craft Specialization</span>
                <span className="font-bold text-slate-900 truncate block">{profile.craft_specialization}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Craft Experience</span>
                <span className="font-bold text-amber-700 block">{profile.experience_years} Years</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Artisan Rating</span>
                <span className="font-bold text-slate-900 flex items-center justify-center space-x-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                  <span>{profile.average_rating > 0 ? profile.average_rating : 'New'}</span>
                </span>
              </div>
            </div>

            {/* Edit Mode Form */}
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Craft Specialization</label>
                  <input
                    type="text"
                    value={editForm.craft_specialization}
                    onChange={(e) => setEditForm({ ...editForm, craft_specialization: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Location / Cluster</label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Years of Experience</label>
                    <input
                      type="number"
                      value={editForm.experience_years}
                      onChange={(e) => setEditForm({ ...editForm, experience_years: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                      min="0"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Artisan Bio & Heritage Legacy</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs h-24"
                    placeholder="Describe your craft heritage, master technique, materials used..."
                    required
                  />
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-amber-600 text-white font-bold rounded-xl shadow-md"
                  >
                    Save Profile
                  </button>
                </div>
              </form>
            ) : (
              /* View Mode */
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-800 flex items-center space-x-1 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Heritage Story & Master Bio</span>
                  </span>
                  <p className="text-slate-600 leading-relaxed bg-amber-50/40 p-3 rounded-2xl border border-amber-200/60">
                    {profile.bio}
                  </p>
                </div>

                <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-amber-400 font-bold block">Artisan Portfolio</span>
                    <span className="text-slate-300 text-[11px]">{profile.total_products_count} GI verified handicraft items listed</span>
                  </div>
                  <Award className="w-6 h-6 text-amber-400 shrink-0" />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
