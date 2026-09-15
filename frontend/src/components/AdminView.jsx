import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, User, Lock, Mail, Phone, MapPin, Sparkles, CheckCircle2, 
  PlusCircle, Users, BarChart3, Store, ArrowRight, KeyRound, LogOut, ShoppingBag
} from 'lucide-react';
import { loginUser, adminCreateSeller, adminListSellers } from '../api/index.js';
import { getAdminToken } from '../api/client.js';
import { useNotification } from '../context/NotificationContext';

export default function AdminView({ user, onAuthChange, onSelectMode }) {
  const toast = useNotification();
  const [adminUser, setAdminUser] = useState(user?.role === 'ADMIN' ? user : null);

  // Admin Login state
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Seller Provisioning state
  const [sellers, setSellers] = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // New Seller Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [craft, setCraft] = useState('');
  const [location, setLocation] = useState('');
  const [password, setPassword] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('GI_VERIFIED');

  useEffect(() => {
    if (getAdminToken() && (user?.role === 'ADMIN' || adminUser)) {
      fetchSellers();
    }
  }, [user, adminUser]);

  const fetchSellers = async () => {
    setLoadingSellers(true);
    try {
      const data = await adminListSellers();
      setSellers(data || []);
    } catch (err) {
      console.error('Failed to fetch sellers:', err);
    } finally {
      setLoadingSellers(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await loginUser({
        email_or_phone: adminIdentifier,
        password: adminPassword,
      });
      
      if (res.user.role !== 'ADMIN') {
        setLoginError(`Access Denied: Account '${res.user.email || adminIdentifier}' role is '${res.user.role}'. Only ADMIN accounts (e.g. admin@artisan.ai) can access the Admin Portal.`);
        return;
      }

      // Store user and check role
      setAdminUser(res.user);
      onAuthChange(res.user);
      toast.success(`Welcome, Admin ${res.user.name}!`);
      fetchSellers();
    } catch (err) {
      setLoginError(err.message || 'Admin authentication failed. Please check credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCreateSeller = async (e) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setFormError('Please provide at least an email address or phone number for the artisan.');
      return;
    }
    setCreating(true);
    setFormError('');
    setFormSuccess('');

    try {
      const created = await adminCreateSeller({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        password: password,
        craft: craft.trim() || 'Traditional Handicrafts',
        location: location.trim() || 'India',
        verification_status: verificationStatus,
      });

      const msg = `✓ Successfully created Seller Profile for ${created.name}! Initial credentials set.`;
      setFormSuccess(msg);
      toast.success(`Seller Profile Provisioned: ${created.name}`);

      // Reset form
      setName('');
      setEmail('');
      setPhone('');
      setCraft('');
      setLocation('');
      setPassword('');

      fetchSellers();
    } catch (err) {
      setFormError(err.message || 'Failed to create seller profile.');
    } finally {
      setCreating(false);
    }
  };

  // If user is not logged in as Admin, show Admin Login Portal
  if (!adminUser && user?.role !== 'ADMIN') {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 border border-[#E8E5DF] shadow-2xl space-y-6 text-xs text-[#1C1C1C]">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#1C1C1C] text-amber-400 flex items-center justify-center mx-auto shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A6533B] bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
            Master Platform Administration
          </span>
          <h2 className="text-2xl font-bold text-[#1C1C1C] pt-1">Admin Portal Login</h2>
          <p className="text-[#6B6B6B]">
            Sign in with administrator credentials to manage platform users and provision verified artisan seller profiles.
          </p>
        </div>

        {user && user.role !== 'ADMIN' && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-center">
            <span className="font-bold">Logged in as:</span> {user.name} ({user.role})
            <p className="text-[11px] text-amber-800 mt-0.5">Please sign in below with administrator credentials (admin@artisan.ai) to gain access.</p>
          </div>
        )}

        {loginError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-semibold">
            {loginError}
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block font-semibold text-[#1C1C1C] mb-1">Admin Email or Username</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-3" />
              <input
                type="text"
                value={adminIdentifier}
                onChange={(e) => setAdminIdentifier(e.target.value)}
                required
                placeholder="admin@artisan.ai"
                className="w-full pl-9 pr-3 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl outline-hidden focus:ring-2 focus:ring-[#1C1C1C]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#1C1C1C] mb-1">Admin Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-3" />
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl outline-hidden focus:ring-2 focus:ring-[#1C1C1C]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3 bg-[#1C1C1C] hover:bg-[#A6533B] text-white font-bold rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2 text-sm"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loginLoading ? 'Authenticating Admin...' : 'Sign In to Admin Portal'}</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#E8E5DF]">
          <button
            onClick={() => onSelectMode('BUY')}
            className="text-[#6B6B6B] hover:text-[#1C1C1C] font-semibold text-xs transition-colors cursor-pointer"
          >
            ← Return to Buyer Marketplace
          </button>
        </div>
      </div>
    );
  }

  // Admin Dashboard View when authenticated as Admin
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 font-sans text-xs text-[#1C1C1C]">
      {/* Header Banner */}
      <div className="bg-[#1C1C1C] text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-stone-800">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#A6533B] text-white flex items-center justify-center font-bold text-xl shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ARTISAN AI ADMIN CONTROL CENTER</h1>
              <span className="bg-amber-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                Administrator
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Welcome, <strong>{user?.name || 'Administrator'}</strong> • Provision verified artisan seller profiles and assign login credentials.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => onSelectMode('BUY')}
            className="bg-white/10 hover:bg-white/20 text-stone-200 border border-white/20 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Buyer Marketplace</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form + Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-[#E8E5DF] shadow-xs space-y-4">
          <div className="border-b border-[#E8E5DF] pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <PlusCircle className="w-5 h-5 text-[#A6533B]" />
              <h3 className="font-bold text-base text-[#1C1C1C]">Provision New Artisan Seller Profile</h3>
            </div>
            <span className="text-[10px] font-bold uppercase text-[#A6533B] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Admin Only
            </span>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-semibold">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateSeller} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#1C1C1C] mb-1">Artisan Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Lakshmi Devi"
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1C1C] mb-1">Craft Specialization</label>
                <input
                  type="text"
                  value={craft}
                  onChange={(e) => setCraft(e.target.value)}
                  placeholder="e.g. Kondapalli Toys & Woodcraft"
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#1C1C1C] mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="artisan@domain.com"
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1C1C] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-[#1C1C1C] mb-1">Location / Village</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Kondapalli, AP"
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1C1C] mb-1">Assigned Password *</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="ArtisanPass123"
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1C1C] mb-1">GI Credentials Status</label>
                <select
                  value={verificationStatus}
                  onChange={(e) => setVerificationStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl text-[#1C1C1C] font-semibold"
                >
                  <option value="GI_VERIFIED">GI Verified Master</option>
                  <option value="VERIFIED_ARTISAN">Verified Artisan</option>
                  <option value="PENDING">Pending Review</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="bg-[#A6533B] hover:bg-[#88412F] text-white font-bold px-6 py-3 rounded-xl transition-all cursor-pointer flex items-center space-x-2 shadow-md"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{creating ? 'Provisioning Profile...' : 'Provision Artisan Seller Profile'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Provisioned Directory (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-[#E8E5DF] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#1C1C1C]" />
                <h3 className="font-bold text-sm text-[#1C1C1C]">Provisioned Sellers ({sellers.length})</h3>
              </div>
              <span className="text-[10px] text-[#6B6B6B]">Can publish on Seller Studio</span>
            </div>

            {loadingSellers ? (
              <div className="py-8 text-center text-[#6B6B6B]">Loading seller profiles...</div>
            ) : sellers.length === 0 ? (
              <div className="py-8 text-center text-[#6B6B6B]">
                No artisan sellers provisioned yet. Fill out the form on the left to create the first seller profile.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E5DF] max-h-96 overflow-y-auto pr-1">
                {sellers.map((s) => (
                  <div key={s.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-[#A6533B] text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-[#1C1C1C] truncate">{s.name}</span>
                          <span className="bg-amber-100 text-[#A6533B] text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-amber-300 shrink-0">
                            {s.verification_status || 'GI_VERIFIED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B6B6B] truncate">
                          {s.craft} • Login: <strong className="text-[#1C1C1C]">{s.email || s.phone}</strong>
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      Active Seller
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
