import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Heart, Sparkles, Filter, MapPin, Send, Eye, Flame, CheckCircle2 } from 'lucide-react';
import BuyerProductModal from './BuyerProductModal';
import BuyerOrderModal from './BuyerOrderModal';
import { getProducts, getTrendingProducts, recordEvent } from '../api/index.js';
import { getSavedProductIds, saveProductId, removeSavedProductId } from '../services/offlineSync';

const CATEGORIES = [
  'All Crafts',
  'Kalamkari',
  'Wooden Toys',
  'Blue Pottery',
  'Bidriware',
  'Pochampally Ikat'
];

export default function BuyView({ user, onOpenAuth }) {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All Crafts');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedProductIds, setSavedProductIds] = useState(() => new Set(getSavedProductIds(user?.id)));
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [orderModal, setOrderModal] = useState({ isOpen: false, product: null, mode: 'ORDER' });
  const [tickerTrigger, setTickerTrigger] = useState(0);
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(true);

  // Search debounce ref
  const searchTimeoutRef = useRef(null);

  const loadMarketplace = async () => {
    setLoading(true);
    try {
      const [allProds, trendProds] = await Promise.all([
        getProducts({ status: 'PUBLISHED' }),
        getTrendingProducts()
      ]);
      setProducts(allProds);
      setTrending(trendProds);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplace();
  }, []);

  const triggerEventRefresh = () => {
    setTickerTrigger((prev) => prev + 1);
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
    triggerEventRefresh();
  };

  // Handle Search & Record SEARCH Event
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        await recordEvent({
          event_type: 'SEARCH',
          query: val.trim(),
          category: selectedCategory !== 'All Crafts' ? selectedCategory : null,
          metadata_info: `Buyer searched for "${val.trim()}"`
        });
        triggerEventRefresh();
      }, 700);
    }
  };

  // Handle Category Filter
  const handleCategorySelect = async (cat) => {
    setSelectedCategory(cat);
    if (cat !== 'All Crafts') {
      await recordEvent({
        event_type: 'SEARCH',
        category: cat,
        query: `Browse category: ${cat}`,
        metadata_info: `Category filter: ${cat}`
      });
      triggerEventRefresh();
    }
  };

  // Handle Save / Wishlist
  const handleToggleSave = async (product) => {
    const isSaved = savedProductIds.has(product.id);
    const updated = new Set(savedProductIds);
    if (isSaved) {
      updated.delete(product.id);
      removeSavedProductId(user?.id, product.id);
    } else {
      updated.add(product.id);
      saveProductId(user?.id, product.id);
      await recordEvent({
        event_type: 'SAVE',
        product_id: product.id,
        category: product.category,
        metadata_info: `Saved "${product.title}" to wishlist`
      });
      showNotification(`Saved "${product.title}" to your wishlist! (SAVE event recorded)`);
      triggerEventRefresh();
    }
    setSavedProductIds(updated);
  };

  // Filter products by category and search
  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategory === 'All Crafts' || p.category === selectedCategory;
    const matchQuery = !searchQuery.trim() || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.materials && p.materials.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchQuery;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs transition-all">
          <span>{notification}</span>
          <button onClick={() => setNotification('')} className="text-indigo-600 hover:text-indigo-900 ml-2">✕</button>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-950/20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-indigo-800/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-indigo-200 mb-2 border border-indigo-500/30">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Buyer Marketplace (Closed-Loop Market Linkage)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Direct Heritage Crafts from Traditional Artisans</h1>
          <p className="text-indigo-200 text-xs sm:text-sm mt-1 leading-relaxed">
            Eliminate middlemen. Every view, save, and order directly feeds our Market Intelligence Engine to empower rural makers with fair prices.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mt-5 flex items-center bg-white/10 backdrop-blur-md rounded-xl p-1.5 border border-white/20 max-w-xl shadow-inner">
          <Search className="w-5 h-5 text-indigo-300 ml-2.5 mr-2 shrink-0" />
          <input
            id="marketplace-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search Kalamkari, Channapatna toys, Blue pottery..."
            className="w-full bg-transparent text-white placeholder-indigo-300 text-sm focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="text-indigo-300 hover:text-white text-xs px-2"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategorySelect(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Trending Products Carousel */}
      {trending.length > 0 && selectedCategory === 'All Crafts' && !searchQuery && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span>Trending Heritage Crafts</span>
            </h3>
            <span className="text-[11px] text-slate-500">Ranked by buyer interest velocity</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {trending.slice(0, 4).map((p) => (
              <div
                key={`trend-${p.id}`}
                onClick={() => {
                  setSelectedProduct(p);
                  setIsDetailOpen(true);
                  triggerEventRefresh();
                }}
                className="bg-white p-3 rounded-xl border border-orange-200/80 hover:border-orange-400 transition-all cursor-pointer shadow-xs group"
              >
                <div className="relative rounded-lg overflow-hidden h-28 bg-slate-100">
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    High Demand
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2 truncate">{p.title}</h4>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs font-extrabold text-indigo-700">₹{p.price.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-slate-500">{p.category}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Marketplace Grid */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900">
            {selectedCategory === 'All Crafts' ? 'All Artisan Collections' : `${selectedCategory} Collection`}
          </h3>
          <span className="text-xs text-slate-500">{filteredProducts.length} crafts available</span>
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500">Loading marketplace crafts...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No crafts matched your filter or search.</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search query or selecting "All Crafts".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const isSaved = savedProductIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Image with quick-save */}
                    <div className="relative h-48 bg-slate-100 overflow-hidden">
                      <img
                        src={p.image_url}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                        onClick={() => {
                          setSelectedProduct(p);
                          setIsDetailOpen(true);
                          triggerEventRefresh();
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSave(p);
                        }}
                        className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                          isSaved
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'bg-white/80 text-slate-600 hover:text-rose-600 hover:bg-white'
                        }`}
                        title="Save Craft (SAVE event)"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                      </button>
                      <span className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-xs">
                        {p.category}
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="p-4 space-y-1.5">
                      <h4
                        className="font-bold text-slate-900 text-sm hover:text-indigo-600 cursor-pointer line-clamp-1"
                        onClick={() => {
                          setSelectedProduct(p);
                          setIsDetailOpen(true);
                          triggerEventRefresh();
                        }}
                      >
                        {p.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {p.description || p.craft_story}
                      </p>
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="p-4 pt-0 border-t border-slate-100 mt-2 space-y-2.5">
                    <div className="flex justify-between items-baseline pt-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Direct Fair Price</span>
                        <span className="text-base font-extrabold text-slate-900">₹{p.price.toLocaleString('en-IN')}</span>
                      </div>
                      {p.stock > 0 ? (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {p.stock} in stock
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          Out of Stock
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setIsDetailOpen(true);
                          triggerEventRefresh();
                        }}
                        className="inline-flex items-center justify-center space-x-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      {user && p.seller_id === user.id ? (
                        <span 
                          className="inline-flex items-center justify-center space-x-1 py-2 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl cursor-default"
                          title="This is your own listed craft. Self-purchase is disabled."
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                          <span>Your Craft</span>
                        </span>
                      ) : p.stock <= 0 ? (
                        <button
                          onClick={() => {
                            if (!user) {
                              onOpenAuth?.();
                              return;
                            }
                            setOrderModal({ isOpen: true, product: p, mode: 'ENQUIRY' });
                          }}
                          className="inline-flex items-center justify-center space-x-1 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
                          title="Out of stock for direct checkout. Click to request a custom batch or pre-order."
                        >
                          <Send className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pre-Order</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (!user) {
                              onOpenAuth?.();
                              return;
                            }
                            setOrderModal({ isOpen: true, product: p, mode: 'ORDER' });
                          }}
                          className="inline-flex items-center justify-center space-x-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Buy Now</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Details Modal (tracks VIEW event) */}
      <BuyerProductModal
        product={selectedProduct}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        isSaved={selectedProduct ? savedProductIds.has(selectedProduct.id) : false}
        onToggleSave={handleToggleSave}
        user={user}
        onOpenAuth={onOpenAuth}
        onOpenOrder={(prod) => {
          if (!user) {
            onOpenAuth?.();
            return;
          }
          setOrderModal({ isOpen: true, product: prod, mode: 'ORDER' });
        }}
        onOpenEnquiry={(prod) => {
          if (!user) {
            onOpenAuth?.();
            return;
          }
          setOrderModal({ isOpen: true, product: prod, mode: 'ENQUIRY' });
        }}
      />

      {/* Order / B2B Enquiry Modal */}
      <BuyerOrderModal
        product={orderModal.product}
        mode={orderModal.mode}
        isOpen={orderModal.isOpen}
        user={user}
        onOpenAuth={onOpenAuth}
        onClose={() => setOrderModal({ isOpen: false, product: null, mode: 'ORDER' })}
        onSuccess={(msg) => {
          showNotification(msg);
          loadMarketplace();
          triggerEventRefresh();
        }}
      />
    </div>
  );
}
