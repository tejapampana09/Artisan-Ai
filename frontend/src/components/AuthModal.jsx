import React, { useState } from 'react';
import { X, User, Lock, Mail, Phone, MapPin, Sparkles, CheckCircle2, LogIn, UserPlus, LogOut, KeyRound } from 'lucide-react';
import { loginUser, registerUser, resetPassword, logoutUser, getAuthToken } from '../api';
import AccountPortal from './AccountPortal';

export default function AuthModal({ isOpen, onClose, user, onAuthChange, onNavigateMode }) {
  if (!isOpen) return null;

  // When user is already authenticated, show the rich Account Portal with Orders, Wishlist, Enquiries & Profile
  if (user) {
    return (
      <AccountPortal 
        user={user} 
        onClose={onClose} 
        onAuthChange={onAuthChange} 
        onNavigateMode={onNavigateMode} 
      />
    );
  }

  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot password form
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState('ARTISAN');
  const [regCraft, setRegCraft] = useState('');
  const [regLocation, setRegLocation] = useState('');
  const [regPassword, setRegPassword] = useState('');

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
      }, 600);
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
        role: regRole,
        craft: regCraft.trim() || null,
        location: regLocation.trim() || null,
        password: regPassword,
        active_mode: regRole === 'ARTISAN' ? 'SELL' : 'BUY'
      });
      setSuccessMsg(`Account created successfully! Welcome, ${res.user.name}.`);
      setTimeout(() => {
        onAuthChange(res.user);
        onClose();
      }, 600);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await resetPassword({
        email_or_phone: resetIdentifier,
        new_password: newPassword,
      });
      setSuccessMsg(`Password reset successfully! Welcome back, ${res.user.name}.`);
      setTimeout(() => {
        onAuthChange(res.user);
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Password reset failed. Please check your email or phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    onAuthChange(null);
    onClose();
  };

  const hasToken = !!getAuthToken();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-orange-600 to-amber-600 p-5 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Artisan AI Account</h3>
              <p className="text-xs text-amber-100">Secure Identity & Ownership</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-amber-200 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Active User Card if logged in */}
          {user && (
            <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900">{user.name}</span>
                  <span className="text-[10px] uppercase font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                    {user.role || 'ARTISAN'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{user.email || user.phone} • {user.craft}</p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center space-x-1 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${tab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${tab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Create Account
            </button>
          </div>

          {/* Tab 1: Login */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email or Phone</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                    placeholder="artisan@domain.com or phone"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setError(''); setSuccessMsg(''); }}
                    className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In to Account'}
              </button>
            </form>
          )}

          {/* Tab 3: Forgot / Reset Password — Disabled (secure OTP flow not yet implemented) */}
          {tab === 'forgot' && (
            <div className="space-y-4 text-xs">
              <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-4 text-slate-700">
                <p className="font-bold text-slate-900 mb-1 flex items-center space-x-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>Password Reset Unavailable</span>
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Public password reset via email or phone is currently disabled. A secure
                  OTP/email-verified reset flow has not yet been implemented.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-[11px] text-blue-800 leading-relaxed">
                <strong>If you remember your password:</strong> sign in normally below.<br />
                <strong>If you are already logged in:</strong> you can change your password
                securely from your account settings using your current password.
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(''); setSuccessMsg(''); }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Register */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="artisan@domain.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Role</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="ARTISAN">Artisan (Seller)</option>
                    <option value="BUYER">Connoisseur (Buyer)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Craft Specialization</label>
                  <input
                    type="text"
                    value={regCraft}
                    onChange={(e) => setRegCraft(e.target.value)}
                    placeholder="e.g. Dokra Casting"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Location / Cluster</label>
                <input
                  type="text"
                  value={regLocation}
                  onChange={(e) => setRegLocation(e.target.value)}
                  placeholder="e.g. Bastar, Chhattisgarh"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password (min 6 chars) *</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating Account...' : 'Register & Get JWT'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
