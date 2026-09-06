import React, { useEffect } from 'react';
import { X, Heart, ShoppingBag, Send, ShieldCheck, MapPin, Sparkles, Check, CheckCircle2 } from 'lucide-react';
import { recordEvent } from '../api';

export default function BuyerProductModal({ 
  product, 
  isOpen, 
  onClose, 
  isSaved, 
  onToggleSave, 
  onOpenOrder, 
  onOpenEnquiry,
  user,
  onOpenAuth
}) {
  if (!isOpen || !product) return null;

  // Track VIEW event when modal opens
  useEffect(() => {
    if (product?.id) {
      recordEvent({
        event_type: 'VIEW',
        product_id: product.id,
        category: product.category,
        metadata_info: `Buyer viewed ${product.title}`
      });
    }
  }, [product?.id]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex justify-between items-start pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                {product.category}
              </span>
              <span className="text-xs text-slate-500 flex items-center">
                <MapPin className="w-3 h-3 text-amber-600 mr-1" />
                <span>GI Heritage Artisan Product</span>
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">{product.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-xs">
              <img
                src={product.enhanced_image_url || product.image_url}
                alt={product.title}
                className="w-full h-64 object-cover"
              />
              <button
                onClick={() => onToggleSave(product)}
                className={`absolute top-3 right-3 p-2.5 rounded-full shadow-md backdrop-blur-md transition-all cursor-pointer ${
                  isSaved
                    ? 'bg-rose-600 text-white shadow-rose-600/30 scale-110'
                    : 'bg-white/80 text-slate-600 hover:text-rose-600 hover:bg-white'
                }`}
                title={isSaved ? "Remove from Wishlist" : "Save to Wishlist"}
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Fair Price:</span>
                <span className="text-xl font-bold text-slate-900">₹{product.price.toLocaleString('en-IN')}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[11px]">Stock Status:</span>
                <span className="font-semibold text-emerald-700">{product.stock} units available</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-bold text-slate-800 block mb-1">Craft Description</span>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                {product.description || 'Authentic handmade creation crafted using traditional artisan methods.'}
              </p>
            </div>

            <div>
              <span className="font-bold text-slate-800 flex items-center space-x-1 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Heritage Craft Story</span>
              </span>
              <p className="text-slate-700 leading-relaxed bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60 italic">
                "{product.craft_story || 'Generational traditional technique crafted with organic materials.'}"
              </p>
            </div>

            <div>
              <span className="font-bold text-slate-800 block mb-1">Materials</span>
              <p className="text-slate-600">{product.materials || 'Pure Natural Fibres & Dyes'}</p>
            </div>

            {/* Action Buttons */}
            {user && product.seller_id === user.id ? (
              <div className="pt-2 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-1.5">
                <div className="flex items-center justify-center space-x-1.5 text-amber-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>Your Listed Craft (మీ ఉత్పత్తి)</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  You are the master artisan who created this listing. Self-purchasing and self-enquiries are disabled on your own crafts.
                </p>
              </div>
            ) : (
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    if (!user) {
                      onClose();
                      onOpenAuth?.();
                      return;
                    }
                    onClose();
                    onOpenOrder(product);
                  }}
                  className="w-full inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Buy Now (B2C Order)</span>
                </button>

                <button
                  onClick={() => {
                    if (!user) {
                      onClose();
                      onOpenAuth?.();
                      return;
                    }
                    onClose();
                    onOpenEnquiry(product);
                  }}
                  className="w-full inline-flex items-center justify-center space-x-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold py-2 rounded-xl transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4 text-amber-700" />
                  <span>Request B2B Bulk Enquiry</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
