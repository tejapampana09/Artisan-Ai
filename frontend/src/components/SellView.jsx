import React, { useState, useEffect } from 'react';
import { PlusCircle, TrendingUp, Tag, Sparkles, Package, Wand2, RefreshCw } from 'lucide-react';
import ProductList from './ProductList';
import CreateProductModal from './CreateProductModal';
import ProductDetailModal from './ProductDetailModal';
import AICatalogStudioModal from './AICatalogStudioModal';
import CopilotWidget from './CopilotWidget';
import MarketDemandWidget from './MarketDemandWidget';
import { getProducts, createProduct, updateProduct, deleteProduct, getMarketDemand, getSellerOpportunities } from '../api';
import { useOffline } from '../context/OfflineContext';
import { getCachedProducts, setCachedProducts } from '../services/offlineSync';

export default function SellView({ user }) {
  const [products, setProducts] = useState([]);
  const [demands, setDemands] = useState([]);
  const [copilotInsight, setCopilotInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [notification, setNotification] = useState('');

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
        setDemands([
          { category: 'Kalamkari', demand_score: 95, base_benchmark: '₹1,150 - ₹1,400', demand_pct_label: '+32% (Offline Cache)' },
          { category: 'Dokra', demand_score: 82, base_benchmark: '₹1,350 - ₹1,650', demand_pct_label: '+18% (Offline Cache)' }
        ]);
        setCopilotInsight({
          product_id: 1,
          type: 'PRICE_OPTIMIZATION',
          title: 'Offline Cached Insight: Kalamkari High Demand',
          message: 'Buyer interactions indicate strong demand. Ready to analyze upon cloud reconnection.',
          action_label: 'View Local Recommendation',
          metric: '+32% cluster surge'
        });
      } else {
        const [prodsData, demandData, oppsData] = await Promise.all([
          getProducts(),
          getMarketDemand(),
          getSellerOpportunities()
        ]);

        // Cache products locally
        setCachedProducts(prodsData);

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
        setCopilotInsight(oppsData.copilot_insight);
      }
    } catch (err) {
      console.error('Error loading seller dashboard, falling back to cache:', err);
      const cached = getCachedProducts();
      setProducts(cached);
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

  const totalUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalCatalogValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
  const topDemandCategory = demands.length > 0 ? demands[0] : { category: 'Kalamkari', demand_pct_label: '+32%' };

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
              Craft: <span className="font-semibold text-white">{user?.craft}</span> • Location: {user?.location}
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

      {/* AI Business Copilot Recommendation Widget (Step 5 Core Brain) */}
      <CopilotWidget
        copilotInsight={copilotInsight}
        onActionTaken={handleCopilotAction}
      />

      {/* Live Calculated Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live Catalog</span>
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{products.length} Products</p>
          <p className="text-xs text-slate-500 mt-1">{totalUnits} units total stock</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Catalog Valuation</span>
            <Tag className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">₹{totalCatalogValue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-1">At current listing prices</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top Market Demand</span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{topDemandCategory.demand_pct_label}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">{topDemandCategory.category} category</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Margin Protection</span>
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">≥ 20% Guard</p>
          <p className="text-xs text-slate-500 mt-1">Deterministic cost baseline</p>
        </div>
      </div>

      {/* Regional Craft Market Demand (Calculated from events) */}
      <MarketDemandWidget demands={demands} />

      {/* Product List Section */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading catalog...</p>
        </div>
      ) : (
        <ProductList
          products={products}
          currentUser={user}
          onSelectProduct={handleSelectProduct}
          onEditProduct={handleSelectProduct}
          onDeleteProduct={handleDeleteProduct}
          onAddProduct={() => setIsAIOpen(true)}
        />
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
