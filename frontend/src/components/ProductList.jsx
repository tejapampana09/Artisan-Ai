import React from 'react';
import { Package, Edit2, Trash2, Eye } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getLocalizedProductField } from '../utils/multilingual.js';

export default function ProductList({ products, onSelectProduct, onEditProduct, onDeleteProduct, onAddProduct, currentUser }) {
  const { language, getCategoryTranslation } = useLanguage();
  if (!products || products.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-[#EADFCF] p-12 text-center">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-[#2A1E17]">No products in your catalog yet</h3>
        <p className="text-sm text-[#6B5B51] mt-1 max-w-sm mx-auto">
          Start listing your handmade crafts. You can add them with full cost breakdown and craft stories.
        </p>
        <button
          onClick={onAddProduct}
          className="mt-4 inline-flex items-center space-x-2 bg-[#933D1E] hover:bg-[#7E3216] text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all"
        >
          <span>Add First Product</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FBF8F3] rounded-2xl border border-[#EADFCF] shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-[#EADFCF] flex justify-between items-center bg-[#FBF8F3]">
        <div>
          <h3 className="text-base font-bold text-[#2A1E17]">Your Craft Catalog</h3>
          <p className="text-xs text-[#6B5B51]">Live products managed by your artisan studio</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F4EBE1] text-[#2A1E17] border border-[#EADFCF]">
          {products.length} {products.length === 1 ? 'Craft' : 'Crafts'}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {products.map((p) => (
          <div
            key={p.id}
            className="p-5 hover:bg-[#FAF7F2]/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            {/* Product Image & Meta */}
            <div className="flex items-start sm:items-center space-x-4">
              <img
                src={p.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&auto=format&fit=crop&q=80'}
                alt={getLocalizedProductField(p, 'title', language)}
                className="w-16 h-16 rounded-xl object-cover border border-[#EADFCF] shadow-xs flex-shrink-0"
              />
              <div>
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h4 className="font-semibold text-[#2A1E17] text-sm hover:text-[#933D1E] cursor-pointer" onClick={() => onSelectProduct(p)}>
                    {getLocalizedProductField(p, 'title', language)}
                  </h4>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#933D1E]/10 text-[#933D1E] border border-[#933D1E]/20 font-bold">
                    {getCategoryTranslation(p.category)}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    p.status === 'PUBLISHED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-[#F4EBE1] text-[#6B5B51] border border-[#EADFCF]'
                  }`}>
                    {p.status}
                  </span>
                  {p.isOfflineDraft && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300 flex items-center space-x-1 animate-pulse">
                      <span>📡 Offline Draft (Pending Sync)</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6B5B51] mt-1 line-clamp-1 max-w-md">
                  {getLocalizedProductField(p, 'description', language) || getLocalizedProductField(p, 'craft_story', language)}
                </p>
                <div className="flex items-center space-x-3 text-xs text-[#6B5B51] mt-1.5">
                  <span className="flex items-center text-[#2A1E17] font-bold">
                    ₹{p.price.toLocaleString('en-IN')}
                  </span>
                  <span>•</span>
                  <span>Stock: <strong className="text-[#2A1E17]">{p.stock} units</strong></span>
                  <span>•</span>
                  <span>Cost Basis: ₹{(p.material_cost + p.labour_cost + p.packaging_cost).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 self-end sm:self-center">
              <button
                onClick={() => onSelectProduct(p)}
                className="p-2 text-[#6B5B51] hover:text-[#2A1E17] hover:bg-[#F4EBE1] rounded-lg transition-colors cursor-pointer"
                title="View Details"
              >
                <Eye className="w-4 h-4" />
              </button>
              {Boolean(currentUser && (currentUser.role === 'ADMIN' || !p.seller_id || p.seller_id === currentUser?.id)) && (
                <>
                  <button
                    onClick={() => onEditProduct(p)}
                    className="p-2 text-[#933D1E] hover:text-[#933D1E] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="Edit Product"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteProduct(p.id)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Product"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
