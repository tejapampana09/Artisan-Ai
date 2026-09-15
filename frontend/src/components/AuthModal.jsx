import React, { useState, useEffect } from 'react';
import { 
  X, User, Lock, Mail, Phone, Sparkles, CheckCircle2, 
  LogIn, ShieldCheck, Store, ArrowRight, Smartphone, Check
} from 'lucide-react';
import { loginUser, resetPassword, logoutUser, getAuthToken, clearAuthToken, googleAuth } from '../api/index.js';
import { clearUserOfflineCache } from '../services/offlineSync.js';

export default function AuthModal({ isOpen, onClose, user, onAuthChange, onNavigateMode, initialTab = 'ORDERS' }) {
  const [isSellerMode, setIsSellerMode] = useState(
    initialTab === 'SELL_REGISTER' || initialTab === 'SELL_LOGIN'
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Seller Studio Login form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '26058075206-on14bkf0hlrenshpogiglj07ftb8qgba.apps.googleusercontent.com';

  useEffect(() => {
    setIsSellerMode(initialTab === 'SELL_REGISTER' || initialTab === 'SELL_LOGIN');
    setError('');
    setSuccessMsg('');
  }, [initialTab, isOpen]);

  if (!isOpen) return null;
  if (user) return null;

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError('');

    // If Google GIS SDK is loaded, trigger real Google OAuth popup
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
              // Send REAL verified Google access token to backend
              const res = await googleAuth({
                access_token: tokenResponse.access_token
              });
              setSuccessMsg(`Google Authentication Successful! Welcome, ${res.user.name}.`);
              setTimeout(() => {
                onAuthChange(res.user);
                onClose();
              }, 500);
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
      setError('Google Sign-In is still initializing or blocked by an extension. Please refresh and try again.');
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
        required_role: isSellerMode ? 'ARTISAN' : undefined,
      });

      // Defensive client-side role validation
      if (isSellerMode && res.user.role !== 'ARTISAN' && res.user.role !== 'ADMIN') {
        clearAuthToken();
        clearUserOfflineCache();
        setError('Access denied: This account is registered as a Customer/Buyer. Seller Studio is strictly reserved for verified Artisans and Admin accounts.');
        return;
      }

      setSuccessMsg(`Welcome back, ${res.user.name}!`);
      setTimeout(() => {
        onAuthChange(res.user);
        onClose();
        if (isSellerMode && (res.user.role === 'ARTISAN' || res.user.role === 'ADMIN')) {
          onNavigateMode?.('SELL');
        }
      }, 500);
    } catch (err) {
      clearAuthToken();
      clearUserOfflineCache();
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#2A1E17]/60 backdrop-blur-sm flex items-center justify-center p-4 pb-20 sm:pb-4">
      <div className="bg-[#FBF8F3] rounded-3xl max-w-md w-full shadow-2xl border border-[#EADFCF] overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header - Distinct for Seller Studio vs Customer */}
        <div className="p-6 pb-3 relative">
          <button 
            onClick={onClose} 
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg absolute right-4 top-4 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {isSellerMode ? (
            <div>
              <div className="inline-flex items-center space-x-1.5 bg-[#F4EBE1] text-[#933D1E] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border border-[#EADFCF] mb-2">
                <Store className="w-3.5 h-3.5 text-[#933D1E]" />
                <span>Artisan Studio Portal</span>
              </div>
              <h3 className="font-serif font-bold text-2xl text-[#2A1E17]">
                Seller Studio Login / సెల్లర్ లాగిన్
              </h3>
              <p className="text-xs text-[#6B5B51] mt-1 leading-relaxed">
                Official access portal for verified master artisans, GI craft clusters, and state weaver cooperatives.
              </p>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center space-x-1.5 bg-[#FAF9F6] text-[#A6533B] px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-[#E8E5DF] mb-2">
                <User className="w-3.5 h-3.5 text-[#A6533B]" />
                <span>Customer Sign In / కస్టమర్ లాగిన్</span>
              </div>
              <h3 className="font-serif font-bold text-2xl text-[#2A1E17]">
                Welcome to Artisan AI
              </h3>
              <p className="text-xs text-[#6B5B51] mt-1 leading-relaxed">
                Shop authentic Indian handicrafts directly from master artisans with zero middleman markups.
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 pt-1 space-y-4">
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

          {/* SELLER MODE: Admin-provisioned credentials notice (NO GOOGLE AUTH) */}
          {isSellerMode ? (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-xs text-amber-950 space-y-1 shadow-2xs">
                <div className="flex items-center space-x-1.5 font-bold text-[#933D1E]">
                  <ShieldCheck className="w-4 h-4 text-[#933D1E] shrink-0" />
                  <span>Admin-Provisioned Credentials</span>
                </div>
                <p className="text-[11px] text-[#6B5B51] leading-relaxed">
                  Artisan accounts are verified and provisioned directly by platform administrators. Please sign in with your official artisan credentials.
                </p>
              </div>

              {/* Dedicated Seller Studio Login Form */}
              <form onSubmit={handleLogin} className="space-y-3 text-xs">
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
                      placeholder="artisan@domain.com or phone"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#EADFCF] rounded-2xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#2A1E17] mb-1">
                    Studio Access Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#EADFCF] rounded-2xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-700 to-[#933D1E] hover:from-amber-800 hover:to-[#7E3216] text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 text-xs mt-3 disabled:opacity-50"
                >
                  <Store className="w-4 h-4" />
                  <span>{loading ? 'Authenticating Studio...' : 'Access Artisan Studio →'}</span>
                </button>
              </form>

              {/* Switch to Customer Login */}
              <div className="text-center pt-3 border-t border-[#EADFCF]">
                <button
                  type="button"
                  onClick={() => { setIsSellerMode(false); setError(''); }}
                  className="text-xs text-[#6B5B51] hover:text-[#933D1E] font-medium cursor-pointer transition-colors"
                >
                  Shopping as a customer? <span className="underline font-bold text-[#933D1E]">Switch to Customer Login</span>
                </button>
              </div>
            </div>
          ) : (
            /* BUYER MODE: 1-Click Google Sign-In + Mobile OTP Preview */
            <div className="space-y-4">
              {/* Primary 1-Click Google Sign In */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading || googleLoading}
                  className="w-full py-3.5 px-4 bg-white hover:bg-stone-50 border-2 border-[#EADFCF] hover:border-amber-700/60 rounded-2xl font-bold text-sm text-[#1C1C1C] shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-60 group"
                >
                  {googleLoading ? (
                    <div className="w-5 h-5 border-2 border-stone-400 border-t-amber-800 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  <span className="font-semibold text-stone-800">
                    {googleLoading ? 'Signing in with Google...' : 'Continue with Google / గూగుల్ తో లాగిన్'}
                  </span>
                </button>
                <p className="text-[11px] text-center text-[#8C7A6B]">
                  1-Click Instant Sign In • No password required
                </p>
              </div>

              {/* Mobile OTP Login - Coming Soon Section */}
              <div className="p-3.5 bg-[#FAF6F0] border border-[#EADFCF] rounded-2xl flex items-start space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100/80 border border-amber-200 flex items-center justify-center shrink-0 text-[#933D1E] mt-0.5">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="text-left space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2A1E17]">Mobile OTP Sign-In</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-amber-200/60 text-[#823214] rounded-full">
                      Coming Soon / త్వరలో
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B5B51] leading-relaxed">
                    Direct phone number + OTP login is arriving soon. In the meantime, please sign in with 1-click Google to track orders and save your wishlist.
                  </p>
                </div>
              </div>

              {/* Customer Benefits */}
              <div className="bg-white/70 border border-[#EADFCF] rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="text-[11px] font-bold text-[#2A1E17] uppercase tracking-wider">
                  Customer Account Perks
                </div>
                <div className="space-y-1.5 text-[11px] text-[#5C4D43]">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Real-time tracking of handloom & craft orders</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Direct WhatsApp & voice enquiries to verified artisans</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Secure UPI, Card & Cash on Delivery checkout</span>
                  </div>
                </div>
              </div>

              {/* Switch to Seller Studio Login */}
              <div className="text-center pt-2 border-t border-[#EADFCF]">
                <button
                  type="button"
                  onClick={() => { setIsSellerMode(true); setError(''); }}
                  className="text-xs text-[#6B5B51] hover:text-[#933D1E] font-medium cursor-pointer transition-colors"
                >
                  Are you a verified artisan? <span className="underline font-bold text-[#933D1E]">Artisan Studio Login →</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
