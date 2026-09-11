import React from 'react';
import { Package, Plus, Eye, Edit2, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getLocalizedProductField } from '../utils/multilingual.js';

export default function ProductList({ products, onSelectProduct, onEditProduct, onDeleteProduct, onAddProduct, currentUser }) {
  const { language } = useLanguage();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Screen 6 Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#171717]">Your Products</h2>
          <p className="text-xs text-[#666666] mt-0.5">Manage your handmade listings and track artisan views</p>
        </div>
        <button
          onClick={onAddProduct}
          className="px-4 py-2.5 bg-[#176B4D] hover:bg-[#0F4D38] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Product</span>
        </button>
      </div>

      {/* Empty State */}
      {(!products || products.length === 0) && (
        <div className="bg-white rounded-3xl border border-[#E7E7E2] p-12 text-center space-y-3">
          <Package className="w-12 h-12 text-[#666666] mx-auto opacity-40" />
          <h3 className="text-base font-bold text-[#171717]">No products listed yet</h3>
          <p className="text-xs text-[#666666] max-w-sm mx-auto">
            Show us your craft. Speak or upload photos to list your handcrafted items.
          </p>
          <button
            onClick={onAddProduct}
            className="px-5 py-2.5 bg-[#176B4D] hover:bg-[#0F4D38] text-white font-bold text-xs rounded-xl transition-all"
          >
            Create Your First Product
          </button>
        </div>
      )}

      {/* Screen 6 Product Cards Grid */}
      {products && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const title = getLocalizedProductField(p, 'title', language) || p.name || p.title;
            const isPublished = p.status === 'PUBLISHED';
            const viewsCount = p.views_count || p.views || 12;
            const enquiriesCount = p.enquiries_count || p.enquiries || 3;

            return (
              <div
                key={p.id}
                className="bg-white rounded-3xl border border-[#E7E7E2] p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden h-44 bg-[#FAFAF7] border border-[#E7E7E2]">
                    <img
                      src={p.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&auto=format&fit=crop&q=80'}
                      alt={title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&auto=format&fit=crop&q=80';
                      }}
                    />
                    <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      isPublished 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-stone-100 text-stone-700 border-stone-200'
                    }`}>
                      {isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-[#171717] truncate">{title}</h3>
                    <div className="text-base font-extrabold text-[#176B4D] mt-0.5">
                      ₹{Number(p.price).toLocaleString('en-IN')}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#666666] mt-2">
                      <span>{viewsCount} views</span>
                      <span>•</span>
                      <span>{enquiriesCount} enquiries</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-[#E7E7E2] mt-4">
                  <button
                    onClick={() => onSelectProduct(p)}
                    className="flex-1 py-2 px-3 bg-[#FAFAF7] hover:bg-stone-100 text-[#171717] font-semibold text-xs rounded-xl border border-[#E7E7E2] transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => onEditProduct(p)}
                    className="flex-1 py-2 px-3 bg-[#FAFAF7] hover:bg-stone-100 text-[#171717] font-semibold text-xs rounded-xl border border-[#E7E7E2] transition-colors"
                  >
                    Edit
                  </button>
                  {Boolean(currentUser && (currentUser.role === 'ADMIN' || !p.seller_id || p.seller_id === currentUser?.id)) && (
                    <button
                      onClick={() => onDeleteProduct(p.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl border border-[#E7E7E2] transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
