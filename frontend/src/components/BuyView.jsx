import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Heart, Filter, Flame } from 'lucide-react';
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

export default function BuyView({ 
  user, 
  onOpenAuth, 
  searchQuery: externalSearchQuery = '', 
  onSearchChange,
  initialSelectedProduct,
  onClearInitialSelectedProduct
}) {
  const { language, t, getCategoryTranslation } = useLanguage();
  const [products, setProducts] = useState(() => {
    const cached = getCachedProducts(user?.id);
    return cached && cached.length > 0 ? cached : [];
  });
  const [trending, setTrending] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All Crafts');
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery || '');
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

  // Sync internal searchQuery when externalSearchQuery prop changes
  useEffect(() => {
    if (externalSearchQuery !== searchQuery) {
      setSearchQuery(externalSearchQuery);
      loadMarketplace({ search: externalSearchQuery.trim() || undefined });
    }
  }, [externalSearchQuery]);

  // Open detail modal if initialSelectedProduct is passed from Navbar search
  useEffect(() => {
    if (initialSelectedProduct) {
      setSelectedProduct(initialSelectedProduct);
      setIsDetailOpen(true);
      if (onClearInitialSelectedProduct) {
        onClearInitialSelectedProduct();
      }
    }
  }, [initialSelectedProduct]);

  const loadMarketplace = async (overrideParams = {}) => {
    if (products.length === 0) {
      setLoading(true);
    }
    try {
      const activeSearch = overrideParams.search !== undefined ? overrideParams.search : (externalSearchQuery || searchQuery);
      const params = { status: 'PUBLISHED', ...overrideParams };
      if (selectedCategory !== 'All Crafts') params.category = selectedCategory;
      if (activeSearch && activeSearch.trim()) params.search = activeSearch.trim();
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
    if (onSearchChange) onSearchChange(val);
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
        <div className="p-3 bg-indigo-50 border border-[#933D1E]/30 text-indigo-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs transition-all">
          <span>{notification}</span>
          <button onClick={() => setNotification('')} className="text-[#933D1E] hover:text-indigo-900 ml-2">✕</button>
        </div>
      )}

      {/* Elegant Luxury Marketplace Header */}
      <div className="space-y-4 pb-4 border-b border-[#E8E5DF]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1C1C1C] tracking-tight font-serif-luxury">
              SHOP HANDMADE
            </h1>
            <p className="text-sm text-[#6B6B6B] mt-1 font-sans">
              Discover authentic pieces crafted by independent artisans across India.
            </p>
          </div>

          {/* Active Search Query Filter Pill Indicator */}
          {searchQuery && (
            <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full text-xs text-[#A6533B] font-semibold self-start md:self-auto shadow-2xs">
              <span>Search: "{searchQuery}"</span>
              <button
                onClick={() => handleSearchChange('')}
                className="hover:text-amber-900 font-bold ml-1 cursor-pointer"
                title="Clear search filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Clean Minimalist Category Filter Pills */}
        <div className="flex items-center space-x-2.5 overflow-x-auto pb-1 no-scrollbar pt-2">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategorySelect(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#A6533B] text-white shadow-xs'
                    : 'bg-white border border-[#E8E5DF] text-[#1C1C1C] hover:border-[#A6533B] hover:text-[#A6533B]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trending Products Carousel */}
      {trending.length > 0 && selectedCategory === 'All Crafts' && !searchQuery && !minPrice && !maxPrice && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1C1C1C] flex items-center space-x-1.5">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span>{t('trendingHeritageCrafts', 'Trending Heritage Crafts')}</span>
            </h3>
            <span className="text-[11px] text-[#6B6B6B]">{t('rankedByInterest', 'High Demand')}</span>
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
                className="bg-white p-2.5 rounded-xl border border-[#E8E5DF] hover:border-[#A6533B] transition-all cursor-pointer shadow-xs group"
              >
                <div className="relative rounded-lg overflow-hidden h-28 bg-stone-100">
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute top-1.5 left-1.5 bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                    HOT
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#1C1C1C] mt-2 truncate">{getLocalizedProductField(p, 'title', language)}</h4>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs font-extrabold text-[#A6533B]">₹{p.price.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-[#6B6B6B]">{getCategoryTranslation(p.category)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Marketplace Grid (Flipkart / Myntra Style Native 2-Column Grid) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold text-[#1C1C1C]">
            {selectedCategory === 'All Crafts' ? t('allArtisanCollections', 'All Artisan Collections') : `${getCategoryTranslation(selectedCategory)} Collection`}
          </h3>
          <span className="text-xs text-[#6B6B6B]">{products.length} {t('craftsAvailable', 'items')}</span>
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E8E5DF] text-center">
            <div className="w-6 h-6 border-2 border-[#A6533B] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-[#6B6B6B]">Loading marketplace crafts...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-[#E8E5DF] text-center space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-[#1C1C1C]">No crafts matched your filter or search.</p>
            <p className="text-xs text-[#6B6B6B]">Try adjusting price range, clearing search query, or selecting "All Crafts".</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
            {products.map((p) => {
              const isSaved = savedProductIds.has(p.id);
              const cardTitle = getLocalizedProductField(p, 'title', language);
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-[#E8E5DF] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                  onClick={() => {
                    setSelectedProduct(p);
                    setIsDetailOpen(true);
                    triggerEventRefresh();
                  }}
                >
                  <div>
                    {/* Flipkart Style Portrait Image (Aspect 4:5) */}
                    <div className="relative aspect-[4/5] bg-stone-100 overflow-hidden">
                      <img
                        src={p.image_url}
                        alt={cardTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      
                      {/* Wishlist Heart Overlay */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSave(p);
                        }}
                        className={`absolute top-2 right-2 p-1.5 rounded-full shadow-xs transition-all cursor-pointer ${
                          isSaved
                            ? 'bg-rose-600 text-white'
                            : 'bg-white/90 text-stone-600 hover:text-rose-600'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                      </button>

                      {/* Real Craft Category Tag */}
                      <span className="absolute bottom-2 left-2 bg-[#1C1C1C]/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded backdrop-blur-xs">
                        {getCategoryTranslation(p.category)}
                      </span>
                    </div>

                    {/* Product Info */}
                    <div className="p-3 space-y-1">
                      <span className="text-[10px] font-bold text-[#A6533B] uppercase tracking-wider block">
                        {p.artisan_name || 'Authentic Handloom Craft'}
                      </span>
                      <h4 className="font-bold text-[#1C1C1C] text-xs truncate">
                        {cardTitle}
                      </h4>

                      {/* Real Price & Stock Badge Block */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm font-extrabold text-[#1C1C1C]">₹{p.price.toLocaleString('en-IN')}</span>
                        {p.stock > 0 ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {p.stock} in stock
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Out of Stock
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] font-semibold text-stone-500 pt-0.5">
                        🚚 Direct Artisan Shipment
                      </div>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <div className="p-3 pt-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!user) {
                          onOpenAuth?.();
                          return;
                        }
                        if (p.stock > 0) {
                          setOrderModal({ isOpen: true, product: p, mode: 'ORDER' });
                        } else {
                          setOrderModal({ isOpen: true, product: p, mode: 'ENQUIRY' });
                        }
                      }}
                      className="w-full py-2 bg-[#A6533B] hover:bg-[#88412F] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1 shadow-xs"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{p.stock > 0 ? 'Add to Cart' : 'Pre-Order'}</span>
                    </button>
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
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 flex items-center justify-center text-[#2A1E17] font-extrabold shadow-md group-hover:rotate-12 transition-transform shrink-0">
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
