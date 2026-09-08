import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Heart, Sparkles, Filter, MapPin, Send, Eye, Flame, CheckCircle2, SlidersHorizontal, RefreshCw, Bot } from 'lucide-react';
import BuyerProductModal from './BuyerProductModal';
import BuyerOrderModal from './BuyerOrderModal';
import BuyerAssistantModal from './BuyerAssistantModal';
import { getProducts, getTrendingProducts, recordEvent } from '../api/index.js';
import { getSavedProductIds, saveProductId, removeSavedProductId, getCachedProducts, setCachedProducts } from '../services/offlineSync';
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
  const [products, setProducts] = useState(() => {
    const cached = getCachedProducts(user?.id);
    return cached && cached.length > 0 ? cached : [];
  });
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
  const [loading, setLoading] = useState(() => {
    const cached = getCachedProducts(user?.id);
    return !(cached && cached.length > 0);
  });

  // Search debounce ref
  const searchTimeoutRef = useRef(null);

  const loadMarketplace = async (overrideParams = {}) => {
    if (products.length === 0) {
      setLoading(true);
    }
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
      setCachedProducts(allProds, user?.id);
    } catch (err) {
      console.error('Marketplace load error, using cached products:', err);
      const cached = getCachedProducts(user?.id);
      if (cached && cached.length > 0) {
        setProducts(cached);
      }
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
    <div className="space-y-6 pb-28 md:pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs transition-all">
          <span>{notification}</span>
          <button onClick={() => setNotification('')} className="text-indigo-600 hover:text-indigo-900 ml-2">✕</button>
        </div>
      )}

      {/* Header Banner (Screen 6 Design) */}
      <div className="bg-[#FAF7F2] rounded-3xl p-6 border border-stone-200/80 space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C1A0E] tracking-tight">
            Discover Handmade Treasures
          </h1>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Real People. Real Crafts. Real Impact.
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex items-center bg-white rounded-2xl p-2.5 px-3.5 border border-stone-200 shadow-xs">
          <Search className="w-4 h-4 text-stone-400 mr-2 shrink-0" />
          <input
            id="marketplace-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search for handmade products..."
            className="w-full bg-transparent text-stone-900 placeholder-stone-400 text-xs focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => handleSearchChange('')} className="text-stone-400 text-xs px-1">
              Clear
            </button>
          )}
        </div>

        {/* Hero Spotlight Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#3D2314] via-[#4A2E1B] to-[#5C3A21] text-white p-6 sm:p-8 shadow-xl border border-amber-900/40">
          {/* Ambient Glows */}
          <div className="w-48 h-48 rounded-full bg-amber-500/10 absolute -right-10 -bottom-10 blur-2xl pointer-events-none" />
          <div className="w-32 h-32 rounded-full bg-orange-500/10 absolute top-0 right-1/3 blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Left Content */}
            <div className="space-y-3 max-w-lg">
              <div className="inline-flex items-center space-x-2 bg-amber-400/15 border border-amber-400/30 px-3 py-1 rounded-full text-[11px] font-bold text-amber-300 backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Direct Artisan Marketplace • ONDC Integrated</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                Authentic Crafts, Brighter Lives
              </h2>

              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
                Connecting traditional Indian artisans directly with conscious buyers. Every purchase guarantees fair wages and preserves timeless cultural heritage.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold text-amber-200">
                <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">✨ GI Tagged Art</span>
                <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">🛡️ ≥ 20% Fair Profit</span>
                <span className="bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">🤝 Zero Middleman</span>
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button 
                  onClick={() => handleCategorySelect('All Crafts')}
                  className="inline-flex items-center space-x-2 bg-white text-[#4A2E1B] hover:bg-stone-100 active:scale-95 px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-[#4A2E1B]" />
                  <span>Shop Heritage Collection →</span>
                </button>
              </div>
            </div>

            {/* Right Visual Card Preview */}
            <div className="hidden sm:flex items-center space-x-3 shrink-0 self-center">
              <div className="w-40 h-44 rounded-2xl overflow-hidden relative shadow-2xl border-2 border-white/20 transform rotate-2 hover:rotate-0 transition-transform">
                <img 
                  src="https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=400&q=80" 
                  alt="Kalamkari Saree" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5 text-white">
                  <span className="text-[10px] font-bold text-amber-300">Kalamkari Craft</span>
                  <span className="text-xs font-black">₹1,499</span>
                </div>
              </div>

              <div className="w-36 h-40 rounded-2xl overflow-hidden relative shadow-2xl border-2 border-white/20 transform -rotate-3 hover:rotate-0 transition-transform hidden md:block">
                <img 
                  src="https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80" 
                  alt="Jaipur Blue Pottery" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5 text-white">
                  <span className="text-[10px] font-bold text-amber-300">Blue Pottery</span>
                  <span className="text-xs font-black">₹699</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Chips (Screen 6 Design) */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Categories</h3>
        <div className="flex items-center space-x-2.5 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCategory === cat
                  ? 'bg-[#4A2E1B] text-white border-[#4A2E1B] shadow-sm'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-amber-700/40'
              }`}
            >
              {getCategoryTranslation(cat)}
            </button>
          ))}
        </div>
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

      {/* Product Details Modal (tracks VIEW event & shows Similar Crafts) */}
      <BuyerProductModal
        product={selectedProduct}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        isSaved={selectedProduct ? savedProductIds.has(selectedProduct.id) : false}
        onToggleSave={handleToggleSave}
        user={user}
        onOpenAuth={onOpenAuth}
        allProducts={products}
        onSelectProduct={(p) => setSelectedProduct(p)}
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

      {/* Floating AI Buyer Copilot Trigger Button (Positioned above floating mobile navbar) */}
      {!isAssistantOpen && (
        <button
          onClick={() => setIsAssistantOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 hover:from-indigo-950 hover:to-purple-950 text-white font-bold px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-2xl border-2 border-amber-400/80 flex items-center space-x-2 transition-all hover:scale-105 active:scale-95 cursor-pointer group backdrop-blur-md"
          title="Open Native AI Shopping Assistant"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-extrabold shadow-md group-hover:rotate-12 transition-transform shrink-0">
            🤖
          </div>
          <div className="text-left">
            <span className="block text-[11px] sm:text-xs font-black text-amber-300 leading-tight">{t('buyerCopilotBtn', '🤖 AI Buyer Copilot')}</span>
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
