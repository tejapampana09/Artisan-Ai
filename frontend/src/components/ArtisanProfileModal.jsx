import React, { useState, useEffect } from 'react';
import { X, MapPin, Star, Edit3 } from 'lucide-react';
import { getArtisanProfile, updateArtisanProfile } from '../api/trust.js';
import { useNotification } from '../context/NotificationContext.jsx';

export default function ArtisanProfileModal({ artisanId, isOpen, onClose, currentUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    bio: '',
    craft_specialization: '',
    experience_years: 18,
    location: ''
  });
  const { addNotification } = useNotification();

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await getArtisanProfile(artisanId);
      setProfile(data);
      setEditForm({
        bio: data.bio || '',
        craft_specialization: data.craft_specialization || data.craft || 'Wood carving',
        experience_years: data.experience_years || 18,
        location: data.location || 'Kondapalli, Andhra Pradesh'
      });
    } catch (err) {
      console.error('Failed to load artisan profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && artisanId) {
      fetchProfile();
    }
  }, [isOpen, artisanId]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const updated = await updateArtisanProfile(editForm);
      setProfile(updated);
      setIsEditing(false);
      addNotification('Profile updated successfully!', 'success');
    } catch (err) {
      addNotification('Failed to update profile: ' + (err.message || 'Error'), 'error');
    }
  };

  if (!isOpen) return null;

  const isSelf = currentUser && profile && currentUser.id === profile.id;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-[#E7E7E2] relative overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#666666] hover:text-[#171717] rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#666666]">
            Loading Artisan Story...
          </div>
        ) : (
          <div className="space-y-6 text-left">
            {/* Screen 12 Header */}
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-[#171717]">Your Craft Story</h2>
            </div>

            {/* Profile Info */}
            <div className="flex items-center gap-4 bg-[#FAFAF7] p-5 rounded-2xl border border-[#E7E7E2]">
              <div className="w-16 h-16 rounded-full bg-[#176B4D] text-white font-extrabold text-2xl flex items-center justify-center shrink-0">
                R
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#171717]">{profile?.name || 'Ravi Kumar'}</h3>
                <p className="text-xs font-semibold text-[#176B4D]">Master Artisan</p>
                <div className="flex items-center text-xs text-[#666666]">
                  <MapPin className="w-3.5 h-3.5 text-[#176B4D] mr-1" />
                  <span>{profile?.location || 'Kondapalli, Andhra Pradesh'}</span>
                </div>
              </div>
            </div>

            {/* Screen 12 Stats Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#FAFAF7] p-4 rounded-2xl border border-[#E7E7E2]">
                <span className="text-xl font-extrabold text-[#171717] block">18</span>
                <span className="text-[11px] text-[#666666] font-medium">Years Experience</span>
              </div>
              <div className="bg-[#FAFAF7] p-4 rounded-2xl border border-[#E7E7E2]">
                <span className="text-xl font-extrabold text-[#171717] block">120+</span>
                <span className="text-[11px] text-[#666666] font-medium">Products</span>
              </div>
              <div className="bg-[#FAFAF7] p-4 rounded-2xl border border-[#E7E7E2]">
                <div className="flex items-center justify-center gap-1 text-xl font-extrabold text-[#171717]">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>4.8</span>
                </div>
                <span className="text-[11px] text-[#666666] font-medium">Rating</span>
              </div>
            </div>

            {/* Craft & Languages */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-[#FAFAF7] p-4 rounded-2xl border border-[#E7E7E2]">
                <span className="text-[#666666] block font-medium">Craft</span>
                <span className="font-bold text-[#171717] text-sm mt-0.5 block">
                  {profile?.craft_specialization || 'Wood carving'}
                </span>
              </div>

              <div className="bg-[#FAFAF7] p-4 rounded-2xl border border-[#E7E7E2]">
                <span className="text-[#666666] block font-medium">Languages</span>
                <span className="font-bold text-[#171717] text-sm mt-0.5 block">
                  Telugu · Hindi
                </span>
              </div>
            </div>

            {/* Story Prose */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#666666]">Story</h4>
              <p className="text-xs text-[#171717] leading-relaxed bg-[#FAFAF7] p-4 rounded-2xl border border-[#E7E7E2]">
                "{profile?.bio || 'I learned this craft from my father. It has been our family tradition for generations. I want to share our art with the world...'}"
              </p>
            </div>

            {/* Edit Profile CTA */}
            <div className="pt-2">
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-3 bg-[#FAFAF7] hover:bg-stone-100 text-[#171717] font-semibold text-xs rounded-2xl border border-[#E7E7E2] transition-all flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4 text-[#176B4D]" />
                <span>Edit Profile</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
