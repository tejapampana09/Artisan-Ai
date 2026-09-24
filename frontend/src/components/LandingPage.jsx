import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Store, 
  ShoppingBag, 
  Mic, 
  ShieldCheck, 
  ArrowRight, 
  Star,
  MapPin,
  Award,
  Heart,
  Truck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Compass
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getProducts } from '../api/index.js';
import { getLocalizedProductField } from '../utils/multilingual.js';

export default function LandingPage({ onSelectMode, onOpenAuth, user }) {
  const { language, t } = useLanguage();
  const [realProducts, setRealProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Full-Screen Carousel Banners — Clean, Bold, Minimal Text
  const heroBanners = [
    {
      id: 1,
      title: 'Handcrafted with Soul, Direct from Artisans',
      subtitle: 'Authentic Indian heritage crafts with guaranteed 100% fair artisan profit and zero middleman markups.',
      buttonText: 'Shop Heirloom Crafts',
      secondaryText: 'Join as an Artisan',
      secondaryMode: 'BECOME_ARTISAN',
      badge: '100% Handcrafted Heritage',
      bgImage: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1920&q=85',
      craftName: 'Kalamkari Natural Dye Textile',
      origin: 'Srikalahasti, Andhra Pradesh',
      artisan: 'Master Weaver Narayana',
      price: '₹3,450',
      rating: '4.9'
    },
    {
      id: 2,
      title: 'Preserving India’s Living Cultural Heritage',
      subtitle: 'Direct from master weavers and rural sculptors with voice AI catalogs and living wage protection.',
      buttonText: 'Explore Collection',
      secondaryText: 'Meet the Artisans',
      secondaryMode: 'ARTISANS',
      badge: 'Zero Middleman Markups',
      bgImage: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1920&q=85',
      craftName: 'Jaipur Traditional Blue Pottery',
      origin: 'Jaipur, Rajasthan',
      artisan: 'Master Artisan Kripal Singh',
      price: '₹1,850',
      rating: '4.9'
    },
    {
      id: 3,
      title: 'Voice-AI Powered Direct Fair Trade',
      subtitle: 'Rural craftspeople simply speak in their mother tongue to list creations online with a 20%+ profit floor.',
      buttonText: 'Join as an Artisan',
      secondaryText: 'Browse Marketplace',
      secondaryMode: 'BUY',
      badge: 'Fair Cost-Plus Guarantee',
      bgImage: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1920&q=85',
      craftName: 'Etikoppaka Botanical Lacquer Toys',
      origin: 'Visakhapatnam, Andhra Pradesh',
      artisan: 'Master Sculptor CV Raju',
      price: '₹950',
      rating: '4.8'
    }
  ];

  // Auto slide carousel every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % heroBanners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroBanners.length]);

  const nextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % heroBanners.length);
  };

  const prevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);
  };

  // 6 Traditional Indian Heritage Crafts (Minimal, punchy info)
  const craftCategories = [
    {
      id: 'kalamkari',
      name: 'Kalamkari Handlooms',
      telugu: 'కలంకారీ వస్త్రాలు',
      origin: 'Andhra Pradesh',
      tag: 'Heritage Art',
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'etikoppaka',
      name: 'Etikoppaka Lacquer Toys',
      telugu: 'ఏటికొప్పాక చెక్క బొమ్మలు',
      origin: 'Andhra Pradesh',
      tag: 'Eco Lacquer',
      image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'pottery',
      name: 'Jaipur Blue Pottery',
      telugu: 'జయపుర బ్లూ కుండల కళ',
      origin: 'Rajasthan',
      tag: 'Quartz Art',
      image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'bidriware',
      name: 'Bidriware Silver Inlay',
      telugu: 'బిద్రి వెండి చెక్కడాలు',
      origin: 'Karnataka',
      tag: 'Sterling Silver',
      image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'terracotta',
      name: 'Terracotta & Clay Art',
      telugu: 'టెర్రకోటా మట్టి పాత్రలు',
      origin: 'West Bengal',
      tag: 'Burnt Clay',
      image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'ikat',
      name: 'Pochampally Ikat Silks',
      telugu: 'పోచంపల్లి ఇక్కత్ చీరలు',
      origin: 'Telangana',
      tag: 'Handloom Art',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80'
    }
  ];

  // Fetch real published products
  useEffect(() => {
    let isMounted = true;
    async function fetchRealMarketplaceData() {
      try {
        setLoadingProducts(true);
        const data = await getProducts({ status: 'PUBLISHED' });
        if (isMounted && Array.isArray(data)) {
          setRealProducts(data);
        }
      } catch (err) {
        console.error('Failed to load real products on landing page:', err);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    }
    fetchRealMarketplaceData();
    return () => { isMounted = false; };
  }, []);

  const currentBanner = heroBanners[currentBannerIndex];

  return (
    <div className="w-full space-y-12 sm:space-y-16 pb-16 animate-fade-in font-sans m-0 p-0">
      
      {/* 1. FULL-SCREEN EDGE-TO-EDGE HERO CAROUSEL WITH OVERLAID BLENDED NAVBAR */}
      <section className="relative w-full h-screen min-h-[580px] overflow-hidden bg-stone-900 m-0 p-0 rounded-none border-none">
        {/* Background Full-Bleed Image */}
        <img
          key={currentBanner.id}
          src={currentBanner.bgImage}
          alt={currentBanner.title}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 brightness-[0.75]"
        />

        {/* Ambient balanced overlay */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40" />

        {/* Hero Content Container (Centered & Symmetrically Balanced) */}
        <div className="relative z-10 max-w-4xl mx-auto h-full px-6 sm:px-10 flex flex-col justify-center items-center text-center pt-16 space-y-5">
          {/* Minimal Badge */}
          <div className="inline-flex items-center space-x-2 bg-amber-400/20 text-amber-300 border border-amber-400/30 px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{currentBanner.badge}</span>
          </div>

          {/* Bold, Clean Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.14] font-serif-luxury drop-shadow-lg max-w-3xl">
            {currentBanner.title}
          </h1>

          {/* 1-Line Clean Subtitle */}
          <p className="text-sm sm:text-base md:text-lg text-stone-200 font-normal leading-relaxed max-w-2xl drop-shadow-md">
            {currentBanner.subtitle}
          </p>

          {/* Dual CTAs */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => {
                if (currentBannerIndex === 2) {
                  onSelectMode('BECOME_ARTISAN');
                } else {
                  onSelectMode('BUY');
                }
              }}
              className="px-8 py-3.5 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold text-sm rounded-xl transition-all cursor-pointer inline-flex items-center space-x-2 shadow-lg hover:shadow-xl active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{currentBanner.buttonText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSelectMode(currentBanner.secondaryMode)}
              className="px-7 py-3.5 bg-white/20 hover:bg-white/30 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer backdrop-blur-md border border-white/30 active:scale-95 inline-flex items-center space-x-2"
            >
              {currentBanner.secondaryMode === 'ARTISANS' ? (
                <Users className="w-4 h-4 text-amber-300" />
              ) : (
                <Store className="w-4 h-4 text-amber-300" />
              )}
              <span>{currentBanner.secondaryText}</span>
            </button>
          </div>
        </div>

        {/* Slider Circular Navigation Arrows */}
        <button
          onClick={prevBanner}
          aria-label="Previous Slide"
          className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/35 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer border border-white/20 hover:scale-105 active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={nextBanner}
          aria-label="Next Slide"
          className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/35 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer border border-white/20 hover:scale-105 active:scale-95"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Minimal Bottom Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2">
          {heroBanners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentBannerIndex(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentBannerIndex === idx ? 'bg-amber-400 w-8' : 'bg-white/45 hover:bg-white/80 w-2'
              }`}
            />
          ))}
        </div>
      </section>

      {/* 2. MICRO-TRUST METRIC STRIP (CENTERED & CLEAN) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#FDFBF7] border border-[#E8E2D9] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-[#E8E2D9]">
            <div className="flex items-center space-x-3 pt-2 md:pt-0">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1C]">100% Handcrafted</h4>
                <p className="text-[11px] text-[#6B6B6B]">Authentic craft heritage</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2 md:pt-0 md:pl-5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1C]">Fair Profit Guarantee</h4>
                <p className="text-[11px] text-[#6B6B6B]">20%+ artisan floor margin</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2 md:pt-0 md:pl-5">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1C]">Voice AI in 5 Languages</h4>
                <p className="text-[11px] text-[#6B6B6B]">Rural creators sell by voice</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2 md:pt-0 md:pl-5">
              <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1C]">All-India Safe Transit</h4>
                <p className="text-[11px] text-[#6B6B6B]">Direct from artisan cluster</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. EXPLORE BY HERITAGE CRAFT (CLEAN & VISUAL) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury text-[#1C1C1C] tracking-tight">
              Explore Heritage Crafts
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
              Iconic traditional crafts handcrafted across India
            </p>
          </div>
          <button 
            onClick={() => onSelectMode('BUY')}
            className="text-xs sm:text-sm font-bold text-[#A6533B] hover:text-[#88412F] transition-colors inline-flex items-center space-x-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {craftCategories.map((craft) => (
            <div 
              key={craft.id}
              onClick={() => onSelectMode('BUY')}
              className="group cursor-pointer rounded-2xl bg-white border border-[#E8E2D9] overflow-hidden shadow-2xs hover:shadow-md hover:border-[#A6533B]/50 transition-all flex flex-col"
            >
              <div className="aspect-square w-full overflow-hidden bg-stone-100 relative">
                <img 
                  src={craft.image} 
                  alt={craft.name}
                  className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-300"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=600&q=80';
                  }}
                />
                <span className="absolute top-2 left-2 bg-black/65 backdrop-blur-xs text-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {craft.tag}
                </span>
              </div>
              <div className="p-3 space-y-1">
                <h3 className="font-bold text-xs sm:text-sm text-[#1C1C1C] group-hover:text-[#A6533B] transition-colors truncate">
                  {craft.name}
                </h3>
                <p className="text-[11px] text-[#6B6B6B] flex items-center space-x-1">
                  <MapPin className="w-3 h-3 text-[#A6533B] shrink-0" />
                  <span className="truncate">{craft.origin}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. CURATED HEIRLOOM PIECES (REAL PUBLISHED PRODUCTS) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury text-[#1C1C1C] tracking-tight">
              Featured Pieces
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
              Direct from verified rural artisans
            </p>
          </div>
          <button 
            onClick={() => onSelectMode('BUY')}
            className="text-xs sm:text-sm font-bold text-[#A6533B] hover:text-[#88412F] transition-colors inline-flex items-center space-x-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loadingProducts ? (
          <div className="py-16 text-center text-[#6B6B6B] space-y-3 bg-[#FAF7F2] rounded-2xl border border-[#E8E2D9]">
            <Loader2 className="w-7 h-7 text-[#A6533B] animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading authentic artisan products...</p>
          </div>
        ) : realProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {realProducts.slice(0, 8).map((prod) => {
              const localizedTitle = getLocalizedProductField(prod, 'title', language);
              return (
                <div 
                  key={prod.id}
                  onClick={() => onSelectMode('BUY')}
                  className="group cursor-pointer rounded-2xl bg-white border border-[#E8E2D9] overflow-hidden shadow-2xs hover:shadow-lg hover:border-[#A6533B]/40 transition-all duration-300 flex flex-col"
                >
                  <div className="aspect-4/5 w-full overflow-hidden bg-stone-100 relative">
                    <img 
                      src={prod.image_url || 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=600&q=80'} 
                      alt={localizedTitle}
                      className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-xs text-[#A6533B] text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                      {prod.category || 'Handicraft'}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMode('WISHLIST');
                      }}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/85 hover:bg-white text-stone-700 hover:text-[#A6533B] transition-colors shadow-xs"
                      aria-label="Wishlist"
                    >
                      <Heart className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-[#1C1C1C] group-hover:text-[#A6533B] transition-colors line-clamp-1">
                        {localizedTitle}
                      </h3>
                      <p className="text-xs text-[#6B6B6B] flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-[#A6533B]" />
                        <span>{prod.origin_region || 'India'}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Direct Price</span>
                        <span className="font-extrabold text-sm sm:text-base text-[#1C1C1C]">₹{Number(prod.price).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center space-x-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md text-xs font-semibold">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>4.9</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-[#6B6B6B] bg-[#FAF7F2] rounded-2xl border border-[#E8E2D9]">
            <p className="text-sm">No live products available yet.</p>
          </div>
        )}
      </section>

      {/* 6. THE ARTISAN AI ADVANTAGE (3 CONCISE PILLARS) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#FAF7F2] rounded-3xl p-6 sm:p-10 border border-[#E8E2D9] space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className="text-[11px] font-bold tracking-widest text-[#A6533B] uppercase">
              Fair Trade Technology
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury text-[#1C1C1C] tracking-tight">
              The Artisan AI Advantage
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6B6B]">
              Ethical tech built specifically for rural Indian craftspeople.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl p-5 border border-[#E8E2D9] shadow-2xs hover:shadow-md transition-all space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#933D1E]">
                <Mic className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-[#1C1C1C]">Voice-First AI Studio</h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed">
                Artisans speak in Telugu, Hindi, Tamil, Bengali, or English. Gemini AI transforms spoken descriptions into instant marketplace listings.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-[#E8E2D9] shadow-2xs hover:shadow-md transition-all space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-[#1C1C1C]">20%+ Margin Guard</h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed">
                Strict cost-plus algorithms compute raw materials and hours with an untouchable 20% minimum profit floor.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-[#E8E2D9] shadow-2xs hover:shadow-md transition-all space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-[#1C1C1C]">Zero Middlemen</h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed">
                Digital Craft Passports trace every piece directly to the maker with 100% direct remuneration.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ARTISAN INVITATION CALLOUT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-[#9E472A] via-[#A6533B] to-[#8C3B20] text-white rounded-3xl p-6 sm:p-10 shadow-md border border-[#A6533B]/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl text-center md:text-left">
            <span className="text-xs uppercase tracking-widest text-amber-200 font-bold block">
              Artisan Empowerment Initiative
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury text-white tracking-tight">
              Are You a Rural Craftsperson?
            </h3>
            <p className="text-xs sm:text-sm text-stone-100">
              Join India's fairest artisan marketplace. 6-step verified onboarding with 0% commission cuts.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              onClick={() => onSelectMode('BECOME_ARTISAN')}
              className="px-6 py-3 bg-amber-300 hover:bg-amber-200 text-stone-900 font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-sm cursor-pointer inline-flex items-center space-x-2 active:scale-95"
            >
              <span>Explore Onboarding</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onOpenAuth ? onOpenAuth('SELL') : onSelectMode('SELL')}
              className="px-5 py-3 bg-black/20 hover:bg-black/30 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all border border-white/20 backdrop-blur-xs cursor-pointer inline-flex items-center space-x-2 active:scale-95"
            >
              <Store className="w-4 h-4 text-amber-200" />
              <span>Studio Sign In</span>
            </button>
          </div>
        </div>
      </section>

      {/* 7. CINEMATIC VIDEO SHOWCASE (PLACED AT THE VERY END) */}
      <section className="relative w-full h-[420px] sm:h-[480px] md:h-[540px] overflow-hidden bg-stone-950 m-0 p-0 rounded-none border-none">
        {/* Background Loop Video */}
        <video
          src="/videos/artisan-craft-loop.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover absolute inset-0"
        />

        {/* Minimal Vignette for Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/40" />

        {/* Minimal, Punchy Content Overlay */}
        <div className="relative z-10 max-w-4xl mx-auto h-full px-6 flex flex-col justify-center items-center text-center space-y-4">
          <div className="inline-flex items-center space-x-2 bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Living Craft Heritage</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white font-serif-luxury tracking-tight drop-shadow-md">
            Meet the Hands Behind Every Craft
          </h2>

          <p className="text-sm sm:text-base text-stone-200 max-w-xl font-normal drop-shadow-sm">
            Watch generational artisans turn raw natural elements into timeless heirloom art. 100% direct remuneration with zero middlemen.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3.5">
            <button
              onClick={() => onSelectMode('BUY')}
              className="px-6 py-3 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 inline-flex items-center space-x-2"
            >
              <span>Explore Creations</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectMode('BECOME_ARTISAN')}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm rounded-xl backdrop-blur-md transition-all cursor-pointer border border-white/30 active:scale-95 inline-flex items-center space-x-2"
            >
              <Store className="w-4 h-4 text-amber-300" />
              <span>Join as an Artisan</span>
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
