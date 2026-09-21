import React, { useState, useEffect } from 'react';
import { 
  X, User, Lock, Mail, Phone, Sparkles, CheckCircle2, 
  LogIn, ShieldCheck, Store, ArrowRight, Smartphone, MapPin,
  Award, Briefcase, ChevronRight, Clock
} from 'lucide-react';
import { loginUser, registerArtisan, clearAuthToken, googleAuth } from '../api/index.js';
import { clearUserOfflineCache } from '../services/offlineSync.js';

export default function AuthModal({ isOpen, onClose, user, onAuthChange, onNavigateMode, initialTab = 'ORDERS' }) {
  const [isSellerMode, setIsSellerMode] = useState(
    initialTab === 'SELL_REGISTER' || initialTab === 'SELL_LOGIN'
  );
  const [authAction, setAuthAction] = useState(
    initialTab === 'SELL_REGISTER' || initialTab === 'REGISTER'
      ? 'REGISTER'
      : 'LOGIN'
  );

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submittedApp, setSubmittedApp] = useState(null);

  // Studio Login credentials
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Artisan Registration form
  const [artisanForm, setArtisanForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    craft: 'Kalamkari Handlooms',
    location: '',
    experience_years: 5,
    bio: ''
  });

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    const isSeller = initialTab === 'SELL_REGISTER' || initialTab === 'SELL_LOGIN';
    setIsSellerMode(isSeller);
    setAuthAction(
      initialTab === 'SELL_REGISTER' || initialTab === 'REGISTER' || initialTab === 'BUYER_REGISTER'
        ? 'REGISTER'
        : 'LOGIN'
    );
    setError('');
    setSuccessMsg('');
    setSubmittedApp(null);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;
  if (user) return null;

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError('');

    if (window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setError(`Google Sign-In error: ${tokenResponse.error_description || tokenResponse.error}`);
              }
              setGoogleLoading(false);
              return;
            }

            try {
              const res = await googleAuth({
                access_token: tokenResponse.access_token
              });
              setSuccessMsg(`Welcome, ${res.user.name}!`);
              setTimeout(() => {
                onAuthChange(res.user);
                onClose();
              }, 400);
            } catch (backendErr) {
              setError(backendErr.message || 'Failed to authenticate Google account on server.');
            } finally {
              setGoogleLoading(false);
            }
          }
        });

        client.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (gisErr) {
        console.warn('Google GIS popup launch failed:', gisErr);
        setError('Failed to launch Google Sign-In popup. Please ensure popups are allowed or sign in with email.');
        setGoogleLoading(false);
      }
    } else {
      setError('Google Sign-In is still initializing or blocked by an extension. Please sign in with email.');
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginUser({
        email_or_phone: loginIdentifier.trim(),
        password: loginPassword,
        portal: isSellerMode ? 'STUDIO' : 'MARKETPLACE',
      });

      if (isSellerMode && res.user.role !== 'ARTISAN' && res.user.role !== 'ADMIN') {
        clearAuthToken();
        clearUserOfflineCache();
        setError('Access denied: This account is registered as a Customer. Seller Studio is strictly for verified Artisans.');
        return;
      }

      setSuccessMsg(`Welcome back, ${res.user.name}!`);
      setTimeout(() => {
        onAuthChange(res.user);
        onClose();
        if (isSellerMode && (res.user.role === 'ARTISAN' || res.user.role === 'ADMIN')) {
          onNavigateMode?.('SELL');
        }
      }, 400);
    } catch (err) {
      clearAuthToken();
      clearUserOfflineCache();
      const rawMsg = err.message || 'Login failed. Please check credentials.';
      if (rawMsg.toLowerCase().includes('pending verification') || rawMsg.toLowerCase().includes('suspended')) {
        setError('⏳ Application Pending Approval: Your artisan registration is awaiting verification by Platform Admin. Once approved, you will be able to log in to Studio.');
      } else {
        setError(rawMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleArtisanRegister = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!artisanForm.name || !artisanForm.password) {
        throw new Error('Please enter your name and password.');
      }
      if (!artisanForm.phone && !artisanForm.email) {
        throw new Error('Please provide your phone number or email.');
      }

      const res = await registerArtisan({
        name: artisanForm.name.trim(),
        email: artisanForm.email.trim() || null,
        phone: artisanForm.phone.trim() || null,
        password: artisanForm.password,
        craft: artisanForm.craft,
        location: artisanForm.location.trim() || 'India',
        experience_years: Number(artisanForm.experience_years) || 0,
        bio: artisanForm.bio.trim() || `Master artisan specializing in traditional ${artisanForm.craft}.`
      });

      setSubmittedApp({
        applicationId: res.application_id || res.user?.id || Date.now(),
        name: res.user?.name || artisanForm.name,
        craft: artisanForm.craft,
        identifier: artisanForm.phone || artisanForm.email,
      });
    } catch (err) {
      setError(err.message || 'Artisan registration failed. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#2A1E17]/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FBF8F3] rounded-3xl max-w-lg w-full shadow-2xl border border-[#EADFCF] overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-6 pb-4 relative border-b border-[#EADFCF]/60">
          <button 
            onClick={onClose} 
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg absolute right-4 top-4 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {isSellerMode ? (
            <div>
              <div className="inline-flex items-center space-x-1.5 bg-amber-100 text-[#933D1E] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border border-amber-200 mb-2">
                <Store className="w-3.5 h-3.5 text-[#933D1E]" />
                <span>Artisan Studio & Seller Portal</span>
              </div>
              <h3 className="font-serif font-bold text-2xl text-[#2A1E17]">
                {authAction === 'REGISTER' ? 'Register as Artisan / కళాకారుల నమోదు' : 'Artisan Studio Login / సెల్లర్ లాగిన్'}
              </h3>
              <p className="text-xs text-[#6B5B51] mt-1 leading-relaxed">
                {authAction === 'REGISTER' 
                  ? 'Join as an authentic rural creator. List crafts with Voice AI in 5 regional languages.'
                  : 'Sign in to access your AI catalog studio, orders, and pricing dashboard.'}
              </p>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center space-x-1.5 bg-[#FAF9F6] text-[#A6533B] px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-[#E8E5DF] mb-2">
                <User className="w-3.5 h-3.5 text-[#A6533B]" />
                <span>Customer Marketplace / కస్టమర్ పోర్టల్</span>
              </div>
              <h3 className="font-serif font-bold text-2xl text-[#2A1E17]">
                Customer Sign In / లాగిన్
              </h3>
              <p className="text-xs text-[#6B5B51] mt-1 leading-relaxed">
                Sign in with Google to explore authentic GI crafts, track orders, and support Indian rural creators.
              </p>
            </div>
          )}

          {/* Action Tabs: Login vs Register (Artisan Studio Only) */}
          {isSellerMode && (
            <div className="flex items-center gap-2 mt-4 p-1 bg-white/80 border border-[#EADFCF] rounded-xl">
              <button
                type="button"
                onClick={() => { setAuthAction('LOGIN'); setError(''); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authAction === 'LOGIN'
                    ? 'bg-[#933D1E] text-white shadow-xs'
                    : 'text-[#6B5B51] hover:text-[#2A1E17]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthAction('REGISTER'); setError(''); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authAction === 'REGISTER'
                    ? 'bg-[#933D1E] text-white shadow-xs'
                    : 'text-[#6B5B51] hover:text-[#2A1E17]'
                }`}
              >
                Register as Artisan
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Feedback messages */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium animate-in fade-in">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center space-x-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ----------------- SELLER / ARTISAN SECTION ----------------- */}
          {isSellerMode ? (
            submittedApp ? (
              <div className="py-2 px-1 space-y-4 animate-in fade-in">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-amber-100 text-[#933D1E] rounded-full flex items-center justify-center mx-auto border-2 border-amber-300 shadow-inner">
                    <Clock className="w-8 h-8 text-[#933D1E] animate-pulse" />
                  </div>
                  <div>
                    <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide">
                      Application #{submittedApp.applicationId} • Pending Admin Approval
                    </span>
                    <h3 className="font-serif font-bold text-xl text-[#2A1E17] mt-2">
                      Application Submitted for Verification!
                    </h3>
                    <p className="text-xs text-[#933D1E] font-medium mt-0.5">
                      ధృవీకరణ కోసం విజయవంతంగా సమర్పించబడింది
                    </p>
                  </div>
                </div>

                <div className="bg-[#FAF6F0] border border-[#EADFCF] rounded-2xl p-4 space-y-2 text-xs text-[#2A1E17]">
                  <div className="flex justify-between border-b border-[#EADFCF] pb-2">
                    <span className="text-[#6B5B51]">Artisan / Creator:</span>
                    <span className="font-bold">{submittedApp.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EADFCF] pb-2">
                    <span className="text-[#6B5B51]">Craft Discipline:</span>
                    <span className="font-bold">{submittedApp.craft}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EADFCF] pb-2">
                    <span className="text-[#6B5B51]">Registered Login ID:</span>
                    <span className="font-mono font-bold text-[#1C1C1C]">{submittedApp.identifier}</span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-[#6B5B51]">Review Status:</span>
                    <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      ⏳ PENDING_VERIFICATION
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-[11px] text-[#6B5B51] space-y-1.5">
                  <div className="flex items-center space-x-1.5 font-bold text-[#933D1E]">
                    <ShieldCheck className="w-4 h-4 text-[#933D1E] shrink-0" />
                    <span>How Verification Works / ధృవీకరణ వివరాలు:</span>
                  </div>
                  <p className="leading-relaxed">
                    Platform Admin reviews and approves craft applications within 24 hours to protect GI heritage. Once approved, you can log in to your Artisan Studio using your registered credentials.
                  </p>
                  <p className="text-[10px] text-stone-500 italic">
                    అడ్మిన్ ఆమోదం పొందిన వెంటనే మీరు సెల్లర్ స్టూడియో లోకి ప్రవేశించి వాయిస్ AI ద్వారా ఉత్పత్తులను నమోదు చేయవచ్చు.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLoginIdentifier(submittedApp.identifier);
                    setSubmittedApp(null);
                    setAuthAction('LOGIN');
                  }}
                  className="w-full py-3 bg-[#933D1E] hover:bg-[#7E3216] text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 text-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Go to Artisan Studio Login / లాగిన్ పేజీకి వెళ్లండి →</span>
                </button>
              </div>
            ) : authAction === 'REGISTER' ? (
              /* REAL ARTISAN REGISTRATION FORM */
              <form onSubmit={handleArtisanRegister} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-[#2A1E17] mb-1">
                    Artisan / Creator Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={artisanForm.name}
                    onChange={(e) => setArtisanForm({ ...artisanForm, name: e.target.value })}
                    placeholder="e.g. Lakshmi Devi / రాము ఆచారి"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#2A1E17] mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={artisanForm.phone}
                      onChange={(e) => setArtisanForm({ ...artisanForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#2A1E17] mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={artisanForm.email}
                      onChange={(e) => setArtisanForm({ ...artisanForm, email: e.target.value })}
                      placeholder="artisan@domain.com"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#2A1E17] mb-1">
                      Craft Discipline / హస్తకళ *
                    </label>
                    <select
                      value={artisanForm.craft}
                      onChange={(e) => setArtisanForm({ ...artisanForm, craft: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    >
                      <option value="Kalamkari Handlooms">Kalamkari Handlooms (కలంకారీ)</option>
                      <option value="Etikoppaka Wooden Toys">Etikoppaka Wooden Toys (ఏటికొప్పాక బొమ్మలు)</option>
                      <option value="Bidriware Silver Art">Bidriware Silver Inlay (బిద్రివేర్)</option>
                      <option value="Jaipur Blue Pottery">Jaipur Blue Pottery (బ్లూ పాట్టరీ)</option>
                      <option value="Terracotta & Clay Art">Terracotta & Clay Art (టెర్రకోటా)</option>
                      <option value="Pochampally Ikat Silks">Pochampally Ikat Silks (ఇక్కత్ పట్టు)</option>
                      <option value="Brass & Bell Metal">Brass & Bell Metal (ఇత్తడి కళ)</option>
                      <option value="Traditional Handicrafts">Other Traditional Crafts</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#2A1E17] mb-1">
                      Workshop Location / Village *
                    </label>
                    <input
                      type="text"
                      required
                      value={artisanForm.location}
                      onChange={(e) => setArtisanForm({ ...artisanForm, location: e.target.value })}
                      placeholder="e.g. Srikalahasti, AP"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#2A1E17] mb-1">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="80"
                      value={artisanForm.experience_years}
                      onChange={(e) => setArtisanForm({ ...artisanForm, experience_years: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#2A1E17] mb-1">
                      Create Password (min 6 chars) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={artisanForm.password}
                      onChange={(e) => setArtisanForm({ ...artisanForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-[11px] text-[#6B5B51] space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-[#933D1E]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#933D1E]" />
                    <span>Admin Verification Required / అడ్మిన్ ఆమోదం:</span>
                  </div>
                  <p>
                    Applications are reviewed by Platform Admin to preserve craft authenticity. Once approved, you can log in to your Artisan Studio.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-700 to-[#933D1E] hover:from-amber-800 hover:to-[#7E3216] text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 text-xs disabled:opacity-50"
                >
                  <Store className="w-4 h-4" />
                  <span>{loading ? 'Submitting Application...' : 'Submit for Verification / దరఖాస్తు సమర్పించండి →'}</span>
                </button>
              </form>
            ) : (
              /* ARTISAN STUDIO LOGIN FORM */
              <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-[#2A1E17] mb-1">
                    Artisan Email or Phone Number
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      required
                      placeholder="phone or email"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#EADFCF] rounded-xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#2A1E17] mb-1">
                    Studio Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#EADFCF] rounded-xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-700 to-[#933D1E] hover:from-amber-800 hover:to-[#7E3216] text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 text-xs disabled:opacity-50"
                >
                  <Store className="w-4 h-4" />
                  <span>{loading ? 'Signing into Studio...' : 'Access Artisan Studio →'}</span>
                </button>
              </form>
            )
          ) : (
            /* ----------------- CUSTOMER / BUYER SECTION (GOOGLE ONLY) ----------------- */
            <div className="space-y-4 py-2">
              {/* 1-Click Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading || googleLoading}
                className="w-full py-3.5 px-4 bg-white hover:bg-stone-50 border-2 border-[#EADFCF] hover:border-[#933D1E] rounded-2xl font-bold text-xs sm:text-sm text-[#1C1C1C] shadow-xs hover:shadow-md transition-all flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-60"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-stone-400 border-t-[#933D1E] rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>Continue with Google / గూగుల్ తో లాగిన్</span>
              </button>

              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-[#6B5B51] space-y-2">
                <div className="flex items-center space-x-1.5 font-bold text-[#933D1E]">
                  <ShieldCheck className="w-4 h-4 text-[#933D1E]" />
                  <span>Secure & Instant Sign-In / సురక్షితమైన లాగిన్</span>
                </div>
                <ul className="space-y-1 text-[11px] text-stone-600 list-disc list-inside">
                  <li>Instant one-click access using your verified Google profile</li>
                  <li>Track artisan orders, doorstep delivery & voice enquiries</li>
                  <li>Support heritage craftspeople directly with zero middlemen</li>
                </ul>
              </div>
            </div>
          )}

          {/* Switch Portal Footer Toggle */}
          <div className="text-center pt-3 border-t border-[#EADFCF]">
            {isSellerMode ? (
              <button
                type="button"
                onClick={() => { setIsSellerMode(false); setAuthAction('LOGIN'); setError(''); }}
                className="text-xs text-[#6B5B51] hover:text-[#933D1E] font-medium cursor-pointer transition-colors"
              >
                Shopping as a customer? <span className="underline font-bold text-[#933D1E]">Switch to Customer Portal</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setIsSellerMode(true); setAuthAction('REGISTER'); setError(''); }}
                className="text-xs text-[#6B5B51] hover:text-[#933D1E] font-medium cursor-pointer transition-colors"
              >
                Are you a rural craftsman? <span className="underline font-bold text-[#933D1E]">Register as an Artisan →</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
