import { useState, useEffect } from 'react';
import { 
  PlusCircle, TrendingUp, Tag, Sparkles, Package, Wand2, RefreshCw,
  MessageSquare, ShoppingCart, Phone, ExternalLink, Store, ShieldCheck,
  Send, Truck, Check, Clock, CheckCircle2, BarChart3, Eye, Layers
} from 'lucide-react';
import ProductList from './ProductList';
import CreateProductModal from './CreateProductModal';
import ProductDetailModal from './ProductDetailModal';
import AICatalogStudioModal from './AICatalogStudioModal';
import CopilotWidget from './CopilotWidget';
import MarketDemandWidget from './MarketDemandWidget';
import { 
  getProducts, createProduct, updateProduct, deleteProduct, 
  getMarketDemand, getSellerOpportunities, getEnquiries, getOrders,
  replyToEnquiry, updateOrderStatus, getSellerDashboard, downloadAnalyticsCSV
} from '../api';
import { useOffline } from '../context/OfflineContext';
import { useNotification } from '../context/NotificationContext';
import { 
  getCachedProducts, setCachedProducts, 
  getCachedDemands, setCachedDemands, 
  getCachedCopilotInsight, setCachedCopilotInsight,
  getCachedOpportunities, setCachedOpportunities
} from '../services/offlineSync';

const TRACKING_STEPS = [
  { key: 'CONFIRMED', label: 'Confirmed', labelTe: 'ఖరారైంది' },
  { key: 'PROCESSING', label: 'Packed', labelTe: 'ప్యాక్ అయింది' },
  { key: 'SHIPPED', label: 'In Transit', labelTe: 'రవాణాలో ఉంది' },
  { key: 'DELIVERED', label: 'Delivered', labelTe: 'చేరింది' }
];

const getStepIndex = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'CONFIRMED': return 0;
    case 'PROCESSING': return 1;
    case 'SHIPPED': return 2;
    case 'DELIVERED': return 3;
    default: return -1;
  }
};

