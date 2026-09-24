import React, { useState, useEffect } from 'react';
import { Heart, ShoppingBag, Trash2, ArrowRight, Share2, Bell, Sparkles } from 'lucide-react';
import { getProducts } from '../api/index.js';
import { getSavedProductIds, removeSavedProductId } from '../services/offlineSync';
import { useNotification } from '../context/NotificationContext';
import { WishlistCardSkeleton } from './SkeletonLoader';
import ShareProductModal from './ShareProductModal';

export default function WishlistView({ user, onSelectMode, onOpenAuth }) {
  const notify = useNotification();
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareProduct, setShareProduct] = useState(null);

  const loadWishlist = async () => {
    setLoading(true);
    try {
      const savedIds = getSavedProductIds(user?.id);
      if (savedIds.length === 0) {
        setWishlistProducts([]);
        setLoading(false);
        return;
      }

      const allProds = await getProducts();
      const favs = (allProds || []).filter(p => savedIds.includes(p.id));
      setWishlistProducts(favs);
    } catch (err) {
      console.error('Failed to load wishlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWishlist();
  }, [user?.id]);

  const handleRemove = (productId) => {
    removeSavedProductId(user?.id, productId);
    setWishlistProducts(prev => prev.filter(p => p.id !== productId));
    notify.info('Item removed from your Saved Wishlist');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 font-sans">
      {/* Editorial Header */}
      <div className="bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#8C3F2B]/10 text-[#8C3F2B] text-[10px] font-bold tracking-wider uppercase">
            <span>❤️ Saved Heritage Creations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1C1C1C] tracking-tight">
            My Saved Wishlist ({wishlistProducts.length})
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 font-medium leading-relaxed">
            Handpicked authentic creations saved for future purchase or custom pre-orders.
          </p>
        </div>
        <button
          onClick={() => onSelectMode('BUY')}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#A6533B] text-white text-xs font-bold hover:bg-[#88412F] transition-all cursor-pointer shadow-xs shrink-0"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Explore More Crafts</span>
        </button>
      </div>

      {/* Smart Wishlist Reminder Reassurance Banner */}
      {wishlistProducts.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 px-4 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-full bg-amber-200/60 flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5 text-amber-800" />
            </div>
            <span>
              <strong>Smart Stock & Price Watch Active:</strong> We'll alert you with friendly reminders if stock runs low on your saved crafts!
            </span>
          </div>
          <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 shrink-0">
            3-Day Auto Follow-up
          </span>
        </div>
      )}

      {/* Wishlist Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <WishlistCardSkeleton />
          <WishlistCardSkeleton />
          <WishlistCardSkeleton />
        </div>
      ) : wishlistProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-[#E8E2D9] text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl border border-rose-200/60 flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#1C1C1C]">Your Wishlist is Empty</h3>
            <p className="text-xs text-stone-600 max-w-sm mx-auto">
              Save your favorite authentic Kalamkari sarees, Blue Pottery, and Bidriware creations while exploring the marketplace.
            </p>
          </div>
          <button
            onClick={() => onSelectMode('BUY')}
            className="px-6 py-2.5 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Browse Marketplace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlistProducts.map((p) => (
            <div 
              key={p.id} 
              className="bg-white rounded-2xl border border-[#E8E2D9] overflow-hidden space-y-4 p-4 shadow-2xs hover:border-[#A6533B]/60 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="aspect-4/3 rounded-xl overflow-hidden bg-[#FAF7F2] border border-[#E8E2D9] relative">
                  <img 
                    src={p.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600'} 
                    alt={p.title} 
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setShareProduct(p)}
                    className="absolute top-2 left-2 p-2 bg-white/95 backdrop-blur-xs text-stone-700 hover:text-[#A6533B] rounded-full hover:bg-white transition-colors shadow-2xs cursor-pointer"
                    title="Share this craft"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemove(p.id)}
                    className="absolute top-2 right-2 p-2 bg-white/95 backdrop-blur-xs text-rose-600 rounded-full hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer"
                    title="Remove from Saved"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded bg-amber-50/80 text-[#A6533B] border border-[#E8E2D9]">
                    {p.category || 'Handicraft'}
                  </span>
                  <h3 className="font-bold text-sm text-[#1C1C1C] pt-2 line-clamp-1">{p.title}</h3>
                  <p className="text-xs text-stone-600 mt-0.5 line-clamp-2">{p.description}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8E2D9] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-stone-500 block font-medium">Direct Artisan Price</span>
                  <span className="text-base font-black text-[#1C1C1C]">₹{p.price?.toLocaleString('en-IN')}</span>
                </div>
                <button
                  onClick={() => onSelectMode('BUY')}
                  className="px-4 py-2 bg-[#A6533B] hover:bg-[#88412F] text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Buy Now</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Product Modal */}
      <ShareProductModal
        product={shareProduct}
        isOpen={Boolean(shareProduct)}
        onClose={() => setShareProduct(null)}
      />
    </div>
  );
}

