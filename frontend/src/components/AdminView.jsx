import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, User, Lock, Mail, Phone, MapPin, Sparkles, CheckCircle2, 
  PlusCircle, Users, BarChart3, Store, ArrowRight, KeyRound, LogOut, ShoppingBag,
  Check, AlertTriangle, Eye, Trash2, ShieldAlert, RefreshCw, Layers, Clock, AlertCircle
} from 'lucide-react';
import { 
  loginUser, 
  adminCreateSeller, 
  adminListSellers, 
  adminListProducts, 
  adminApproveProduct, 
  adminPublishProduct, 
  adminSuspendProduct, 
  adminDeleteProduct,
  adminResetArtisanPassword,
  adminDeleteArtisan,
  adminApproveArtisan,
  adminRejectArtisan
} from '../api/index.js';
import { getAdminToken } from '../api/client.js';
import { logoutAdmin } from '../api/auth.js';
import { useNotification } from '../context/NotificationContext';

export default function AdminView({ user, onAuthChange, onSelectMode, onLogout }) {
  const toast = useNotification();
  const [adminUser, setAdminUser] = useState(user?.role === 'ADMIN' ? user : null);

  // Active Admin Console Tab: 'PRODUCTS' | 'SELLERS' | 'SYSTEM'
  const [adminTab, setAdminTab] = useState('PRODUCTS');

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

  // Artisan Management Actions state
  const [resetModalArtisan, setResetModalArtisan] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [deletingArtisanId, setDeletingArtisanId] = useState(null);
  const [approvingArtisanId, setApprovingArtisanId] = useState(null);
  const [rejectingArtisanId, setRejectingArtisanId] = useState(null);

  // Product Governance & Approval Queue state
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productStatusFilter, setProductStatusFilter] = useState('ALL');
  const [processingActionId, setProcessingActionId] = useState(null);

  // System Health State
  const [systemHealth, setSystemHealth] = useState(null);
  const [ondcStatus, setOndcStatus] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      setAdminUser(null);
    } else {
      setAdminUser(user);
    }
  }, [user]);

  const fetchOndcStatus = async () => {
    try {
      const res = await fetch('/api/ondc/status');
      if (res.ok) {
        const data = await res.json();
        setOndcStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch ONDC status:', e);
    }
  };

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

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await adminListProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to fetch platform products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const checkSystemHealth = async () => {
    try {
      const res = await fetch('/api/ready');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (e) {
      console.error('Health check failed', e);
    }
  };

  const fetchAllData = async () => {
    fetchSellers();
    fetchProducts();
    checkSystemHealth();
    fetchOndcStatus();
  };

  useEffect(() => {
    if (user?.role === 'ADMIN' || adminUser || getAdminToken()) {
      fetchAllData();
    }
  }, [user, adminUser]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await loginUser({
        email_or_phone: adminIdentifier,
        password: adminPassword,
        portal: 'ADMIN'
      });
      
      if (res.user.role !== 'ADMIN') {
        setLoginError(`Access Denied: Account '${res.user.email || adminIdentifier}' role is '${res.user.role}'. Only ADMIN accounts (e.g. admin@artisan.ai) can access the Admin Portal.`);
        return;
      }

      setAdminUser(res.user);
      onAuthChange(res.user);
      toast.success(`Welcome, Admin ${res.user.name}!`);
      fetchAllData();
    } catch (err) {
      setLoginError(err.message || 'Admin authentication failed. Please check credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    setAdminUser(null);
    if (onLogout) {
      onLogout();
    } else {
      if (onAuthChange) onAuthChange(null);
      if (onSelectMode) onSelectMode('HOME');
    }
    toast.info('Signed out of Admin Console');
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

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetModalArtisan || !resetPasswordValue || resetPasswordValue.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    setResetLoading(true);
    try {
      await adminResetArtisanPassword(resetModalArtisan.id, resetPasswordValue);
      toast.success(`Password for artisan "${resetModalArtisan.name}" reset successfully!`);
      setResetModalArtisan(null);
      setResetPasswordValue('');
    } catch (err) {
      toast.error(err.message || 'Failed to reset artisan password.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteArtisan = async (artisan) => {
    const confirmMsg = `Are you sure you want to permanently remove artisan "${artisan.name}"?\nThis will delete their seller account and products.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingArtisanId(artisan.id);
    try {
      await adminDeleteArtisan(artisan.id);
      toast.success(`Artisan "${artisan.name}" removed successfully.`);
      fetchSellers();
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to remove artisan.');
    } finally {
      setDeletingArtisanId(null);
    }
  };

  const handleApproveArtisan = async (artisan) => {
    setApprovingArtisanId(artisan.id);
    try {
      await adminApproveArtisan(artisan.id);
      toast.success(`Artisan "${artisan.name}" APPROVED! Account is now ACTIVE and can access Studio.`);
      fetchSellers();
    } catch (err) {
      toast.error(err.message || 'Failed to approve artisan application.');
    } finally {
      setApprovingArtisanId(null);
    }
  };

  const handleRejectArtisan = async (artisan) => {
    const confirmMsg = `Are you sure you want to REJECT / SUSPEND application for artisan "${artisan.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    setRejectingArtisanId(artisan.id);
    try {
      await adminRejectArtisan(artisan.id);
      toast.warning(`Artisan "${artisan.name}" application rejected / suspended.`);
      fetchSellers();
    } catch (err) {
      toast.error(err.message || 'Failed to reject artisan application.');
    } finally {
      setRejectingArtisanId(null);
    }
  };

  // Product Action Handlers
  const handleApproveProduct = async (id, title) => {
    setProcessingActionId(id);
    try {
      await adminApproveProduct(id);
      toast.success(`Product "${title}" APPROVED by Admin!`);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to approve product.');
    } finally {
      setProcessingActionId(null);
    }
  };

  const handlePublishProduct = async (id, title) => {
    setProcessingActionId(id);
    try {
      await adminPublishProduct(id);
      toast.success(`Product "${title}" PUBLISHED to Marketplace!`);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to publish product.');
    } finally {
      setProcessingActionId(null);
    }
  };

  const handleSuspendProduct = async (id, title) => {
    if (!window.confirm(`Are you sure you want to SUSPEND product "${title}"? It will be removed from buyer visibility.`)) return;
    setProcessingActionId(id);
    try {
      await adminSuspendProduct(id);
      toast.warning(`Product "${title}" SUSPENDED.`);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to suspend product.');
    } finally {
      setProcessingActionId(null);
    }
  };

  const handleDeleteProduct = async (id, title) => {
    if (!window.confirm(`MODERATION DELETE: Permanently delete product "${title}" from platform?`)) return;
    setProcessingActionId(id);
    try {
      await adminDeleteProduct(id);
      toast.success(`Product "${title}" deleted by moderation.`);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to delete product.');
    } finally {
      setProcessingActionId(null);
    }
  };

  // Calculated Dashboard Stats
  const pendingArtisans = sellers.filter(s => s.status === 'PENDING' || s.verification_status === 'PENDING_VERIFICATION');
  const activeArtisans = sellers.filter(s => s.status !== 'PENDING' && s.verification_status !== 'PENDING_VERIFICATION');

  const pendingCount = products.filter(p => p.status === 'PENDING_APPROVAL' || p.status === 'DRAFT').length;
  const approvedCount = products.filter(p => p.status === 'APPROVED').length;
  const publishedCount = products.filter(p => p.status === 'PUBLISHED').length;
  const suspendedCount = products.filter(p => p.status === 'SUSPENDED').length;

  const filteredProducts = productStatusFilter === 'ALL'
    ? products
    : products.filter(p => (p.status || 'DRAFT').toUpperCase() === productStatusFilter);

  // If user is not logged in as Admin, show Admin Login Portal
  if (!adminUser && user?.role !== 'ADMIN') {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 border border-[#E8E2D9] shadow-2xl space-y-6 text-xs text-[#1C1C1C]">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#1C1C1C] text-amber-400 flex items-center justify-center mx-auto shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A6533B] bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
            Master Platform Administration
          </span>
          <h2 className="text-2xl font-bold text-[#1C1C1C] pt-1">Admin Console Login</h2>
          <p className="text-[#6B6B6B]">
            Sign in with administrator credentials to manage platform users, review product approvals, and moderate governance.
          </p>
        </div>

        {user && user.role !== 'ADMIN' && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-center">
            <span className="font-bold">Logged in as:</span> {user.name} ({user.role})
            <p className="text-[11px] text-amber-800 mt-0.5">Please sign in below with administrator credentials (admin@artisan.ai) to access the Admin Console.</p>
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
                className="w-full pl-9 pr-3 py-2.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl outline-hidden focus:ring-2 focus:ring-[#1C1C1C]"
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
                className="w-full pl-9 pr-3 py-2.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl outline-hidden focus:ring-2 focus:ring-[#1C1C1C]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3 bg-[#1C1C1C] hover:bg-[#A6533B] text-white font-bold rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2 text-sm"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loginLoading ? 'Authenticating Admin...' : 'Sign In to Admin Console'}</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#E8E2D9]">
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

  // Admin Console Dashboard View
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans text-xs text-[#1C1C1C]">
      {/* Header Banner */}
      <div className="bg-[#1C1C1C] text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-stone-800">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#A6533B] text-white flex items-center justify-center font-bold text-xl shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ARTISAN AI ADMIN CONSOLE</h1>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                Platform Governance
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Welcome, <strong>{user?.name || adminUser?.name || 'Administrator'}</strong> • Moderate craft approvals, publish verified items, and provision artisans.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={fetchAllData}
            className="bg-white/10 hover:bg-white/20 text-stone-200 border border-white/20 text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1"
            title="Refresh Admin Console"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
            title="Sign Out of Admin Console"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider block">Artisans ({activeArtisans.length} Active)</span>
            {pendingArtisans.length > 0 && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                {pendingArtisans.length} Pending
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-[#1C1C1C]">{sellers.length}</span>
            <Users className="w-4 h-4 text-[#A6533B]" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider block">Total Platform Products</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-[#1C1C1C]">{products.length}</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider block">Pending Approval Queue</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-amber-600">{pendingCount}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider block">Live Published Crafts</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-emerald-600">{publishedCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center space-x-2 border-b border-[#E8E2D9] pb-3 overflow-x-auto">
        <button
          onClick={() => setAdminTab('PRODUCTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            adminTab === 'PRODUCTS'
              ? 'bg-[#1C1C1C] text-white shadow-md'
              : 'bg-white text-[#6B6B6B] border border-[#E8E2D9] hover:text-[#1C1C1C]'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Product Approvals & Governance ({products.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('SELLERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            adminTab === 'SELLERS'
              ? 'bg-[#1C1C1C] text-white shadow-md'
              : 'bg-white text-[#6B6B6B] border border-[#E8E2D9] hover:text-[#1C1C1C]'
          }`}
        >
          <Users className="w-4 h-4 text-amber-400" />
          <span>Artisans & Applications ({sellers.length})</span>
          {pendingArtisans.length > 0 && (
            <span className="bg-amber-400 text-stone-950 font-extrabold px-1.5 py-0.5 rounded-full text-[10px] animate-pulse">
              {pendingArtisans.length} PENDING
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('SYSTEM')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            adminTab === 'SYSTEM'
              ? 'bg-[#1C1C1C] text-white shadow-md'
              : 'bg-white text-[#6B6B6B] border border-[#E8E2D9] hover:text-[#1C1C1C]'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <span>System Readiness & Security</span>
        </button>
      </div>

      {/* TAB 1: PRODUCT APPROVALS & GOVERNANCE */}
      {adminTab === 'PRODUCTS' && (
        <div className="space-y-6">
          {/* Status Sub-Filters */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-[#E8E2D9]">
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              {['ALL', 'PENDING_APPROVAL', 'DRAFT', 'APPROVED', 'PUBLISHED', 'SUSPENDED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setProductStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    productStatusFilter === st
                      ? 'bg-[#A6533B] text-white'
                      : 'bg-[#FAF7F2] text-[#6B6B6B] border border-[#E8E2D9] hover:text-[#1C1C1C]'
                  }`}
                >
                  {st.replace('_', ' ')}
                  {st === 'ALL' && ` (${products.length})`}
                  {st === 'PENDING_APPROVAL' && ` (${products.filter(p => p.status === 'PENDING_APPROVAL').length})`}
                  {st === 'APPROVED' && ` (${approvedCount})`}
                  {st === 'PUBLISHED' && ` (${publishedCount})`}
                  {st === 'SUSPENDED' && ` (${suspendedCount})`}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-[#6B6B6B]">
              Showing <strong>{filteredProducts.length}</strong> items
            </span>
          </div>

          {/* Product Governance List */}
          {loadingProducts ? (
            <div className="bg-white p-12 rounded-3xl border border-[#E8E2D9] text-center text-[#6B6B6B]">
              Loading platform products for governance review...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-[#E8E2D9] text-center text-[#6B6B6B]">
              No products found in filter <strong>{productStatusFilter}</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProducts.map((p) => {
                const isProcessing = processingActionId === p.id;
                const statusUpper = (p.status || 'DRAFT').toUpperCase();

                return (
                  <div 
                    key={p.id} 
                    className="bg-white rounded-2xl border border-[#E8E2D9] p-4 flex flex-col justify-between space-y-3 shadow-xs hover:border-[#A6533B] transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-3 overflow-hidden">
                        <img 
                          src={p.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200&auto=format&fit=crop&q=80'} 
                          alt={p.title}
                          className="w-16 h-16 rounded-xl object-cover border border-[#E8E2D9] shrink-0"
                        />
                        <div className="truncate">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-[#1C1C1C] truncate text-sm">{p.title}</span>
                          </div>
                          <p className="text-[11px] text-[#6B6B6B] mt-0.5 truncate">
                            ID: #{p.id} • Seller ID: #{p.seller_id} • Category: {p.category || 'Craft'}
                          </p>
                          <span className="font-extrabold text-[#A6533B] text-xs mt-1 block">
                            ₹{Number(p.price || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase shrink-0 border ${
                        statusUpper === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : statusUpper === 'APPROVED'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : statusUpper === 'PENDING_APPROVAL'
                          ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                          : statusUpper === 'SUSPENDED'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-stone-100 text-stone-700 border-stone-300'
                      }`}>
                        {statusUpper}
                      </span>
                    </div>

                    {/* Admin Actions Footer */}
                    <div className="pt-3 border-t border-[#E8E2D9] flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center space-x-2">
                        {statusUpper !== 'APPROVED' && statusUpper !== 'PUBLISHED' && (
                          <button
                            onClick={() => handleApproveProduct(p.id, p.title)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all cursor-pointer flex items-center space-x-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}

                        {statusUpper === 'APPROVED' && (
                          <button
                            onClick={() => handlePublishProduct(p.id, p.title)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all cursor-pointer flex items-center space-x-1"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Publish to Market</span>
                          </button>
                        )}

                        {statusUpper === 'PUBLISHED' && (
                          <button
                            onClick={() => handleSuspendProduct(p.id, p.title)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all cursor-pointer flex items-center space-x-1"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Suspend</span>
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteProduct(p.id, p.title)}
                        disabled={isProcessing}
                        className="px-2.5 py-1.5 rounded-lg text-rose-700 hover:bg-rose-50 font-semibold transition-colors cursor-pointer flex items-center space-x-1 border border-rose-200"
                        title="Moderate / Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROVISION ARTISAN SELLERS & VERIFICATION QUEUE */}
      {adminTab === 'SELLERS' && (
        <div className="space-y-6">
          {/* Pending Artisan Applications Queue */}
          {pendingArtisans.length > 0 && (
            <div className="bg-amber-50/70 border-2 border-amber-300 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200 pb-3 flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shadow-xs">
                    <Clock className="w-5 h-5 text-stone-900 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#1C1C1C]">
                      Pending Artisan Applications ({pendingArtisans.length})
                    </h3>
                    <p className="text-xs text-amber-900 mt-0.5">
                      Review craft authenticity credentials and approve to grant Artisan Studio login access.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold bg-amber-200 text-amber-950 px-2.5 py-1 rounded-full border border-amber-400">
                  ACTION REQUIRED • {pendingArtisans.length} WAITING
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingArtisans.map((artisan) => (
                  <div
                    key={artisan.id}
                    className="bg-white rounded-2xl border border-amber-200 p-4 shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-[#1C1C1C]">{artisan.name}</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              PENDING REVIEW
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-[#A6533B] block mt-0.5">
                            {artisan.craft || 'Traditional Handicrafts'}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono">App #{artisan.id}</span>
                      </div>

                      <div className="text-[11px] text-[#6B6B6B] space-y-1 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                        <div>
                          <strong>Login ID:</strong> <span className="font-mono text-[#1C1C1C]">{artisan.phone || artisan.email || 'N/A'}</span>
                        </div>
                        <div>
                          <strong>Workshop / Location:</strong> {artisan.location || 'India'}
                        </div>
                        {artisan.bio && (
                          <p className="italic text-stone-600 line-clamp-2 mt-1">
                            "{artisan.bio}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t border-stone-100">
                      <button
                        type="button"
                        onClick={() => handleApproveArtisan(artisan)}
                        disabled={approvingArtisanId === artisan.id}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{approvingArtisanId === artisan.id ? 'Approving...' : 'Approve & Activate Studio'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejectArtisan(artisan)}
                        disabled={rejectingArtisanId === artisan.id}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>{rejectingArtisanId === artisan.id ? '...' : 'Reject'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Provision Form */}
            <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-[#E8E2D9] shadow-xs space-y-4">
            <div className="border-b border-[#E8E2D9] pb-3 flex items-center justify-between">
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
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1C1C] mb-1">Craft Specialization</label>
                  <input
                    type="text"
                    value={craft}
                    onChange={(e) => setCraft(e.target.value)}
                    placeholder="e.g. Kondapalli Toys & Woodcraft"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
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
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1C1C] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
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
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B]"
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
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl outline-hidden focus:ring-2 focus:ring-[#A6533B] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1C1C] mb-1">Artisan Verification Status</label>
                  <select
                    value={verificationStatus}
                    onChange={(e) => setVerificationStatus(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl text-[#1C1C1C] font-semibold"
                  >
                    <option value="GI_VERIFIED">Verified Master Artisan</option>
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

          {/* Right Column: Directory */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-[#E8E2D9] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-3">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-[#1C1C1C]" />
                  <h3 className="font-bold text-sm text-[#1C1C1C]">Active Provisioned Sellers ({activeArtisans.length})</h3>
                </div>
                <span className="text-[10px] text-[#6B6B6B]">Studio Access Enabled</span>
              </div>

              {loadingSellers ? (
                <div className="py-8 text-center text-[#6B6B6B]">Loading seller profiles...</div>
              ) : activeArtisans.length === 0 ? (
                <div className="py-8 text-center text-[#6B6B6B]">
                  No active artisan sellers provisioned yet.
                </div>
              ) : (
                <div className="divide-y divide-[#E8E2D9] max-h-96 overflow-y-auto pr-1">
                  {activeArtisans.map((s) => (
                    <div key={s.id} className="py-3 flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-3 overflow-hidden min-w-0">
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

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setResetModalArtisan(s);
                            setResetPasswordValue('');
                          }}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-[#933D1E] border border-amber-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                          title="Reset Artisan Password"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#933D1E]" />
                          <span>Reset</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteArtisan(s)}
                          disabled={deletingArtisanId === s.id}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                          title="Remove Artisan Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>{deletingArtisanId === s.id ? '...' : 'Remove'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* TAB 3: SYSTEM READINESS & SECURITY */}
      {adminTab === 'SYSTEM' && (
        <div className="bg-white p-6 rounded-3xl border border-[#E8E2D9] shadow-xs space-y-6">
          <div className="border-b border-[#E8E2D9] pb-3 flex items-center justify-between">
            <h3 className="font-bold text-base text-[#1C1C1C] flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Platform Security & System Health</span>
            </h3>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-300">
              V3 Domain Architecture Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E8E2D9]">
              <span className="text-[10px] font-bold text-[#6B6B6B] uppercase block">Database Connection</span>
              <span className="text-sm font-bold text-emerald-600 flex items-center mt-1">
                <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500" />
                {systemHealth?.database || 'Connected'}
              </span>
            </div>

            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E8E2D9]">
              <span className="text-[10px] font-bold text-[#6B6B6B] uppercase block">Registered Artisans</span>
              <span className="text-sm font-bold text-[#1C1C1C] mt-1 block">
                {sellers.length > 0 ? sellers.length : (systemHealth?.status === 'ready' ? '—' : 'Healthy')}
              </span>
            </div>

            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E8E2D9]">
              <span className="text-[10px] font-bold text-[#6B6B6B] uppercase block">AI Demand & Pricing Engine</span>
              <span className="text-sm font-bold text-emerald-600 flex items-center mt-1">
                <Sparkles className="w-4 h-4 mr-1 text-amber-500" />
                T+7 Model Loaded
              </span>
            </div>
          </div>

          {/* ONDC Integration Diagnostics */}
          <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8E2D9] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Store className="w-4 h-4 text-[#A6533B]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1C1C1C]">
                  ONDC Retail Network Integration (Beckn v1.2)
                </h4>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                ondcStatus?.verification_status === 'VERIFIED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : ondcStatus?.verification_status === 'CONFIGURED - NOT VERIFIED'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              }`}>
                {ondcStatus?.verification_status || 'NOT CONFIGURED'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-[#E8E2D9]">
                <span className="text-[10px] font-bold text-[#6B6B6B] block">Environment & Auth</span>
                <span className="font-bold text-[#1C1C1C] mt-0.5 block">{ondcStatus?.environment || 'DEVELOPMENT'}</span>
                <span className="text-[10px] text-[#8C827A] mt-0.5 block">{ondcStatus?.auth_mode || 'Permissive Mode'}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#E8E2D9]">
                <span className="text-[10px] font-bold text-[#6B6B6B] block">Participant ID (Subscriber)</span>
                <span className="font-bold text-[#1C1C1C] mt-0.5 block truncate" title={ondcStatus?.subscriber_id || 'Not configured'}>
                  {ondcStatus?.subscriber_id || 'Pending Onboarding'}
                </span>
                <span className="text-[10px] text-[#8C827A] mt-0.5 block">Key: {ondcStatus?.signing_configured ? 'Ed25519 Active' : 'Keys Pending'}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#E8E2D9]">
                <span className="text-[10px] font-bold text-[#6B6B6B] block">Retail Domains</span>
                <span className="font-bold text-[#1C1C1C] mt-0.5 block">{ondcStatus?.domain || 'ONDC:RET12'}</span>
                <span className="text-[10px] text-[#8C827A] mt-0.5 block">Supports: RET12, RET15</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#E8E2D9]">
                <span className="text-[10px] font-bold text-[#6B6B6B] block">Gateway Routing</span>
                <span className="font-bold text-[#1C1C1C] mt-0.5 block truncate">
                  {ondcStatus?.gateway_configured ? 'Configured' : 'Pending Onboarding'}
                </span>
                <span className="text-[10px] text-[#8C827A] mt-0.5 block">{ondcStatus?.city || 'std:080'} (Beckn v1.2)</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
              <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-800">Verification & Demo Status:</span>
              <p className="mt-0.5 text-xs text-amber-950 font-medium">
                {ondcStatus?.demo_statement || 'ONDC Retail seller-side discoverability foundation implemented; live network verification pending participant onboarding.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-[#E8E2D9]">
                <span className="text-[10px] font-bold text-[#6B6B6B] block">Last Protocol Interaction</span>
                <span className="font-medium text-[#1C1C1C] mt-0.5 block">
                  {ondcStatus?.last_protocol_interaction ? new Date(ondcStatus.last_protocol_interaction).toLocaleString() : 'No interactions recorded'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#E8E2D9]">
                <span className="text-[10px] font-bold text-[#6B6B6B] block">Last Successful Search Discovery</span>
                <span className="font-medium text-[#1C1C1C] mt-0.5 block">
                  {ondcStatus?.last_successful_search ? new Date(ondcStatus.last_successful_search).toLocaleString() : 'None yet'}
                </span>
              </div>
            </div>

            {ondcStatus?.recent_errors && ondcStatus.recent_errors.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                <span className="font-bold block mb-1">Recent Diagnostics / Errors:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  {ondcStatus.recent_errors.slice(0, 3).map((err, idx) => (
                    <li key={idx} className="truncate">
                      <span className="text-rose-700 font-mono">{new Date(err.timestamp).toLocaleTimeString()}:</span> {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 space-y-2 text-xs">
            <span className="font-bold flex items-center">
              <ShieldAlert className="w-4 h-4 text-amber-600 mr-1.5" />
              V3 Domain Architecture Guarantees:
            </span>
            <ul className="list-disc pl-5 space-y-1 text-amber-900">
              <li><strong>Marketplace Domain (/api/marketplace/*)</strong>: Buyer authentication & checkout only.</li>
              <li><strong>Artisan Studio Domain (/api/studio/*)</strong>: Artisan seller catalog & business tools only.</li>
              <li><strong>Admin Governance Domain (/api/admin/*)</strong>: Platform moderation & publication approval.</li>
              <li><strong>Publication Boundary</strong>: Artisans cannot directly self-publish unapproved products (`DRAFT` $\to$ `PUBLISHED` bypass blocked).</li>
            </ul>
          </div>
        </div>
      )}

      {/* Artisan Reset Password Modal */}
      {resetModalArtisan && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-[#E8E2D9] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D9]">
              <div className="flex items-center space-x-2 text-[#1C1C1C]">
                <KeyRound className="w-5 h-5 text-[#A6533B]" />
                <h3 className="font-bold text-base">Reset Artisan Password</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetModalArtisan(null);
                  setResetPasswordValue('');
                }}
                className="text-[#6B6B6B] hover:text-[#1C1C1C] p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#6B6B6B]">
              Set a new temporary or permanent password for <strong className="text-[#1C1C1C]">{resetModalArtisan.name}</strong> ({resetModalArtisan.email || resetModalArtisan.phone}). Active login tokens will be immediately invalidated.
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1C1C1C] mb-1">New Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E8E2D9] text-xs focus:outline-hidden focus:border-[#A6533B] bg-[#FAF7F2]"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetModalArtisan(null);
                    setResetPasswordValue('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B6B6B] hover:bg-gray-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading || resetPasswordValue.length < 6}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#A6533B] hover:bg-[#933D1E] text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {resetLoading ? <span>Saving...</span> : <span>Save New Password</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