export default function SellView({ user, onOpenAuth, onSwitchMode }) {
  const notify = useNotification();
  const [products, setProducts] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('PRODUCTS'); // 'PRODUCTS' | 'ENQUIRIES' | 'ORDERS'
  const [demands, setDemands] = useState([]);
  const [copilotInsight, setCopilotInsight] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [notification, setNotification] = useState('');

  const [replyTexts, setReplyTexts] = useState({});
  const [editingReply, setEditingReply] = useState({});
  const [replyingEnquiryId, setReplyingEnquiryId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  const { isOffline, queueProductDraft, offlineQueue, removeDraft } = useOffline();

  const loadDashboard = async () => {
    setLoading(true);
    try {
      if (isOffline) {
        // Read from local cache + pending offline queue
        const cached = getCachedProducts();
        const queuedDrafts = offlineQueue
          .filter(item => item.type === 'CREATE_PRODUCT')
          .map(item => ({
            ...item.payload,
            id: item.client_temp_id,
            status: item.payload.status || 'DRAFT',
            isOfflineDraft: true
          }));

        // Deduplicate
        const merged = [...queuedDrafts, ...cached.filter(c => !c.isOfflineDraft)];
        setProducts(merged);
        setDemands(getCachedDemands());
        setCopilotInsight(getCachedCopilotInsight());
        setOpportunities(getCachedOpportunities());
      } else {
        const [prodsData, demandData, oppsData, enqsData, ordersData, dashData] = await Promise.all([
          getProducts(),
          getMarketDemand(),
          getSellerOpportunities(),
          getEnquiries('seller'),
          getOrders('seller'),
          getSellerDashboard()
        ]);

        // Cache products and intelligence locally for offline resilience
        setCachedProducts(prodsData);
        setCachedDemands(demandData);
        if (oppsData?.copilot_insight) {
          setCachedCopilotInsight(oppsData.copilot_insight);
        }
        if (oppsData?.opportunities) {
          setCachedOpportunities(oppsData.opportunities);
        }

        // Prepend any offline items that haven't synced yet
        const queuedDrafts = offlineQueue
          .filter(item => item.type === 'CREATE_PRODUCT')
          .map(item => ({
            ...item.payload,
            id: item.client_temp_id,
            status: item.payload.status || 'DRAFT',
            isOfflineDraft: true
          }));

        setProducts([...queuedDrafts, ...prodsData]);
        setDemands(demandData);
        setCopilotInsight(oppsData?.copilot_insight || null);
        setOpportunities(oppsData?.opportunities || []);
        setEnquiries(enqsData || []);
        setOrders(ordersData || []);
        setDashboardData(dashData || null);
      }
    } catch (err) {
      console.error('Error loading seller dashboard, falling back to cache:', err);
      const cached = getCachedProducts();
      setProducts(cached);
      setDemands(getCachedDemands());
      setCopilotInsight(getCachedCopilotInsight());
      setOpportunities(getCachedOpportunities());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [isOffline, offlineQueue.length]);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  const handleSendReply = async (enquiryId) => {
    const text = replyTexts[enquiryId];
    if (!text || !text.trim()) return;
    setReplyingEnquiryId(enquiryId);
    try {
      const updatedEnq = await replyToEnquiry(enquiryId, text.trim());
      setEnquiries(prev => prev.map(e => e.id === enquiryId ? updatedEnq : e));
      showNotification('Response sent to buyer! / మీ స్పందన పంపబడింది!');
      setEditingReply(prev => ({ ...prev, [enquiryId]: false }));
    } catch (err) {
      notify.error('Failed to send reply: ' + (err.message || 'Error occurred'));
    } finally {
      setReplyingEnquiryId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const updatedOrd = await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? updatedOrd : o));
      showNotification(`Order status updated to ${newStatus}! / ఆర్డర్ స్టేటస్ అప్‌డేట్ అయింది!`);
    } catch (err) {
      notify.error('Failed to update status: ' + (err.message || 'Error occurred'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleCreateProduct = async (formData) => {
    if (isOffline) {
      queueProductDraft(formData);
      showNotification(`Saved "${formData.title}" to local device queue (Pending Cloud Sync)!`);
      await loadDashboard();
      return;
    }

    try {
      const created = await createProduct(formData);
      showNotification(`Added "${created.title}" to your catalog!`);
      await loadDashboard();
    } catch (err) {
      queueProductDraft(formData);
      showNotification(`Network error. Safely queued "${formData.title}" to offline storage.`);
      await loadDashboard();
    }
  };

  const handleUpdateProduct = async (id, formData) => {
    if (isOffline) {
      showNotification('Cannot edit cloud product while offline. Reconnect to sync.');
      return;
    }
    const updated = await updateProduct(id, formData);
    showNotification(`Updated "${updated.title}" successfully.`);
    setSelectedProduct(updated);
    await loadDashboard();
  };

  const handleDeleteProduct = async (id) => {
    if (typeof id === 'string' && id.startsWith('draft_local_')) {
      removeDraft(id);
      showNotification('Offline draft removed from device.');
      if (selectedProduct?.id === id) {
        setSelectedProduct(null);
        setDetailModalOpen(false);
      }
      await loadDashboard();
      return;
    }

    if (isOffline) {
      showNotification('Cannot delete cloud product while offline.');
      return;
    }

    await deleteProduct(id);
    showNotification('Product deleted from catalog.');
    if (selectedProduct?.id === id) {
      setSelectedProduct(null);
      setDetailModalOpen(false);
    }
    await loadDashboard();
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setDetailModalOpen(true);
  };

  const handleCopilotAction = (insight) => {
    if (insight?.product_id) {
      const target = products.find((p) => p.id === insight.product_id);
      if (target) {
        setSelectedProduct(target);
        setDetailModalOpen(true);
        return;
      }
    }
    setIsCreateOpen(true);
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-14 bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white flex items-center justify-center mx-auto shadow-md">
          <Store className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Artisan Studio Login Required</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
            You are currently signed out. Please sign in to access your private artisan studio, manage your craft catalog, review customer orders, and answer wholesale buyer enquiries.
          </p>
        </div>
        <div className="pt-3 flex justify-center">
          <button
            onClick={onOpenAuth}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Sign In to Artisan Studio
          </button>
        </div>
      </div>
    );
  }

  if (user?.role === 'BUYER') {
    return (
      <div className="max-w-xl mx-auto my-14 bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center mx-auto shadow-md">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 mb-2">
            Buyer Account (కొనుగోలుదారు)
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">You are logged in as a Buyer</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
            Namaste <strong>{user.name}</strong>! Your account is registered as a <strong>Connoisseur / Buyer</strong>. Artisan Studio is reserved for master craft creators to list crafts, configure pricing, and manage inventory.
          </p>
        </div>
        <div className="pt-3 flex justify-center">
          <button
            onClick={() => onSwitchMode?.('BUY')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Explore Buyer Marketplace (హస్తకళలు కొనండి)
          </button>
        </div>
      </div>
    );
  }

  const myProducts = products.filter((p) => !p.seller_id || p.seller_id === user?.id || user?.role === 'ADMIN');
  const totalUnits = myProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalCatalogValue = myProducts.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
  const topDemandCategory = demands && demands.length > 0 ? demands[0] : null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs transition-all">
          <span>{notification}</span>
          <button onClick={() => setNotification('')} className="text-emerald-600 hover:text-emerald-900 ml-2">✕</button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-orange-600 rounded-2xl p-6 text-white shadow-lg shadow-amber-900/10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-amber-800/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-amber-200 mb-2 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seller Studio Active</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Namaste, {user?.name || 'Artisan'}!</h1>
            <p className="text-amber-100 text-sm mt-1">
              Craft: <span className="font-semibold text-white">{user?.craft || 'Handicrafts'}</span> • Location: {user?.location || 'India'}
            </p>
          </div>
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
            <button
              onClick={loadDashboard}
              className="p-2.5 bg-amber-800/50 hover:bg-amber-800 text-amber-200 rounded-xl transition-colors"
              title="Refresh Live Metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* AI Catalog Button */}
            <button
              id="ai-studio-btn"
              onClick={() => setIsAIOpen(true)}
              className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Wand2 className="w-4 h-4 text-amber-400" />
              <span>AI Voice Catalog</span>
            </button>

            {/* Standard Add */}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center space-x-2 bg-white text-amber-900 hover:bg-amber-50 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-700" />
              <span>Manual Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Business Copilot Recommendation Widget */}
      <CopilotWidget
        copilotInsight={copilotInsight}
        opportunities={opportunities}
        onActionTaken={handleCopilotAction}
        onOpenEnquiries={() => setActiveTab('ENQUIRIES')}
      />

      {/* Live Calculated Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: My Crafts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">My Crafts (ఉత్పత్తులు)</span>
              <span className="text-[11px] text-slate-400">Total catalog listings</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{myProducts.length} Products</p>
          <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-slate-500">Ready Stock:</span>
            <span className="font-bold text-slate-800">{totalUnits} units</span>
          </div>
        </div>

        {/* Card 2: Total Stock Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Stock Value (సరుకు విలువ)</span>
              <span className="text-[11px] text-slate-400">Total worth of ready units</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">₹{totalCatalogValue.toLocaleString('en-IN')}</p>
          <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-slate-500">Potential Income:</span>
            <span className="font-bold text-indigo-700">If all units sell</span>
          </div>
        </div>

        {/* Card 3: Top Market Demand */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Buyer Demand (కొనుగోలు ఆసక్తి)</span>
              <span className="text-[11px] text-slate-400">Market search trends</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">
            {topDemandCategory ? topDemandCategory.demand_pct_label : '+15%'}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-slate-500">Trending Category:</span>
            <span className="font-bold text-emerald-700 truncate max-w-[120px]">
              {topDemandCategory ? (topDemandCategory.category === 'Other' ? 'Crafts' : topDemandCategory.category) : 'Handmade'}
            </span>
          </div>
        </div>

        {/* Card 4: Margin Protection */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Profit Lock (కనీస లాభం)</span>
              <span className="text-[11px] text-slate-400">Guaranteed fair price shield</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">≥ 20% Profit Lock</p>
          <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-slate-500">Wage Protection:</span>
            <span className="font-bold text-emerald-800">Materials + Daily Wage</span>
          </div>
        </div>
      </div>

      {/* Regional Craft Market Demand */}
      <MarketDemandWidget demands={demands} />

      {/* Studio Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 flex-wrap gap-y-2">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'PRODUCTS'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>My Crafts ({myProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ENQUIRIES')}
          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'ENQUIRIES'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Buyer Enquiries ({enquiries.length})</span>
          {enquiries.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ml-1">
              {enquiries.length} New
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ORDERS'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Customer Orders ({orders.length})</span>
          {orders.length > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ml-1">
              {orders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ANALYTICS')}
          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ANALYTICS'
              ? 'bg-amber-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-500" />
          <span>📊 Business Analytics (విశ్లేషణలు)</span>
        </button>
      </div>

      {/* Tab 1: Products List */}
      {activeTab === 'PRODUCTS' && (
        loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500">Loading catalog...</p>
          </div>
        ) : (
          <ProductList
            products={myProducts}
            currentUser={user}
            onSelectProduct={handleSelectProduct}
            onEditProduct={handleSelectProduct}
            onDeleteProduct={handleDeleteProduct}
            onAddProduct={() => setIsAIOpen(true)}
          />
        )
      )}

      {/* Tab 2: Buyer Enquiries List */}
      {activeTab === 'ENQUIRIES' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900">Direct Buyer Wholesale Enquiries</h3>
              <p className="text-xs text-slate-500">Inquiries and custom bulk requests received directly from buyers</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {enquiries.length} {enquiries.length === 1 ? 'Enquiry' : 'Enquiries'}
            </span>
          </div>

          {enquiries.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-700">No buyer enquiries yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                When buyers or retail partners request bulk crafts or custom work, their contact leads will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {enquiries.map((enq) => (
                <div key={enq.id} className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    {enq.product_image ? (
                      <img src={enq.product_image} alt={enq.product_title || 'Craft'} className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700 font-bold text-xs">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-sm">{enq.buyer_name}</h4>
                        <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px] border border-amber-300">
                          Bulk Request: {enq.quantity} unit(s)
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-600 mt-0.5">
                        Craft: <span className="font-semibold text-slate-800">{enq.product_title || `Product #${enq.product_id}`}</span>
                      </p>
                      {enq.message && (
                        <p className="text-xs text-slate-700 mt-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 italic max-w-lg">
                          "{enq.message}"
                        </p>
                      )}

                      {/* Artisan Response Section */}
                      {enq.artisan_reply && !editingReply[enq.id] ? (
                        <div className="mt-2.5 p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-xl max-w-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-900 flex items-center">
                              <MessageSquare className="w-3 h-3 text-indigo-600 inline mr-1" />
                              Your Response / మీ స్పందన:
                            </span>
                            <button 
                              onClick={() => setEditingReply(prev => ({ ...prev, [enq.id]: true }))}
                              className="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer"
                            >
                              Edit Response
                            </button>
                          </div>
                          <p className="text-xs text-indigo-950 font-medium mt-0.5">"{enq.artisan_reply}"</p>
                          {enq.replied_at && (
                            <p className="text-[10px] text-indigo-500 mt-0.5">
                              Sent: {new Date(enq.replied_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-lg">
                          <input
                            type="text"
                            placeholder="Type response to buyer (e.g. Yes, ready in 10 days / ధర వివరాలు)..."
                            value={replyTexts[enq.id] !== undefined ? replyTexts[enq.id] : (enq.artisan_reply || '')}
                            onChange={(e) => setReplyTexts(prev => ({ ...prev, [enq.id]: e.target.value }))}
                            className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white shadow-2xs"
                          />
                          <button
                            onClick={() => handleSendReply(enq.id)}
                            disabled={replyingEnquiryId === enq.id || !(replyTexts[enq.id] !== undefined ? replyTexts[enq.id] : (enq.artisan_reply || '')).trim()}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1 shrink-0"
                          >
                            <Send className="w-3 h-3" />
                            <span>{replyingEnquiryId === enq.id ? 'Sending...' : 'Send Reply'}</span>
                          </button>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-400 mt-2">
                        Received: {new Date(enq.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>

                  {enq.buyer_phone && (
                    <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                      <a
                        href={`tel:${enq.buyer_phone}`}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call {enq.buyer_phone}</span>
                      </a>
                      <a
                        href={`https://wa.me/${enq.buyer_phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Customer Orders List */}
      {activeTab === 'ORDERS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900">Direct Customer Orders</h3>
              <p className="text-xs text-slate-500">Confirmed orders placed by marketplace customers</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-700">No customer orders yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Orders placed by buyers will appear here with delivery addresses and order totals.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((ord) => {
                const currentIdx = getStepIndex(ord.status);
                return (
                  <div key={ord.id} className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start space-x-3.5">
                        {ord.product_image ? (
                          <img src={ord.product_image} alt={ord.product_title || 'Craft'} className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-700 font-bold text-xs">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">Order #{ord.id}</span>
                            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] border ${
                              ord.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                              ord.status === 'SHIPPED' ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                              ord.status === 'PROCESSING' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                              'bg-slate-100 text-slate-800 border-slate-300'
                            }`}>
                              {ord.status}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              ₹{ord.total_price?.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-700 mt-0.5">
                            Craft: <span className="font-semibold text-slate-900">{ord.product_title || `Product #${ord.product_id}`}</span> (Qty: {ord.quantity})
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Buyer: <strong className="text-slate-700">{ord.buyer_name}</strong> {ord.buyer_phone ? `(${ord.buyer_phone})` : ''}
                          </p>
                          <p className="text-xs text-slate-600 mt-1">
                            Delivery Address: <span className="italic">{ord.delivery_address}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Ordered: {new Date(ord.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>

                      {/* Status Action Buttons for Artisan */}
                      <div className="shrink-0 self-end sm:self-center">
                        {ord.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(ord.id, 'PROCESSING')}
                            disabled={updatingOrderId === ord.id}
                            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>{updatingOrderId === ord.id ? 'Updating...' : 'Mark as Packed 📦'}</span>
                          </button>
                        )}
                        {ord.status === 'PROCESSING' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(ord.id, 'SHIPPED')}
                            disabled={updatingOrderId === ord.id}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>{updatingOrderId === ord.id ? 'Updating...' : 'Dispatch & Ship 🚚'}</span>
                          </button>
                        )}
                        {ord.status === 'SHIPPED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(ord.id, 'DELIVERED')}
                            disabled={updatingOrderId === ord.id}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{updatingOrderId === ord.id ? 'Updating...' : 'Mark Delivered ✅'}</span>
                          </button>
                        )}
                        {ord.status === 'DELIVERED' && (
                          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl inline-flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Order Completed ✅</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Flipkart-Style Visual Delivery Tracker Bar */}
                    <div className="w-full mt-2 p-3 bg-slate-50/90 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between relative">
                        {TRACKING_STEPS.map((step, idx) => {
                          const isDone = currentIdx > idx || ord.status === 'DELIVERED';
                          const isCurrent = currentIdx === idx;
                          return (
                            <div key={step.key} className="flex-1 flex flex-col items-center relative z-10">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-2xs ${
                                isDone 
                                  ? 'bg-emerald-600 text-white' 
                                  : isCurrent 
                                    ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse' 
                                    : 'bg-slate-200 text-slate-500'
                              }`}>
                                {isDone ? <Check className="w-4 h-4" /> : (idx + 1)}
                              </div>
                              <span className={`text-[11px] font-bold mt-1 text-center ${
                                isCurrent ? 'text-amber-700 font-extrabold' : isDone ? 'text-emerald-700' : 'text-slate-400'
                              }`}>
                                {step.label}
                              </span>
                              <span className="text-[9px] text-slate-400 text-center">{step.labelTe}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Business & Sales Analytics */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          {/* Key Performance Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-2xl border border-amber-200/80 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">Total Sales / మొత్తం ఆదాయం</span>
                  <span className="text-[11px] text-amber-600">Earnings from sales</span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm">
                  ₹
                </div>
              </div>
              <p className="text-3xl font-black text-amber-950 mt-2">
                ₹{(dashboardData?.total_revenue || 0).toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-amber-700 mt-1 font-medium">Direct earnings to artisan</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">Units Sold / అమ్మకాలు</span>
                  <span className="text-[11px] text-emerald-600">Total items sold</span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-emerald-950 mt-2">
                {dashboardData?.units_sold || 0} Crafts
              </p>
              <p className="text-[11px] text-emerald-700 mt-1 font-medium">Handcrafted items sent to customers</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-200/80 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800 block">Craft Views / చూసిన సంఖ్య</span>
                  <span className="text-[11px] text-blue-600">Product detail views</span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-blue-950 mt-2">
                {dashboardData?.total_views || 0} Views
              </p>
              <p className="text-[11px] text-blue-700 mt-1 font-medium">Buyer interest & search exposure</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-2xl border border-purple-200/80 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-800 block">Orders Placed / ఆర్డర్లు</span>
                  <span className="text-[11px] text-purple-600">Total order requests</span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-purple-950 mt-2">
                {dashboardData?.total_orders || 0} Orders
              </p>
              <p className="text-[11px] text-purple-700 mt-1 font-medium">Customer checkout requests</p>
            </div>
          </div>

          {/* Delivery Status Pipeline Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-600" />
              <span>Delivery Pipeline Breakdown / డెలివరీ ప్రగతి</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Live status of your orders across fulfillment stages</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Confirmed / ఖరారైంది</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">{dashboardData?.delivery_status?.confirmed || 0}</span>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <span className="text-[11px] font-bold text-amber-700 uppercase block">Packed / ప్యాకింగ్</span>
                <span className="text-xl font-black text-amber-900 mt-1 block">{dashboardData?.delivery_status?.processing || 0}</span>
              </div>
              <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                <span className="text-[11px] font-bold text-indigo-700 uppercase block">In Transit / రవాణాలో</span>
                <span className="text-xl font-black text-indigo-900 mt-1 block">{dashboardData?.delivery_status?.shipped || 0}</span>
              </div>
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <span className="text-[11px] font-bold text-emerald-700 uppercase block">Delivered / చేరింది</span>
                <span className="text-xl font-black text-emerald-900 mt-1 block">{dashboardData?.delivery_status?.delivered || 0}</span>
              </div>
            </div>
          </div>

          {/* Per-Product Analytics Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Per-Product Sales & View Metrics / ఉత్పత్తి వివరాలు</h3>
                <p className="text-xs text-slate-500">Sales volume, total views, and revenue generated per craft listing</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadAnalyticsCSV}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                  title="Download Sales & Cost Basis Report"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Export CSV Report</span>
                </button>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  {(dashboardData?.product_performance || []).length} Products
                </span>
              </div>
            </div>

            {!dashboardData?.product_performance || dashboardData.product_performance.length === 0 ? (
              <div className="p-10 text-center">
                <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No product analytics recorded yet. Add crafts to track sales!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Craft Item / హస్తకళ</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4 text-center">Views / చూసిన వారు</th>
                      <th className="py-3 px-4 text-center">Units Sold / విక్రయాలు</th>
                      <th className="py-3 px-4 text-right">Total Revenue / మొత్తం రాబడి</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboardData.product_performance.map((item) => (
                      <tr key={item.product_id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.title} className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 font-bold text-amber-800 text-[10px]">
                                Craft
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-slate-900 block">{item.title}</span>
                              <span className="text-[10px] text-slate-400">ID: #{item.product_id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          ₹{item.price?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            item.stock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {item.stock} ready
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-blue-700">
                          👁️ {item.views}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700">
                          📦 {item.units_sold}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          ₹{item.revenue?.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Voice Catalog Studio Modal */}
      <AICatalogStudioModal
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        onPublished={async (msg) => {
          showNotification(msg);
          await loadDashboard();
        }}
      />

      {/* Manual Add Modal */}
      <CreateProductModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreateProduct}
      />

      {/* Product Detail & Edit Modal */}
      <ProductDetailModal
        product={selectedProduct}
        currentUser={user}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onUpdated={handleUpdateProduct}
        onDelete={handleDeleteProduct}
      />
    </div>
  );
}
