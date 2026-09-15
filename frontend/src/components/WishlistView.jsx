import React, { useState, useEffect } from 'react';
import { Heart, ShoppingBag, Trash2, ArrowRight, Sparkles, MapPin } from 'lucide-react';
import { getProducts } from '../api/index.js';
import { getSavedProductIds, removeSavedProductId } from '../services/offlineSync';
import { useNotification } from '../context/NotificationContext';

export default function WishlistView({ user, onSelectMode, onOpenAuth }) {
  const notify = useNotification();
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWishlist();
  }, [user?.id]);

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

  const handleRemove = (productId) => {
    removeSavedProductId(user?.id, productId);
    setWishlistProducts(prev => prev.filter(p => p.id !== productId));
    notify.info('Item removed from your Saved Wishlist');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans">
      {/* Editorial Header */}
      <div className="bg-[#FAF9F6] border border-[#E8E5DF] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#A6533B] font-semibold block">
            SAVED HERITAGE CREATIONS
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-[#1C1C1C] tracking-tight">
            My Saved Wishlist ({wishlistProducts.length})
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Handpicked authentic creations saved for future purchase or custom pre-orders.
          </p>
        </div>
        <button
          onClick={() => onSelectMode('BUY')}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#A6533B] text-white text-xs font-semibold hover:bg-[#88412F] transition-all cursor-pointer shadow-xs"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Explore More Crafts</span>
        </button>
      </div>

      {/* Wishlist Grid */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E8E5DF] text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#A6533B] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-[#6B6B6B] font-medium">Loading saved wishlist items...</p>
        </div>
      ) : wishlistProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-[#E8E5DF] text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl border border-rose-200/60 flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#1C1C1C]">Your Wishlist is Empty</h3>
            <p className="text-xs text-[#6B6B6B] max-w-sm mx-auto">
              Save your favorite authentic Kalamkari sarees, Blue Pottery, and Bidriware creations while exploring the marketplace.
            </p>
          </div>
          <button
            onClick={() => onSelectMode('BUY')}
            className="px-6 py-2.5 bg-[#A6533B] hover:bg-[#88412F] text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Browse Marketplace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlistProducts.map((p) => (
            <div 
              key={p.id} 
              className="bg-white rounded-2xl border border-[#E8E5DF] overflow-hidden space-y-4 p-4 shadow-xs hover:border-[#A6533B]/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="aspect-4/3 rounded-xl overflow-hidden bg-[#FAF9F6] border border-[#E8E5DF] relative">
                  <img 
                    src={p.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600'} 
                    alt={p.title} 
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleRemove(p.id)}
                    className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-xs text-rose-600 rounded-full hover:bg-rose-50 transition-colors shadow-xs cursor-pointer"
                    title="Remove from Saved"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-50 text-[#A6533B] border border-[#E8E5DF]">
                    {p.category || 'Handicraft'}
                  </span>
                  <h3 className="font-bold text-sm text-[#1C1C1C] pt-2 line-clamp-1">{p.title}</h3>
                  <p className="text-xs text-[#6B6B6B] mt-0.5 line-clamp-2">{p.description}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8E5DF] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#6B6B6B] block">Direct Price</span>
                  <span className="text-base font-black text-[#A6533B]">₹{p.price?.toLocaleString('en-IN')}</span>
                </div>
                <button
                  onClick={() => onSelectMode('BUY')}
                  className="px-4 py-2 bg-[#1C1C1C] hover:bg-[#A6533B] text-white text-xs font-semibold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Buy Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
