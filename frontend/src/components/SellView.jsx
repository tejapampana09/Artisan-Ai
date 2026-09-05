import React, { useState, useEffect } from 'react';
import { PlusCircle, TrendingUp, Tag, Sparkles, Package, AlertCircle } from 'lucide-react';
import ProductList from './ProductList';
import CreateProductModal from './CreateProductModal';
import ProductDetailModal from './ProductDetailModal';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api';

export default function SellView({ user }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [notification, setNotification] = useState('');

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  const handleCreateProduct = async (formData) => {
    const created = await createProduct(formData);
    showNotification(`Added "${created.title}" to your catalog!`);
    await loadProducts();
  };

  const handleUpdateProduct = async (id, formData) => {
    const updated = await updateProduct(id, formData);
    showNotification(`Updated "${updated.title}" successfully.`);
    setSelectedProduct(updated);
    await loadProducts();
  };

  const handleDeleteProduct = async (id) => {
    await deleteProduct(id);
    showNotification('Product deleted from catalog.');
    if (selectedProduct?.id === id) {
      setSelectedProduct(null);
      setDetailModalOpen(false);
    }
    await loadProducts();
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setDetailModalOpen(true);
  };

  const totalUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalCatalogValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);

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
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center space-x-2 bg-white text-amber-900 hover:bg-amber-50 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-700" />
            <span>+ Add New Craft</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
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
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Market Demand</span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">+32%</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">High interest in Kalamkari</p>
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

      {/* Product List Section */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading catalog...</p>
        </div>
      ) : (
        <ProductList
          products={products}
          onSelectProduct={handleSelectProduct}
          onEditProduct={handleSelectProduct}
          onDeleteProduct={handleDeleteProduct}
          onAddProduct={() => setIsCreateOpen(true)}
        />
      )}

      {/* Create Product Modal */}
      <CreateProductModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreateProduct}
      />

      {/* Product Detail & Edit Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onUpdated={handleUpdateProduct}
        onDelete={handleDeleteProduct}
      />
    </div>
  );
}
