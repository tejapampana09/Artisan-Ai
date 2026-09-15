import React, { useState, useEffect } from 'react';
import { 
  X, User, Lock, Mail, Phone, MapPin, Sparkles, CheckCircle2, 
  LogIn, UserPlus, LogOut, KeyRound, ShieldCheck, Store, ArrowRight 
} from 'lucide-react';
import { loginUser, registerUser, resetPassword, logoutUser, getAuthToken, googleAuth } from '../api/index.js';

export default function AuthModal({ isOpen, onClose, user, onAuthChange, onNavigateMode, initialTab = 'ORDERS' }) {
  const [isSellerMode, setIsSellerMode] = useState(
    initialTab === 'SELL_REGISTER' || initialTab === 'SELL_LOGIN'
  );
  const [tab, setTab] = useState(initialTab === 'SELL_REGISTER' ? 'register' : 'login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form (for buyers)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '26058075206-on14bkf0hlrenshpogiglj07ftb8qgba.apps.googleusercontent.com';

  useEffect(() => {
    setIsSellerMode(initialTab === 'SELL_REGISTER' || initialTab === 'SELL_LOGIN');
    setTab('login');
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
      setError('Google Sign-In is still initializing or blocked by an extension. Please sign in with email/password.');
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginUser({
        email_or_phone: loginIdentifier,
        password: loginPassword,
      });

      setSuccessMsg(`Welcome back, ${res.user.name}!`);
      setTimeout(() => {
        onAuthChange(res.user);
        onClose();
        if (isSellerMode && (res.user.role === 'ARTISAN' || res.user.role === 'ADMIN')) {
          onNavigateMode?.('SELL');
        }
      }, 500);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e?.preventDefault();
    const cleanedEmail = regEmail.trim();
    const cleanedPhone = regPhone.trim();
    if (!cleanedEmail && !cleanedPhone) {
      setError('Please provide at least an email address or phone number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await registerUser({
        name: regName.trim(),
        email: cleanedEmail || null,
        phone: cleanedPhone || null,
        role: 'BUYER',
        password: regPassword,
        active_mode: 'BUY'
      });
      setSuccessMsg(`Account created successfully! Welcome, ${res.user.name}.`);
      setTimeout(() => {
        onAuthChange(res.user);
        onClose();
      }, 500);
    } catch (err) {
      setError(err.message || 'Registration failed.');
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
                <span>Customer Account Portal</span>
              </div>
              <h3 className="font-serif font-bold text-2xl text-[#2A1E17]">
                {tab === 'register' ? 'Join Artisan AI as a Buyer' : 'Customer Sign In'}
              </h3>
              <p className="text-xs text-[#6B5B51] mt-1 leading-relaxed">
                Shop authentic Indian handicrafts directly from artisans with zero middleman markups.
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
            /* BUYER MODE: Google OAuth + Customer Register/Login */
            <div className="space-y-3.5">
              {/* Google Auth Integration Button */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading || googleLoading}
                  className="w-full py-2.5 px-4 bg-white border border-[#E8E5DF] hover:border-amber-700/50 rounded-2xl font-bold text-xs text-[#1C1C1C] shadow-2xs hover:shadow-xs transition-all flex items-center justify-center space-x-2.5 cursor-pointer hover:bg-stone-50 disabled:opacity-60"
                >
                  {googleLoading ? (
                    <div className="w-4 h-4 border-2 border-stone-400 border-t-amber-800 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  <span>{googleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
                </button>

                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-[#E8E5DF]"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-extrabold uppercase tracking-wider text-[#9E8E83]">Or with password</span>
                  <div className="flex-grow border-t border-[#E8E5DF]"></div>
                </div>
              </div>

              {/* Customer Tabs */}
              <div className="flex border-b border-[#EADFCF] text-xs font-bold text-stone-400 mb-1">
                <button
                  onClick={() => { setTab('login'); setError(''); }}
                  className={`pb-2 px-4 font-bold border-b-2 transition-all cursor-pointer ${tab === 'login' ? 'border-[#933D1E] text-[#933D1E]' : 'border-transparent text-stone-400 hover:text-stone-700'}`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setTab('register'); setError(''); }}
                  className={`pb-2 px-4 font-bold border-b-2 transition-all cursor-pointer ${tab === 'register' ? 'border-[#933D1E] text-[#933D1E]' : 'border-transparent text-stone-400 hover:text-stone-700'}`}
                >
                  Create Account
                </button>
              </div>

              {/* Customer Sign In Form */}
              {tab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-[#2A1E17] mb-1">Email or Phone</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        required
                        placeholder="buyer@domain.com or phone"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#EADFCF] rounded-2xl focus:ring-2 focus:ring-[#933D1E] outline-hidden text-[#2A1E17]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#2A1E17] mb-1">Password</label>
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
                    className="w-full py-3 bg-[#933D1E] hover:bg-[#7E3216] text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 text-xs mt-3 disabled:opacity-50"
                  >
                    <span>{loading ? 'Signing in...' : 'Sign In as Customer'}</span>
                  </button>
                </form>
              )}

              {/* Customer Register Form */}
              {tab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="buyer@domain.com"
                        className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+91 98765 00000"
                        className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Password (min 6 chars) *</label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EADFCF] rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-2xl shadow-lg transition-all cursor-pointer disabled:opacity-50 mt-3"
                  >
                    {loading ? 'Creating Account...' : 'Create Customer Account'}
                  </button>
                </form>
              )}

              {/* Switch to Seller Studio Login */}
              <div className="text-center pt-3 border-t border-[#EADFCF]">
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
