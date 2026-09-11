import React, { useState } from 'react';
import { X, Lock, Mail, CheckCircle2, LogOut } from 'lucide-react';
import { loginUser, registerUser, resetPassword, logoutUser, getAuthToken } from '../api/index.js';
import AccountPortal from './AccountPortal';

export default function AuthModal({ isOpen, onClose, user, onAuthChange, onNavigateMode }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState('ARTISAN');
  const [regCraft, setRegCraft] = useState('');
  const [regPassword, setRegPassword] = useState('');

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#E7E7E2] overflow-hidden">
        
        {/* Header (Screen 2 Design) */}
        <div className="p-8 pb-4 relative text-center">
          <button onClick={onClose} className="p-2 text-[#666666] hover:text-[#171717] rounded-xl absolute right-4 top-4">
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-12 h-12 bg-[#176B4D]/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[#176B4D]/20">
            <img src="/artisan-logo.png" alt="Logo" className="w-7 h-7 object-contain" />
          </div>

          <h3 className="font-extrabold text-2xl text-[#171717]">
            {tab === 'register' ? 'Create Account' : 'Welcome Back'}
          </h3>
          <p className="text-xs text-[#666666] mt-1">
            Continue your journey with Artisan AI
          </p>
        </div>

        {/* Content Body */}
        <div className="p-8 pt-2 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 font-medium">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#176B4D]" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#171717] mb-1.5">Email or phone</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#666666] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                    placeholder="Enter email or phone number"
                    className="w-full pl-10 pr-4 py-3 bg-[#FAFAF7] border border-[#E7E7E2] rounded-2xl text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#176B4D]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#171717] mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#666666] absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-[#FAFAF7] border border-[#E7E7E2] rounded-2xl text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#176B4D]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button type="button" className="text-xs text-[#176B4D] font-semibold hover:underline">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#176B4D] hover:bg-[#0F4D38] text-white font-bold rounded-2xl shadow-md transition-all text-sm"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>

              {/* Google Auth Divider */}
              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E7E7E2]"></div></div>
                <span className="relative bg-white px-3 text-[11px] text-[#666666]">or</span>
              </div>

              <button
                type="button"
                className="w-full py-3 bg-[#FAFAF7] hover:bg-stone-100 border border-[#E7E7E2] text-[#171717] font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all text-xs"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                <span>Continue with Google</span>
              </button>

              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setTab('register'); setError(''); }}
                  className="text-xs text-[#176B4D] font-bold hover:underline"
                >
                  Create a new account
                </button>
              </div>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#171717] mb-1">Full Name</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  placeholder="Ravi Kumar"
                  className="w-full px-4 py-2.5 bg-[#FAFAF7] border border-[#E7E7E2] rounded-2xl text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#176B4D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#171717] mb-1">Email</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="artisan@domain.com"
                    className="w-full px-4 py-2.5 bg-[#FAFAF7] border border-[#E7E7E2] rounded-2xl text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#176B4D]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#171717] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-4 py-2.5 bg-[#FAFAF7] border border-[#E7E7E2] rounded-2xl text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#176B4D]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#171717] mb-1">Password</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-[#FAFAF7] border border-[#E7E7E2] rounded-2xl text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#176B4D]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#176B4D] hover:bg-[#0F4D38] text-white font-bold rounded-2xl shadow-md transition-all text-sm mt-2"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(''); }}
                  className="text-xs text-[#176B4D] font-bold hover:underline"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
