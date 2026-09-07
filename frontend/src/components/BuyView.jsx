import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Heart, Sparkles, Filter, MapPin, Send, Eye, Flame, CheckCircle2, SlidersHorizontal, RefreshCw, Bot } from 'lucide-react';
import BuyerProductModal from './BuyerProductModal';
import BuyerOrderModal from './BuyerOrderModal';
import BuyerAssistantModal from './BuyerAssistantModal';
import { getProducts, getTrendingProducts, recordEvent } from '../api/index.js';
import { getSavedProductIds, saveProductId, removeSavedProductId } from '../services/offlineSync';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getLocalizedProductField } from '../utils/multilingual.js';

const CATEGORIES = [
  'All Crafts',
  'Kalamkari',
  'Wooden Toys',
  'Blue Pottery',
  'Bidriware',
  'Pochampally Ikat'
];

export default function BuyView({ user, onOpenAuth }) {
  const { language, t, getCategoryTranslation } = useLanguage();
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All Crafts');
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [savedProductIds, setSavedProductIds] = useState(() => new Set(getSavedProductIds(user?.id)));
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [orderModal, setOrderModal] = useState({ isOpen: false, product: null, mode: 'ORDER' });
  const [tickerTrigger, setTickerTrigger] = useState(0);
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(true);

  // Search debounce ref
  const searchTimeoutRef = useRef(null);

  const loadMarketplace = async (overrideParams = {}) => {
    setLoading(true);
    try {
      const params = { status: 'PUBLISHED', ...overrideParams };
      if (selectedCategory !== 'All Crafts') params.category = selectedCategory;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;

      const [allProds, trendProds] = await Promise.all([
        getProducts(params),
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
  }, [selectedCategory, minPrice, maxPrice]);

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

    if (val.trim().length >= 2 || val.trim().length === 0) {
      searchTimeoutRef.current = setTimeout(async () => {
        loadMarketplace({ search: val.trim() || undefined });
        if (val.trim()) {
          await recordEvent({
            event_type: 'SEARCH',
            query: val.trim(),
            category: selectedCategory !== 'All Crafts' ? selectedCategory : null,
            metadata_info: `Buyer searched for "${val.trim()}"`
          });
          triggerEventRefresh();
        }
      }, 500);
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
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-indigo-950/20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-indigo-800/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-indigo-200 mb-2 border border-indigo-500/30">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{t('buyerMarketplaceBanner', 'Buyer Marketplace (Closed-Loop Market Linkage)')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('directHeritageTitle', 'Direct Heritage Crafts from Traditional Artisans')}</h1>
          <p className="text-indigo-200 text-xs sm:text-sm mt-1 leading-relaxed">
            {t('directHeritageSub', 'Eliminate middlemen. Every view, save, and order directly feeds our Market Intelligence Engine to empower rural makers with fair prices.')}
          </p>
        </div>

        {/* Search Bar & Filter Toggle */}
        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-2xl">
          <div className="flex-1 flex items-center bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/20 shadow-inner">
            <Search className="w-5 h-5 text-indigo-300 ml-2.5 mr-2 shrink-0" />
            <input
              id="marketplace-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('searchPlaceholderMarketplace', 'Search Kalamkari, woodcraft, story, materials...')}
              className="w-full bg-transparent text-white placeholder-indigo-300 text-sm focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="text-indigo-300 hover:text-white text-xs px-2 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
              showFilters || minPrice || maxPrice
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{t('filters', 'Filters')}</span>
            {(minPrice || maxPrice) && <span className="w-2 h-2 rounded-full bg-amber-950"></span>}
          </button>
        </div>

        {/* Filter Drawer / Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-indigo-200 font-bold block mb-1">Min Price (₹)</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="e.g. 100"
                className="w-full p-2 rounded-xl bg-white/10 text-white border border-white/20 placeholder-indigo-300 text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="text-indigo-200 font-bold block mb-1">Max Price (₹)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full p-2 rounded-xl bg-white/10 text-white border border-white/20 placeholder-indigo-300 text-xs focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setMinPrice('');
                  setMaxPrice('');
                  setSearchQuery('');
                  setSelectedCategory('All Crafts');
                  loadMarketplace({});
                }}
                className="w-full py-2 bg-indigo-900/60 hover:bg-indigo-900 text-indigo-200 hover:text-white rounded-xl border border-indigo-700 font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t('resetFilters', 'Reset Filters')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Category Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategorySelect(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm font-bold'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {getCategoryTranslation(cat)}
          </button>
        ))}
      </div>

      {/* Trending Products Carousel */}
      {trending.length > 0 && selectedCategory === 'All Crafts' && !searchQuery && !minPrice && !maxPrice && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span>{t('trendingHeritageCrafts', 'Trending Heritage Crafts')}</span>
            </h3>
            <span className="text-[11px] text-slate-500">{t('rankedByInterest', 'Ranked by buyer interest velocity')}</span>
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
                className="bg-white p-3 rounded-2xl border border-orange-200/80 hover:border-orange-400 transition-all cursor-pointer shadow-xs group"
              >
                <div className="relative rounded-xl overflow-hidden h-28 bg-slate-100">
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {t('highDemand', 'High Demand')}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2 truncate">{getLocalizedProductField(p, 'title', language)}</h4>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs font-extrabold text-indigo-700">₹{p.price.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-slate-500">{getCategoryTranslation(p.category)}</span>
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
            {selectedCategory === 'All Crafts' ? t('allArtisanCollections', 'All Artisan Collections') : `${getCategoryTranslation(selectedCategory)} Collection`}
          </h3>
          <span className="text-xs text-slate-500">{products.length} {t('craftsAvailable', 'crafts available')}</span>
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500">Loading marketplace crafts...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-700">No crafts matched your filter or search.</p>
            <p className="text-xs text-slate-400">Try adjusting price range, clearing search query, or selecting "All Crafts".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p) => {
              const isSaved = savedProductIds.has(p.id);
              const cardTitle = getLocalizedProductField(p, 'title', language);
              const cardDesc = getLocalizedProductField(p, 'description', language) || getLocalizedProductField(p, 'craft_story', language);
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
                        alt={cardTitle}
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
                        {getCategoryTranslation(p.category)}
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
                        {cardTitle}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {cardDesc}
                      </p>
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="p-4 pt-0 border-t border-slate-100 mt-2 space-y-2.5">
                    <div className="flex justify-between items-baseline pt-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{t('directFairPrice', 'Direct Fair Price')}</span>
                        <span className="text-base font-extrabold text-slate-900">₹{p.price.toLocaleString('en-IN')}</span>
                      </div>
                      {p.stock > 0 ? (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {p.stock} {t('inStock', 'in stock')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          {t('outOfStock', 'Out of Stock')}
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
                        <span>{t('viewDetails', 'View')}</span>
                      </button>

                      {user && p.seller_id === user.id ? (
                        <span 
                          className="inline-flex items-center justify-center space-x-1 py-2 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl cursor-default"
                          title="This is your own listed craft. Self-purchase is disabled."
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t('yourCraft', 'Your Craft')}</span>
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
                          <span>{t('preOrder', 'Pre-Order')}</span>
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
                          <span>{t('buyNow', 'Buy Now')}</span>
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

      {/* Floating AI Buyer Copilot Trigger Button */}
      {!isAssistantOpen && (
        <button
          onClick={() => setIsAssistantOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 hover:from-indigo-950 hover:to-purple-950 text-white font-bold px-4 py-3 rounded-full shadow-2xl border-2 border-amber-400/80 flex items-center space-x-2.5 transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          title="Open Native AI Shopping Assistant"
        >
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-extrabold shadow-md group-hover:rotate-12 transition-transform">
            🤖
          </div>
          <div className="text-left">
            <span className="block text-xs font-black text-amber-300 leading-tight">{t('buyerCopilotBtn', '🤖 AI Buyer Copilot')}</span>
          </div>
        </button>
      )}

      {/* Multilingual AI Buyer Copilot Assistant Modal */}
      <BuyerAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onSelectProduct={(prod) => {
          setSelectedProduct(prod);
          setIsDetailOpen(true);
        }}
      />
    </div>
  );
}
