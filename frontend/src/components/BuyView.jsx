import React, { useState, useEffect, useRef } from 'react';
import { Search, Heart, Star, MapPin } from 'lucide-react';
import BuyerProductModal from './BuyerProductModal';
import BuyerOrderModal from './BuyerOrderModal';
import BuyerAssistantModal from './BuyerAssistantModal';
import { getProducts, getTrendingProducts, recordEvent } from '../api/index.js';
import { getSavedProductIds, saveProductId, removeSavedProductId, getCachedProducts, setCachedProducts } from '../services/offlineSync';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getLocalizedProductField } from '../utils/multilingual.js';
import { getCraftImage } from '../utils/craftImage.js';

const CATEGORIES = [
  'All',
  'Wood',
  'Pottery',
  'Handloom',
  'Metal'
];

export default function BuyView({ user, onOpenAuth }) {
  const { language } = useLanguage();
  const [products, setProducts] = useState(() => {
    const cached = getCachedProducts(user?.id);
    return cached && cached.length > 0 ? cached : [];
  });
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedProductIds, setSavedProductIds] = useState(() => new Set(getSavedProductIds(user?.id)));
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [orderModal, setOrderModal] = useState({ isOpen: false, product: null, mode: 'ORDER' });
  const [loading, setLoading] = useState(false);

  const searchTimeoutRef = useRef(null);

  const loadMarketplace = async (overrideParams = {}) => {
    setLoading(true);
    try {
      const params = { status: 'PUBLISHED', ...overrideParams };
      if (selectedCategory !== 'All') {
        if (selectedCategory === 'Wood') params.category = 'Wooden Toys';
        else if (selectedCategory === 'Pottery') params.category = 'Blue Pottery';
        else if (selectedCategory === 'Handloom') params.category = 'Kalamkari';
        else if (selectedCategory === 'Metal') params.category = 'Bidriware';
        else params.category = selectedCategory;
      }
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const allProds = await getProducts(params);
      setProducts(allProds);
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
  }, [selectedCategory]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadMarketplace({ search: val.trim() || undefined });
    }, 400);
  };

  const handleToggleSave = (e, product) => {
    e.stopPropagation();
    const isSaved = savedProductIds.has(product.id);
    const updated = new Set(savedProductIds);
    if (isSaved) {
      updated.delete(product.id);
      removeSavedProductId(user?.id, product.id);
    } else {
      updated.add(product.id);
      saveProductId(user?.id, product.id);
    }
    setSavedProductIds(updated);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-12 max-w-6xl mx-auto">
      {/* Screen 8 Header */}
      <div className="space-y-1 text-left">
        <h1 className="text-3xl font-extrabold text-[#171717]">Discover Indian Craft</h1>
        <p className="text-xs text-[#666666]">Handmade. Authentic. Meaningful.</p>
      </div>

      {/* Screen 8 Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#666666] absolute left-4 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search handmade products..."
          className="w-full bg-white border border-[#E7E7E2] rounded-2xl pl-11 pr-4 py-3 text-xs text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#176B4D] shadow-sm"
        />
      </div>

      {/* Screen 8 Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              selectedCategory === cat
                ? 'bg-[#176B4D] text-white border-[#176B4D] shadow-sm'
                : 'bg-white text-[#171717] border-[#E7E7E2] hover:border-[#176B4D]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-xs text-[#666666]">
          Loading handmade products...
        </div>
      )}

      {/* Screen 8 Product Cards Grid */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const title = getLocalizedProductField(p, 'title', language) || p.title;
            const isSaved = savedProductIds.has(p.id);

            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProduct(p);
                  setIsDetailOpen(true);
                }}
                className="bg-white rounded-3xl border border-[#E7E7E2] overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-[#FAFAF7] overflow-hidden border-b border-[#E7E7E2]">
                    <img
                      src={getCraftImage(p)}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&auto=format&fit=crop&q=80';
                      }}
                    />
                    <button
                      onClick={(e) => handleToggleSave(e, p)}
                      className="absolute top-2.5 right-2.5 p-2 bg-white/90 backdrop-blur-md rounded-full text-[#171717] shadow-sm hover:scale-110 transition-transform"
                    >
                      <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-[#666666]'}`} />
                    </button>
                  </div>

                  <div className="p-4 space-y-1">
                    <h3 className="font-bold text-xs text-[#171717] line-clamp-1">{title}</h3>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-extrabold text-[#176B4D]">
                        ₹{Number(p.price).toLocaleString('en-IN')}
                      </span>
                      <div className="flex items-center text-[11px] font-bold text-amber-600">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                        <span>4.8</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Buyer Product Detail Modal (Screen 7 View) */}
      {isDetailOpen && selectedProduct && (
        <BuyerProductModal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          product={selectedProduct}
          onOpenOrderModal={(mode) => setOrderModal({ isOpen: true, product: selectedProduct, mode })}
        />
      )}

      {/* Buyer Order Modal */}
      {orderModal.isOpen && (
        <BuyerOrderModal
          isOpen={orderModal.isOpen}
          onClose={() => setOrderModal({ isOpen: false, product: null, mode: 'ORDER' })}
          product={orderModal.product}
          mode={orderModal.mode}
          user={user}
        />
      )}
    </div>
  );
}
