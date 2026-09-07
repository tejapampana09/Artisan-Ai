import React, { useState, useEffect } from 'react';
import { X, Heart, ShoppingBag, Send, ShieldCheck, MapPin, Sparkles, Check, CheckCircle2, Award, UserCheck, Clock, Hammer } from 'lucide-react';
import { recordEvent } from '../api/index.js';
import ArtisanProfileModal from './ArtisanProfileModal.jsx';
import ReviewsSection from './ReviewsSection.jsx';

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
  const [showCertificate, setShowCertificate] = useState(false);
  const [showArtisanModal, setShowArtisanModal] = useState(false);

  // Track VIEW event when modal opens
  useEffect(() => {
    if (isOpen && product?.id) {
      recordEvent({
        event_type: 'VIEW',
        product_id: product.id,
        category: product.category,
        metadata_info: `Buyer viewed ${product.title}`
      });
    }
  }, [isOpen, product?.id, product?.title, product?.category]);

  if (!isOpen || !product) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="flex justify-between items-start pb-3 border-b border-slate-100 shrink-0">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {product.category}
                </span>
                <span className="text-xs text-slate-500 flex items-center">
                  <MapPin className="w-3 h-3 text-amber-600 mr-1" />
                  <span>{product.region_of_origin || 'GI Heritage Artisan Cluster'}</span>
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">{product.title}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto pr-1 my-3 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
                  <img
                    src={product.enhanced_image_url || product.image_url}
                    alt={product.title}
                    className="w-full h-48 sm:h-52 object-cover"
                  />
                  <button
                    onClick={() => onToggleSave(product)}
                    className={`absolute top-2.5 right-2.5 p-2 rounded-full shadow-md backdrop-blur-md transition-all cursor-pointer ${
                      isSaved
                        ? 'bg-rose-600 text-white shadow-rose-600/30 scale-110'
                        : 'bg-white/80 text-slate-600 hover:text-rose-600 hover:bg-white'
                    }`}
                    title={isSaved ? "Remove from Wishlist" : "Save to Wishlist"}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <div className="mt-2.5 p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Fair Market Price:</span>
                    <span className="text-lg font-bold text-slate-900">₹{product.price.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px]">Stock Status:</span>
                    {product.stock > 0 ? (
                      <span className="font-semibold text-emerald-700">{product.stock} units available</span>
                    ) : (
                      <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        Out of Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Meet the Master Artisan Card */}
                <div className="mt-2.5 p-3 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border border-amber-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center">
                      <UserCheck className="w-3.5 h-3.5 text-amber-600 mr-1" />
                      Meet the Artisan
                    </span>
                    <button
                      onClick={() => setShowArtisanModal(true)}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-900 underline cursor-pointer"
                    >
                      View Profile
                    </button>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-200 border border-amber-300 flex items-center justify-center font-bold text-amber-900 shrink-0">
                      🎨
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Certified Heritage Master Artisan</p>
                      <p className="text-[11px] text-slate-600">Handcrafted in {product.region_of_origin || 'India'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {/* 🧾 Craft Passport */}
                <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-1">
                    <span className="font-bold text-amber-900 flex items-center space-x-1 text-xs">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>🧾 Craft Passport</span>
                    </span>
                    <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                      {product.handmade_pct || 100}% Handmade
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Raw Materials:</span>
                      <span className="font-semibold text-slate-800">{product.materials || 'Natural organic materials'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Production Time:</span>
                      <span className="font-semibold text-slate-800 flex items-center">
                        <Clock className="w-3 h-3 text-amber-600 mr-1" />
                        {product.production_time_days || 3} Days
                      </span>
                    </div>
                  </div>
                  {product.craft_process && (
                    <div className="pt-0.5 text-[11px]">
                      <span className="text-slate-500 block">Making Process:</span>
                      <p className="text-slate-700 leading-snug italic">{product.craft_process}</p>
                    </div>
                  )}
                </div>

                <div>
                  <span className="font-bold text-slate-800 block mb-0.5">Craft Description</span>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {product.description || 'Authentic handmade creation crafted using traditional artisan methods.'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-800 flex items-center space-x-1 mb-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Heritage Craft Story</span>
                  </span>
                  <p className="text-slate-700 leading-relaxed bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60 italic">
                    "{product.craft_story || 'Generational traditional technique crafted with organic materials.'}"
                  </p>
                </div>

                {/* GI Certificate & Provenance Action */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowCertificate(true)}
                    className="w-full inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-700 to-orange-800 hover:from-amber-800 hover:to-orange-900 text-white font-bold py-2 rounded-xl shadow-xs transition-all cursor-pointer text-xs"
                  >
                    <Award className="w-4 h-4 text-amber-300" />
                    <span>View Digital GI Heritage & Provenance Certificate</span>
                  </button>
                </div>

                {/* Action Buttons */}
                {user && product.seller_id === user.id ? (
                  <div className="pt-1 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-1">
                    <div className="flex items-center justify-center space-x-1.5 text-amber-900 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-amber-600" />
                      <span>Your Listed Craft (మీ ఉత్పత్తి)</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      You are the master artisan who created this listing.
                    </p>
                  </div>
                ) : (
                  <div className="pt-1 space-y-1.5">
                    {product.stock <= 0 ? (
                      <button
                        disabled
                        className="w-full inline-flex items-center justify-center space-x-2 bg-slate-100 text-slate-400 border border-slate-200 font-bold py-2 rounded-xl cursor-not-allowed"
                      >
                        <ShoppingBag className="w-4 h-4 text-slate-400" />
                        <span>Out of Stock (అందుబాటులో లేదు)</span>
                      </button>
                    ) : (
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
                    )}

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
                      <span>{product.stock <= 0 ? 'Request Custom Pre-Order' : 'Request B2B Bulk Enquiry'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Verified Buyer Reviews & Ratings Section */}
            <ReviewsSection productId={product.id} user={user} />
          </div>

          {/* Digital Heritage & GI Provenance Certificate Overlay Modal */}
          {showCertificate && (
            <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-amber-50/95 rounded-3xl max-w-lg w-full p-6 shadow-2xl border-4 border-amber-400 relative space-y-4 max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setShowCertificate(false)}
                  className="absolute top-4 right-4 p-1.5 bg-amber-200 text-amber-900 hover:bg-amber-300 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="text-center space-y-1 pt-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-200 border-2 border-amber-500 flex items-center justify-center text-amber-900 shadow-md">
                    <Award className="w-7 h-7" />
                  </div>
                  <h2 className="font-serif font-bold text-slate-900 text-lg tracking-wide uppercase">
                    Certificate of Authenticity
                  </h2>
                  <p className="text-[11px] font-bold text-amber-800 tracking-widest uppercase">
                    Geographical Indication (GI) & Heritage Craft Provenance
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs space-y-3 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-amber-100">
                    <span className="text-slate-500 font-medium">Craft Item:</span>
                    <span className="font-bold text-slate-900">{product.title}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-amber-100">
                    <span className="text-slate-500 font-medium">Category / Cluster:</span>
                    <span className="font-bold text-indigo-700">{product.category} GI Cluster</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-amber-100">
                    <span className="text-slate-500 font-medium">Cryptographic Hash:</span>
                    <span className="font-mono text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                      ART-GI-2026-{product.id}-{(product.id * 9999).toString(16).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-amber-100">
                    <span className="text-slate-500 font-medium">Fair Price Compliance:</span>
                    <span className="font-bold text-emerald-700 flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>SIH 2026 Fair Margin Verified</span>
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <div className="text-left space-y-1">
                      <span className="text-[10px] text-slate-500 font-semibold block">Craft Origin:</span>
                      <p className="text-[11px] text-slate-700 leading-tight">
                        Handmade by certified rural artisan using 100% natural heritage processes.
                      </p>
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                        `https://artisan-ai.gov.in/verify/ART-GI-2026-${product.id}`
                      )}`}
                      alt="Provenance Verification QR"
                      className="w-16 h-16 rounded border border-amber-300 shadow-2xs shrink-0"
                    />
                  </div>
                </div>

                <div className="text-center pt-1">
                  <button
                    onClick={() => setShowCertificate(false)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                  >
                    Close Provenance Certificate
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Artisan Profile Modal */}
      {showArtisanModal && (
        <ArtisanProfileModal
          artisanId={product.seller_id || 1}
          isOpen={showArtisanModal}
          onClose={() => setShowArtisanModal(false)}
          currentUser={user}
        />
      )}
    </>
  );
}
