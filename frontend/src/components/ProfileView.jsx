import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, MapPin, Award, ShieldCheck, CheckCircle2, 
  LogOut, Store, Sparkles, Edit3, Globe, Smartphone, ChevronRight, PlusCircle, X, Save
} from 'lucide-react';
import { logoutUser, updateUserProfile } from '../api/index.js';
import { setStoredUser } from '../services/offlineSync.js';
import { useNotification } from '../context/NotificationContext';

export default function ProfileView({ user, onSelectMode, onAuthChange }) {
  const notify = useNotification();
  const isArtisan = user?.role === 'ARTISAN';

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    location: '',
    craft: '',
    craft_specialization: '',
    bio: ''
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        location: user.location || '',
        craft: user.craft || '',
        craft_specialization: user.craft_specialization || '',
        bio: user.bio || ''
      });
    }
  }, [user]);

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
        bio: form.bio.trim()
      });

      if (updated) {
        setStoredUser(updated, updated.role || 'BUYER');
        onAuthChange(updated);
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
          </div>

          <div className="space-y-3 text-xs">
            {isArtisan ? (
              <>
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8E2D9]">
                  <span className="text-[10px] font-bold text-[#A6533B] uppercase block">Specialization</span>
                  <span className="font-bold text-[#1C1C1C] text-sm">{user?.craft_specialization || user?.craft || 'Kalamkari & Handloom Painting'}</span>
                </div>
                <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8E2D9]">
                  <span className="text-[10px] font-bold text-[#A6533B] uppercase block">Craft Experience</span>
                  <span className="font-bold text-[#1C1C1C] text-sm">{user?.experience_years || 25} Years Master Tradition</span>
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
