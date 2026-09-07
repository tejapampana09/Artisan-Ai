import React, { useState } from 'react';
import { X, User, Lock, Mail, Phone, MapPin, Sparkles, CheckCircle2, LogIn, UserPlus, LogOut, KeyRound } from 'lucide-react';
import { loginUser, registerUser, resetPassword, logoutUser, getAuthToken } from '../api/index.js';
import AccountPortal from './AccountPortal';

export default function AuthModal({ isOpen, onClose, user, onAuthChange, onNavigateMode }) {
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
    <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 pb-20 sm:pb-4">
      <div className="bg-[#FAF7F2] rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-6 pb-2 relative">
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg absolute right-4 top-4 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          <h3 className="font-extrabold text-2xl text-[#2C1A0E]">
            {tab === 'register' ? 'Welcome, Create Your Account' : 'Welcome Back'}
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Join thousands of artisans and buyers building a brighter tomorrow
          </p>
        </div>

        {/* Body */}
        <div className="p-6 pt-2 space-y-4">
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
          <div className="flex border-b border-stone-200 text-xs font-bold text-stone-400 mb-2">
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`pb-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer ${tab === 'register' ? 'border-[#4A2E1B] text-[#4A2E1B]' : 'border-transparent text-stone-400 hover:text-stone-700'}`}
            >
              Register
            </button>
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`pb-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer ${tab === 'login' ? 'border-[#4A2E1B] text-[#4A2E1B]' : 'border-transparent text-stone-400 hover:text-stone-700'}`}
            >
              Login
            </button>
          </div>

          {/* Tab 1: Login */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Email or Phone Number</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                    placeholder="artisan@domain.com or phone"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-stone-700">Password</label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              </button>
            </form>
          )}

          {/* Tab 2: Register */}
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
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="artisan@domain.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Account Role</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl text-stone-800"
                  >
                    <option value="ARTISAN">Artisan (Seller)</option>
                    <option value="BUYER">Connoisseur (Buyer)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Craft Specialization</label>
                  <input
                    type="text"
                    value={regCraft}
                    onChange={(e) => setRegCraft(e.target.value)}
                    placeholder="e.g. Dokra Casting"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
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
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-[#4A2E1B] outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-2xl shadow-lg transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
