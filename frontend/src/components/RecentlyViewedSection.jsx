import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronLeft, ChevronRight, Trash2, ShoppingBag, X, Sparkles } from 'lucide-react';
import { getRecentlyViewedProducts, removeRecentlyViewedProduct, clearRecentlyViewedProducts } from '../services/recentlyViewed';
import { addToCart } from './CartView';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';

export default function RecentlyViewedSection({ onSelectProduct, currentProductId }) {
  const { language } = useLanguage();
  const notify = useNotification();
  const scrollRef = useRef(null);
  const [recentItems, setRecentItems] = useState([]);

  const refreshList = () => {
    const list = getRecentlyViewedProducts();
    // Exclude currently viewed product if specified
    const filtered = currentProductId ? list.filter((p) => p.id !== currentProductId) : list;
    setRecentItems(filtered);
  };

  useEffect(() => {
    refreshList();

    const handleUpdate = () => {
      refreshList();
    };

    window.addEventListener('artisan_recently_viewed_changed', handleUpdate);
    return () => {
      window.removeEventListener('artisan_recently_viewed_changed', handleUpdate);
    };
  }, [currentProductId]);

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleRemove = (e, productId) => {
    e.stopPropagation();
    removeRecentlyViewedProduct(productId);
    notify.info('Item removed from recent history');
  };

  const handleClear = () => {
    clearRecentlyViewedProducts();
    notify.info('Recently viewed history cleared');
  };

  const handleAddToCart = (e, product) => {
    e.stopPropagation();
    if (product.stock <= 0) {
      notify.warning('This craft is currently out of stock.');
      return;
    }
    addToCart(product, 1);
    notify.success(`Added "${product.title}" to cart! 🛒`);
  };

  if (!recentItems || recentItems.length === 0) {
    return null;
  }

  const isTelugu = language === 'te';

  return (
    <div className="bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl p-4 sm:p-6 space-y-4 my-8 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100/80 border border-amber-300 text-[#A6533B] flex items-center justify-center shadow-xs">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#1C1C1C] flex items-center space-x-1.5">
              <span>{isTelugu ? 'ఇటీవల చూసిన కళాకృతులు' : 'Recently Viewed Crafts'}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-[#A6533B] border border-amber-200">
                {recentItems.length}
              </span>
            </h3>
            <p className="text-xs text-[#6B6B6B] hidden sm:block">
              {isTelugu 
                ? 'మీరు ఇటీవల పరిశీలించిన ప్రామాణిక చేతివృత్తుల కళాఖండాలు' 
                : 'Handpicked authentic craft treasures you recently explored'}
            </p>
          </div>
        </div>

        {/* Carousel controls & Clear button */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleClear}
            className="text-[11px] font-semibold text-[#6B6B6B] hover:text-rose-700 flex items-center space-x-1 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
            title="Clear recently viewed history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isTelugu ? 'క్లియర్ చేయండి' : 'Clear'}</span>
          </button>

          <div className="hidden sm:flex items-center space-x-1">
            <button
              onClick={() => handleScroll('left')}
              className="p-1.5 rounded-lg bg-white border border-[#E8E2D9] hover:border-[#A6533B] text-[#1C1C1C] hover:text-[#A6533B] shadow-2xs transition-all cursor-pointer"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleScroll('right')}
              className="p-1.5 rounded-lg bg-white border border-[#E8E2D9] hover:border-[#A6533B] text-[#1C1C1C] hover:text-[#A6533B] shadow-2xs transition-all cursor-pointer"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {recentItems.map((prod) => (
          <div
            key={prod.id}
            onClick={() => onSelectProduct?.(prod)}
            className="w-48 sm:w-56 shrink-0 bg-white border border-[#E8E2D9] hover:border-[#A6533B] rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between snap-start relative"
          >
            {/* Remove button */}
            <button
              onClick={(e) => handleRemove(e, prod.id)}
              className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/50 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
              title="Remove from history"
            >
              <X className="w-3 h-3" />
            </button>

            <div>
              {/* Thumbnail Image */}
              <div className="relative aspect-[4/5] bg-stone-100 overflow-hidden">
                <img
                  src={prod.enhanced_image_url || prod.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400'}
                  alt={prod.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute bottom-2 left-2 bg-[#1C1C1C]/80 text-white text-[9px] font-bold px-2 py-0.5 rounded backdrop-blur-xs">
                  {prod.category || 'Handicraft'}
                </span>
                {prod.stock <= 0 && (
                  <span className="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-xs">
                    Sold Out
                  </span>
                )}
              </div>

              {/* Product Info */}
              <div className="p-3 space-y-1">
                <span className="text-[10px] font-semibold text-[#A6533B] uppercase tracking-wider block truncate">
                  {prod.region_of_origin || prod.artisan_name || 'Handcrafted Art'}
                </span>
                <h4 className="font-bold text-xs text-[#1C1C1C] line-clamp-2 group-hover:text-[#A6533B] transition-colors leading-snug">
                  {prod.title}
                </h4>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-extrabold text-[#1C1C1C]">
                    ₹{Number(prod.price || 0).toLocaleString('en-IN')}
                  </span>
                  {prod.stock > 0 && (
                    <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {prod.stock} left
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="p-2.5 pt-0">
              <button
                onClick={(e) => handleAddToCart(e, prod)}
                disabled={prod.stock <= 0}
                className="w-full py-1.5 px-2 bg-[#FAF7F2] group-hover:bg-[#A6533B] text-[#1C1C1C] group-hover:text-white border border-[#E8E2D9] group-hover:border-[#A6533B] text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-40"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{prod.stock > 0 ? (isTelugu ? 'కార్ట్‌కి జోడించు' : 'Add to Cart') : 'Out of Stock'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
