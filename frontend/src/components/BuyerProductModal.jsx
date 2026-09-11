import React, { useState, useEffect } from 'react';
import { X, Heart, Star, MapPin, Award, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getLocalizedProductField } from '../utils/multilingual.js';
import { getCraftImage } from '../utils/craftImage.js';


export default function BuyerProductModal({ 
  product, 
  isOpen, 
  onClose, 
  isSaved, 
  onToggleSave, 
  onOpenOrderModal
}) {
  const { language } = useLanguage();

  if (!isOpen || !product) return null;

  const title = getLocalizedProductField(product, 'title', language) || product.title;
  const description = getLocalizedProductField(product, 'description', language) || product.description;
  const story = getLocalizedProductField(product, 'craft_story', language) || product.craft_story;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col border border-[#E7E7E2]">
        
        {/* Top Header Controls */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 p-4 border-b border-[#E7E7E2] flex items-center justify-between">
          <span className="text-xs font-bold text-[#176B4D] bg-[#176B4D]/10 px-3 py-1 rounded-full border border-[#176B4D]/20">
            {product.category}
          </span>
          <button
            onClick={onClose}
            className="p-2 text-[#666666] hover:text-[#171717] hover:bg-stone-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Screen 7 Design) */}
        <div className="p-6 space-y-6 flex-1 text-left">
          
          {/* Screen 7 Large Image */}
          <div className="relative rounded-3xl overflow-hidden h-72 sm:h-80 bg-[#FAFAF7] border border-[#E7E7E2]">
            <img
              src={getCraftImage(product)}
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80';
              }}
            />
          </div>

          {/* Title, Price, Rating, Location */}
          <div className="space-y-2 border-b border-[#E7E7E2] pb-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171717]">{title}</h1>
            
            <div className="flex items-center justify-between">
              <span className="text-2xl font-extrabold text-[#176B4D]">
                ₹{Number(product.price).toLocaleString('en-IN')}
              </span>
              
              <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>4.8 (120 reviews)</span>
              </div>
            </div>

            <div className="flex items-center text-xs text-[#666666] pt-1">
              <MapPin className="w-3.5 h-3.5 text-[#176B4D] mr-1" />
              <span>Handcrafted in {product.region_of_origin || product.seller?.location || 'Andhra Pradesh'}</span>
            </div>
          </div>

          {/* About this craft */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#666666]">About this craft</h3>
            <p className="text-sm text-[#171717] leading-relaxed bg-[#FAFAF7] p-4 rounded-2xl border border-[#E7E7E2]">
              {description || story || 'A traditional wooden craft made with love and care by skilled artisans in India.'}
            </p>
          </div>

          {/* Made by / Artisan Info */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#666666]">Made by</h3>
            <div className="flex items-center gap-3 bg-[#FAFAF7] p-4 rounded-2xl border border-[#E7E7E2]">
              <div className="w-10 h-10 rounded-full bg-[#176B4D] text-white flex items-center justify-center font-bold text-sm">
                R
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#171717]">{product.seller?.name || 'Ravi Kumar'}</h4>
                <p className="text-xs text-[#666666]">Master Artisan • {product.region_of_origin || 'Kondapalli, Andhra Pradesh'}</p>
              </div>
            </div>
          </div>

          {/* Screen 7 Bottom CTAs */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                onClose();
                if (onOpenOrderModal) onOpenOrderModal('ORDER');
              }}
              className="py-3.5 bg-[#176B4D] hover:bg-[#0F4D38] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Buy Now</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onOpenOrderModal) onOpenOrderModal('ENQUIRY');
              }}
              className="py-3.5 bg-[#FAFAF7] hover:bg-stone-100 text-[#171717] font-semibold text-sm rounded-2xl border border-[#E7E7E2] transition-all"
            >
              Add to Cart
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
