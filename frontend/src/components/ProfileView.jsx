import React, { useState } from 'react';
import { 
  User, Mail, Phone, MapPin, Award, ShieldCheck, CheckCircle2, 
  LogOut, Store, Sparkles, Edit3, Globe, Smartphone, ChevronRight, PlusCircle
} from 'lucide-react';
import { logoutUser } from '../api/index.js';
import { useNotification } from '../context/NotificationContext';

export default function ProfileView({ user, onSelectMode, onAuthChange }) {
  const notify = useNotification();
  const isArtisan = user?.role === 'ARTISAN';

  const handleSignOut = () => {
    logoutUser();
    onAuthChange(null);
    onSelectMode('HOME');
    notify.success('Signed out cleanly');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 font-sans">
      {/* Profile Header Banner */}
      <div className="bg-gradient-to-r from-[#1C1C1C] via-[#2A1E17] to-[#A6533B] text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center text-3xl font-black text-white shadow-inner shrink-0">
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
                  GI Certified Master Artisan
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Account Details & Verification Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details */}
        <div className="bg-white rounded-2xl border border-[#E8E5DF] p-6 space-y-4 shadow-xs">
          <div className="border-b border-[#E8E5DF] pb-3 flex justify-between items-center">
            <h2 className="font-bold text-base text-[#1C1C1C] flex items-center space-x-2">
              <User className="w-4 h-4 text-[#A6533B]" />
              <span>Personal Information</span>
            </h2>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Verified
            </span>
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
              <span className="font-bold text-[#1C1C1C]">{user?.phone || '+91 98765 43210'}</span>
            </div>
            <div>
              <span className="text-[#6B6B6B] block">Location / Craft Region</span>
              <span className="font-bold text-[#1C1C1C] flex items-center mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#A6533B] mr-1" />
                <span>{user?.location || 'Andhra Pradesh, India'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Heritage Credentials / Buyer Badges */}
        <div className="bg-white rounded-2xl border border-[#E8E5DF] p-6 space-y-4 shadow-xs">
          <div className="border-b border-[#E8E5DF] pb-3 flex justify-between items-center">
            <h2 className="font-bold text-base text-[#1C1C1C] flex items-center space-x-2">
              <Award className="w-4 h-4 text-[#A6533B]" />
              <span>{isArtisan ? 'GI Heritage Artisan Credentials' : 'Direct Fair Trade Supporter'}</span>
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            {isArtisan ? (
              <>
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E8E5DF]">
                  <span className="text-[10px] font-bold text-[#A6533B] uppercase block">Specialization</span>
                  <span className="font-bold text-[#1C1C1C] text-sm">{user?.craft_specialization || user?.craft || 'Kalamkari & Handloom Painting'}</span>
                </div>
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E8E5DF]">
                  <span className="text-[10px] font-bold text-[#A6533B] uppercase block">Craft Experience</span>
                  <span className="font-bold text-[#1C1C1C] text-sm">{user?.experience_years || 25} Years Master Tradition</span>
                </div>
              </>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200/60 space-y-2 text-[#1C1C1C]">
                <span className="font-bold block text-sm">Protected Fair-Trade Buyer</span>
                <p className="text-xs text-[#6B6B6B] leading-relaxed">
                  Every order you place protects rural Indian craftspeople with a minimum 20% profit margin floor and zero middleman cuts.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account Navigation Quick Links */}
      <div className="bg-white rounded-2xl border border-[#E8E5DF] p-6 space-y-4 shadow-xs">
        <h2 className="font-bold text-base text-[#1C1C1C]">Quick Account Shortcuts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <button
            onClick={() => onSelectMode('ORDERS')}
            className="p-4 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl font-bold text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B] transition-all flex items-center justify-between cursor-pointer"
          >
            <span>My Orders & Sales</span>
            <ChevronRight className="w-4 h-4 text-[#A6533B]" />
          </button>
          <button
            onClick={() => onSelectMode('WISHLIST')}
            className="p-4 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl font-bold text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B] transition-all flex items-center justify-between cursor-pointer"
          >
            <span>Saved Wishlist</span>
            <ChevronRight className="w-4 h-4 text-[#A6533B]" />
          </button>
          <button
            onClick={() => onSelectMode('ENQUIRIES')}
            className="p-4 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl font-bold text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B] transition-all flex items-center justify-between cursor-pointer"
          >
            <span>Custom Enquiries</span>
            <ChevronRight className="w-4 h-4 text-[#A6533B]" />
          </button>
        </div>
      </div>
    </div>
  );
}
