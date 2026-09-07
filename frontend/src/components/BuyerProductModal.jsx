import React, { useState, useEffect } from 'react';
import { X, Heart, ShoppingBag, Send, ShieldCheck, MapPin, Sparkles, Check, CheckCircle2, Award, UserCheck, Clock, Hammer, Globe, RefreshCw, Maximize2, Tag, ArrowRight } from 'lucide-react';
import { recordEvent, translateProduct, getProducts } from '../api/index.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getLocalizedProductField } from '../utils/multilingual.js';
import ArtisanProfileModal from './ArtisanProfileModal.jsx';
import ReviewsSection from './ReviewsSection.jsx';
import ImageOverviewModal from './ImageOverviewModal.jsx';

export default function BuyerProductModal({ 
  product, 
  isOpen, 
  onClose, 
  isSaved, 
  onToggleSave, 
  onOpenOrder, 
  onOpenEnquiry,
  user,
  onOpenAuth,
  allProducts = [],
  onSelectProduct
}) {
  const { language, t } = useLanguage();
  const [showCertificate, setShowCertificate] = useState(false);
  const [showArtisanModal, setShowArtisanModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedData, setTranslatedData] = useState(null);
  const [fetchedSimilar, setFetchedSimilar] = useState([]);

  useEffect(() => {
    setTranslatedData(null);
  }, [product?.id, language]);

  // Fetch similar category products if allProducts is empty
  useEffect(() => {
    if (isOpen && product?.category && (!allProducts || allProducts.length === 0)) {
      getProducts({ category: product.category })
        .then((data) => {
          if (Array.isArray(data)) {
            setFetchedSimilar(data.filter((p) => p.id !== product.id));
          }
        })
        .catch((err) => console.error('Failed to fetch similar products:', err));
    }
  }, [isOpen, product?.id, product?.category, allProducts]);

  const pool = allProducts && allProducts.length > 0 ? allProducts : fetchedSimilar;
  const similarCrafts = pool
    .filter((p) => p.id !== product?.id && p.category === product?.category)
    .slice(0, 4);

  // Fallback to general products if category match is empty
  const displaySimilar = similarCrafts.length > 0 
    ? similarCrafts 
    : pool.filter((p) => p.id !== product?.id).slice(0, 4);

  const handleTranslateClick = async () => {
    if (!product) return;
    setIsTranslating(true);
    try {
      const res = await translateProduct({
        product_id: product.id,
        title: product.title,
        description: product.description,
        craft_story: product.craft_story,
        target_language: language
      });
      setTranslatedData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Track VIEW event when modal opens (ignoring seller self-views)
  useEffect(() => {
    if (isOpen && product?.id) {
      if (user && product.seller_id === user.id) {
        return; // Ignore self-views by the product owner
      }
      recordEvent({
        event_type: 'VIEW',
        product_id: product.id,
        category: product.category,
        metadata_info: `Buyer viewed ${product.title}`
      });
    }
  }, [isOpen, product?.id, product?.title, product?.category, product?.seller_id, user]);

  if (!isOpen || !product) return null;

  const displayTitle = translatedData?.title || getLocalizedProductField(product, 'title', language);
  const displayDesc = translatedData?.description || getLocalizedProductField(product, 'description', language);
  const displayStory = translatedData?.craft_story || getLocalizedProductField(product, 'craft_story', language);

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-[#FAF7F2] overflow-y-auto min-h-screen w-full flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Full Image Header with Top Overlays - Click Image for Full Overview */}
        <div 
          onClick={() => setShowOverviewModal(true)}
          className="relative w-full h-72 sm:h-96 bg-stone-900 shrink-0 cursor-pointer group overflow-hidden"
          title="Click to view 4K Image Overview"
        >
          <img
            src={product.enhanced_image_url || product.image_url}
            alt={displayTitle}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/40 pointer-events-none" />

          {/* Top Overlays: iOS Liquid Glass Blur Controls */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="absolute top-4 left-4 right-4 flex items-center justify-between z-10"
          >
            <button
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-full bg-white/70 hover:bg-white text-stone-900 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-2xl border border-white/60 transition-all cursor-pointer font-bold flex items-center space-x-1.5 text-xs active:scale-95 ring-1 ring-black/5"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTranslateClick}
                disabled={isTranslating}
                className="px-3.5 py-2.5 rounded-full bg-white/70 hover:bg-white text-stone-900 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-2xl border border-white/60 transition-all cursor-pointer font-bold flex items-center space-x-1.5 text-xs active:scale-95 ring-1 ring-black/5"
              >
                {isTranslating ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
                ) : (
                  <Globe className="w-4 h-4 text-amber-700" />
                )}
                <span>{isTranslating ? 'Translating...' : `Translate (${language.toUpperCase()})`}</span>
              </button>

              <button
                onClick={() => onToggleSave(product)}
                className={`p-2.5 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-2xl border transition-all cursor-pointer ring-1 ring-black/5 ${
                  isSaved
                    ? 'bg-rose-600 text-white border-rose-400 scale-105'
                    : 'bg-white/70 text-stone-700 hover:bg-white border-white/60'
                }`}
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* Floating Category Tag & Click to Zoom Badge */}
          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white bg-[#4A2E1B]/90 backdrop-blur-xl px-3 py-1 rounded-full border border-white/20 shadow-md">
                {product.category}
              </span>
              {(product.region_of_origin || product.seller?.location) && (
                <span className="text-xs font-medium text-stone-100 bg-black/50 backdrop-blur-xl px-3 py-1 rounded-full flex items-center border border-white/10">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 mr-1" />
                  <span>{product.region_of_origin || product.seller?.location}</span>
                </span>
              )}
            </div>

            <span className="text-[11px] font-bold text-stone-900 bg-white/80 backdrop-blur-xl px-3 py-1 rounded-full flex items-center space-x-1 shadow-lg border border-white/60 group-hover:bg-white transition-colors">
              <Maximize2 className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Tap for Overview</span>
            </span>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6 flex-1">
          {/* Title & Price Section */}
          <div className="space-y-2 border-b border-stone-200/80 pb-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C1A0E]">
              {displayTitle}
            </h1>

            <div className="flex justify-between items-center pt-1">
              <div>
                <span className="text-3xl font-black text-[#4A2E1B]">₹{Number(product.price || 0).toLocaleString('en-IN')}</span>
                <span className="text-xs text-stone-400 block font-medium">Direct Artisan Price</span>
              </div>

              <div>
                {product.stock > 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <Check className="w-3.5 h-3.5 mr-1" />
                    In Stock ({product.stock} available)
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    Out of Stock
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Feature Badges */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
              <span className="text-base block">✨</span>
              <span className="text-[11px] font-bold text-stone-800 block">Handcrafted</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
              <span className="text-base block">🌿</span>
              <span className="text-[11px] font-bold text-stone-800 block">Authentic</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
              <span className="text-base block">🤝</span>
              <span className="text-[11px] font-bold text-stone-800 block">Direct Seller</span>
            </div>
          </div>

          {/* Craft Description */}
          {displayDesc && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                Craft Description
              </h3>
              <p className="text-sm text-stone-700 leading-relaxed bg-white p-4 rounded-2xl border border-stone-200/80">
                {displayDesc}
              </p>
            </div>
          )}

          {/* Heritage Craft Story (Only rendered if story exists in database) */}
          {displayStory && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-widest flex items-center space-x-1">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Heritage Craft Story</span>
              </h3>
              <p className="text-sm text-stone-800 italic leading-relaxed bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
                "{displayStory}"
              </p>
            </div>
          )}

          {/* Craft Passport & Provenance */}
          <div className="p-4 bg-white rounded-2xl border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <span className="font-extrabold text-[#2C1A0E] text-xs flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-amber-700" />
                <span>🧾 Digital Craft Passport</span>
              </span>
              <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                {product.handmade_pct || 100}% Handmade
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-stone-400 block text-[11px]">Raw Materials:</span>
                <span className="font-semibold text-stone-800">{product.materials || 'Specified by Artisan'}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">Production Time:</span>
                <span className="font-semibold text-stone-800">{product.production_time_days ? `${product.production_time_days} Days` : 'Artisan Handcrafted'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCertificate(true)}
              className="w-full mt-1 py-2.5 bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              View Verified GI Heritage Certificate →
            </button>
          </div>

          {/* Meet Master Artisan Card */}
          <div className="p-4 bg-white rounded-2xl border border-stone-200/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-xl flex items-center justify-center font-bold text-amber-900 shrink-0">
                🎨
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-[#2C1A0E]">{product.seller?.name || 'Heritage Craft Artisan'}</h4>
                <p className="text-xs text-stone-500">
                  {product.seller?.craft || product.category} • {product.region_of_origin || product.seller?.location || 'India'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowArtisanModal(true)}
              className="text-xs font-extrabold text-[#4A2E1B] hover:underline"
            >
              View Profile
            </button>
          </div>

          {/* Verified Buyer Reviews & Ratings Section */}
          <ReviewsSection productId={product.id} user={user} product={product} />

          {/* Similar Heritage Crafts Section (Market Benchmark Comparison) */}
          {displaySimilar.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-stone-200/80">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#2C1A0E] flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-amber-700" />
                  <span>Similar Heritage Crafts ({product.category})</span>
                </h3>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Market Comparison
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {displaySimilar.map((simProd) => (
                  <div
                    key={simProd.id}
                    onClick={() => {
                      if (onSelectProduct) {
                        onSelectProduct(simProd);
                      }
                    }}
                    className="bg-white rounded-2xl p-2.5 border border-stone-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group space-y-2 flex flex-col justify-between"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-stone-100">
                      <img
                        src={simProd.enhanced_image_url || simProd.image_url || 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=400'}
                        alt={simProd.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold bg-[#4A2E1B]/90 text-white px-2 py-0.5 rounded-full backdrop-blur-xs shadow-xs">
                        ₹{Number(simProd.price || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-xs text-[#2C1A0E] line-clamp-1 group-hover:text-amber-800 transition-colors">
                        {simProd.title}
                      </h4>
                      <p className="text-[10px] text-stone-500 truncate mt-0.5">
                        {simProd.region_of_origin || 'Handmade Craft'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Action Bar (Screen 7 Design) */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-stone-200 p-3.5 px-4 shadow-2xl">
          <div className="max-w-3xl mx-auto flex items-center space-x-3">
            {user && product.seller_id === user.id ? (
              <div className="w-full text-center text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                Your Listed Craft (Artisan Owner)
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    onClose();
                    onOpenEnquiry(product);
                  }}
                  className="px-4 py-3.5 border-2 border-stone-300 hover:border-[#4A2E1B] text-[#4A2E1B] font-bold text-xs rounded-2xl transition-all cursor-pointer shrink-0"
                >
                  Custom Order
                </button>

                <button
                  onClick={() => {
                    if (product.stock <= 0) return;
                    onClose();
                    onOpenOrder(product, 'ORDER');
                  }}
                  disabled={product.stock <= 0}
                  className="flex-1 py-3.5 bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-extrabold text-sm rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{product.stock <= 0 ? 'Out of Stock' : 'Buy Now →'}</span>
                </button>
              </>
            )}
          </div>
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
                    <span className="font-bold text-indigo-700">{product.category}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-amber-100">
                    <span className="text-slate-500 font-medium">Verification Code:</span>
                    <span className="font-mono text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                      ART-GI-{product.id}-{(product.id * 98765).toString(16).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-amber-100">
                    <span className="text-slate-500 font-medium">Fair Price Status:</span>
                    <span className="font-bold text-emerald-700 flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified Fair Trade Price</span>
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <div className="text-left space-y-1">
                      <span className="text-[10px] text-slate-500 font-semibold block">Craft Origin:</span>
                      <p className="text-[11px] text-slate-700 leading-tight">
                        Handcrafted by {product.seller?.name || 'certified artisan'} in {product.region_of_origin || product.seller?.location || 'India'}.
                      </p>
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                        `${window.location.origin}/verify/product/${product.id}`
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

      {/* Artisan Profile Modal */}
      {showArtisanModal && (
        <ArtisanProfileModal
          artisanId={product.seller_id || 1}
          isOpen={showArtisanModal}
          onClose={() => setShowArtisanModal(false)}
          currentUser={user}
        />
      )}

      {/* iOS Liquid Glass Image Overview Lightbox Modal */}
      {showOverviewModal && (
        <ImageOverviewModal
          isOpen={showOverviewModal}
          onClose={() => setShowOverviewModal(false)}
          product={product}
          onBuyNow={(p) => {
            onClose();
            onOpenOrder(p, 'ORDER');
          }}
          onCustomOrder={(p) => {
            onClose();
            onOpenEnquiry(p);
          }}
        />
      )}
    </>
  );
}
