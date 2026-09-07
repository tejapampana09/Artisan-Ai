import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, MapPin, ShoppingBag } from 'lucide-react';

export default function ImageOverviewModal({ isOpen, onClose, product, onBuyNow, onCustomOrder }) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showFullDetails, setShowFullDetails] = useState(false);

  if (!isOpen || !product) return null;

  const imageUrl = product.enhanced_image_url || product.image_url;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  const resetZoom = () => setZoomLevel(1);

  const hasOverviewData = product.craft_story || product.description || product.materials || product.production_time_days;

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-2xl flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-300 overflow-hidden select-none">
      {/* Liquid Glass Top Header Floating Pill (iOS Style) */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between z-20 pt-2 px-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-full bg-white/70 hover:bg-white text-stone-900 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-2xl border border-white/60 transition-all active:scale-95 cursor-pointer font-bold text-xs flex items-center space-x-1.5 ring-1 ring-black/5"
        >
          <X className="w-4 h-4" />
          <span>Close Overview</span>
        </button>

        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-white/70 backdrop-blur-2xl border border-white/60 rounded-full p-1 shadow-lg ring-1 ring-black/5">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className="p-1.5 text-stone-800 hover:text-black disabled:opacity-30 cursor-pointer rounded-full hover:bg-white/50 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-extrabold text-stone-900 px-1">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              className="p-1.5 text-stone-800 hover:text-black disabled:opacity-30 cursor-pointer rounded-full hover:bg-white/50 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <span className="px-3 py-1.5 rounded-full bg-amber-600 text-white font-extrabold text-[11px] backdrop-blur-md shadow-md border border-amber-300/40 uppercase tracking-wider hidden sm:inline-block">
            HD View
          </span>
        </div>
      </div>

      {/* Main Zoomable Image Canvas */}
      <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden py-4 my-auto">
        <div 
          className="relative transition-transform duration-300 ease-out cursor-grab active:cursor-grabbing max-h-[70vh] flex items-center justify-center"
          style={{ transform: `scale(${zoomLevel})` }}
          onDoubleClick={zoomLevel > 1 ? resetZoom : handleZoomIn}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="max-h-[65vh] max-w-full object-contain rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/20"
            />
          ) : (
            <div className="w-64 h-64 bg-stone-800 rounded-2xl flex items-center justify-center text-stone-400 font-bold text-sm">
              No Image Provided
            </div>
          )}
        </div>
      </div>

      {/* iOS Liquid Glass Bottom Overview Floating Player Bar */}
      <div className="w-full max-w-2xl mx-auto z-20 pb-2">
        <div className="bg-white/80 backdrop-blur-2xl border border-white/70 shadow-[0_16px_48px_rgba(0,0,0,0.25)] rounded-3xl p-4 ring-1 ring-black/5 space-y-3">
          {/* Mini Header Card */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3.5 min-w-0">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={product.title}
                  className="w-12 h-12 rounded-2xl object-cover border border-white/80 shadow-md shrink-0 cursor-pointer hover:scale-105 transition-transform"
                  onClick={resetZoom}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  {product.category && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#4A2E1B] text-white tracking-wider">
                      {product.category}
                    </span>
                  )}
                  {product.region_of_origin && (
                    <span className="text-[10px] font-semibold text-stone-600 flex items-center">
                      <MapPin className="w-3 h-3 text-amber-600 mr-0.5" />
                      {product.region_of_origin}
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-sm text-[#2C1A0E] truncate mt-0.5">
                  {product.title}
                </h3>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-lg font-black text-[#4A2E1B] block leading-tight">
                ₹{Number(product.price || 0).toLocaleString('en-IN')}
              </span>
              {hasOverviewData && (
                <button
                  type="button"
                  onClick={() => setShowFullDetails(!showFullDetails)}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline decoration-amber-500/50 cursor-pointer"
                >
                  {showFullDetails ? 'Hide Overview ▲' : 'Craft Overview ▼'}
                </button>
              )}
            </div>
          </div>

          {/* Expandable Real Craft Details Accordion */}
          {showFullDetails && hasOverviewData && (
            <div className="pt-2 border-t border-stone-200/60 space-y-2.5 animate-in slide-in-from-bottom-2 duration-200 text-xs">
              {(product.craft_story || product.description) && (
                <div className="bg-stone-100/80 p-3 rounded-2xl border border-stone-200/60 space-y-1">
                  <span className="font-bold text-stone-900 block text-[11px] uppercase tracking-wider">
                    {product.craft_story ? 'Heritage Story & Craft Process' : 'Craft Description'}
                  </span>
                  <p className="text-stone-700 leading-relaxed text-[11px]">
                    {product.craft_story || product.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {product.materials && (
                  <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60">
                    <span className="text-amber-900 font-semibold block text-[10px]">Materials Used</span>
                    <span className="font-bold text-amber-950">{product.materials}</span>
                  </div>
                )}
                {product.production_time_days && (
                  <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/60">
                    <span className="text-emerald-900 font-semibold block text-[10px]">Production Time</span>
                    <span className="font-bold text-emerald-950">{product.production_time_days} Days</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Action Buttons */}
          <div className="flex items-center space-x-2 pt-1">
            {onCustomOrder && (
              <button
                onClick={() => {
                  onClose();
                  onCustomOrder(product);
                }}
                className="px-4 py-2.5 border-2 border-stone-300 hover:border-[#4A2E1B] text-[#4A2E1B] font-bold text-xs rounded-2xl transition-all cursor-pointer shrink-0 bg-white/60"
              >
                Custom Order
              </button>
            )}

            {onBuyNow && (
              <button
                onClick={() => {
                  onClose();
                  onBuyNow(product);
                }}
                className="flex-1 py-2.5 bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Buy Now →</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
