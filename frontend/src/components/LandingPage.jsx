import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Store, 
  ShoppingBag, 
  Mic, 
  ShieldCheck, 
  TrendingUp, 
  MessageSquare, 
  WifiOff, 
  ArrowRight, 
  CheckCircle2, 
  Search,
  Star,
  MapPin,
  Award,
  Heart,
  Tag,
  Truck,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getProducts } from '../api/index.js';
import { getLocalizedProductField } from '../utils/multilingual.js';

export default function LandingPage({ onSelectMode, onOpenAuth, user }) {
  const { language, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [realProducts, setRealProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Indian Handicrafts & Handloom Banner Slider Data
  const heroBanners = [
    {
      id: 1,
      title: 'Handcrafted with Soul, Direct from Artisans',
      subtitle: 'Authentic Kalamkari textiles, Etikoppaka lacquer toys, Jaipur pottery & Bidriware silver art',
      buttonText: 'Shop Handicrafts',
      buttonColor: 'bg-[#933D1E] hover:bg-[#7E3216]',
      bgImage: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1600&q=80',
      badge: '100% Authentic Indian Craft'
    },
    {
      id: 2,
      title: 'Preserving Timeless Cultural Heritage',
      subtitle: 'Handmade by traditional rural artisans across India — zero middleman markups',
      buttonText: 'Explore Collection',
      buttonColor: 'bg-[#E85A71] hover:bg-[#d4485e]',
      bgImage: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1600&q=80',
      badge: 'GI Tag Certified Heritage'
    },
    {
      id: 3,
      title: 'Voice-AI Powered Direct Fair Trade',
      subtitle: 'Empowering rural craftspeople in 5 Indian languages with guaranteed profit protection',
      buttonText: 'Join as Artisan',
      buttonColor: 'bg-amber-600 hover:bg-amber-700',
      bgImage: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1600&q=80',
      badge: 'Zero Commission Cuts'
    }
  ];

  // Auto slide carousel every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % heroBanners.length);
  };

  const prevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);
  };

  // Real Craft Categories (Traditional Indian Craft Heritage Types)
  const craftCategories = [
    {
      id: 'kalamkari',
      categoryKey: 'Kalamkari',
      name: 'Kalamkari Handlooms',
      telugu: 'కలంకారీ వస్త్రాలు',
      hi: 'कलमकारी वस्त्र',
      ta: 'கலம்காரி ஜவுளி',
      bn: 'কলমকারী টেক্সটাইল',
      origin: 'Srikalahasti & Machilipatnam, AP',
      tag: 'GI Tagged Heritage',
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
      description: 'Hand-painted cotton textiles crafted using 100% natural organic vegetable dyes.'
    },
    {
      id: 'etikoppaka',
      categoryKey: 'Wooden Toys',
      name: 'Etikoppaka Lacquer Toys',
      telugu: 'ఏటికొప్పాక చెక్క బొమ్మలు',
      hi: 'एटीकोप्पका लकड़ी के खिलौने',
      ta: 'ஏடிகொப்பகா மர பொம்மைகள்',
      bn: 'এটিকোপ্পাকা কাঠের খেলনা',
      origin: 'Visakhapatnam, AP',
      tag: 'Eco Lacquer Polish',
      image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=600&q=80',
      description: 'Turned soft wood figurines glazed with non-toxic botanical lac polish.'
    },
    {
      id: 'pottery',
      categoryKey: 'Blue Pottery',
      name: 'Jaipur Blue Pottery',
      telugu: 'జయపుర బ్లూ కుండల కళ',
      hi: 'जयपुर ब्लू पॉटरी',
      ta: 'ஜெய்ப்பூர் ப்ளூ பாட்டரி',
      bn: 'জয়পুর બ્લૂ પટરી',
      origin: 'Jaipur, Rajasthan',
      tag: 'Quartz Ceramic Art',
      image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80',
      description: 'Vibrant cobalt blue glazed ceramics made without clay using ground quartz stone.'
    },
    {
      id: 'bidriware',
      categoryKey: 'Bidriware',
      name: 'Bidriware Silver Inlay',
      telugu: 'బిద్రి వెండి చెక్కడాలు',
      hi: 'बीदरी सिल्वर जड़ाई क्राफ्ट',
      ta: 'பித்ரி வெள்ளி கைவினை',
      bn: 'বিদ্রি রৌপ্য কারுশিল্প',
      origin: 'Bidar, Karnataka',
      tag: '800-Year Alloy Art',
      image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
      description: 'Blackened zinc-copper alloy intricately inlaid with 99.9% sterling silver.'
    },
    {
      id: 'terracotta',
      categoryKey: 'Terracotta',
      name: 'Terracotta & Clay Art',
      telugu: 'టెర్రకోటా మట్టి పాత్రలు',
      hi: 'टेराकोटा मिट्टी के बर्तन',
      ta: 'சுடுமண் கலை',
      bn: 'টেরাকোটা মৃৎশিল্প',
      origin: 'Bankura, West Bengal',
      tag: 'Earth-Fired Heritage',
      image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80',
      description: 'Traditional burnt-clay decorative artifacts and Bankura horses.'
    },
    {
      id: 'ikat',
      categoryKey: 'Pochampally Ikat',
      name: 'Pochampally Ikat Silks',
      telugu: 'పోచంపల్లి ఇక్కత్ చీరలు',
      hi: 'पोचमपल्ली इकत साड़ी',
      ta: 'போச்சம்பள்ளி இக்கத் பட்டு',
      bn: 'পোচমপল্লী ইকাত সিল্ক',
      origin: 'Pochampally, Telangana',
      tag: 'GI Tag Weave',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
      description: 'Intricate geometric dyed silk threads woven into heirloom sarees.'
    }
  ];

  // Fetch REAL published products dynamically from backend DB
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

  const features = [
    {
      icon: <Mic className="w-6 h-6 text-[#933D1E]" />,
      titleKey: 'voiceAiFeatureTitle',
      defaultTitle: 'Voice-First AI Cataloging',
      descKey: 'voiceAiFeatureDesc',
      defaultDesc: 'Artisans simply speak in Telugu, Hindi, Tamil, Bengali, or English. Gemini AI transforms spoken audio and craft photos into instant e-commerce listings.'
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
      titleKey: 'costPlusFeatureTitle',
      defaultTitle: 'Cost-Plus Fair Margin Guard',
      descKey: 'costPlusFeatureDesc',
      defaultDesc: 'Guarantees rural creators are never underpaid. Strict cost-plus formulas compute raw materials, skilled hours, and festival demand with a minimum 20% profit floor.'
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-blue-600" />,
      titleKey: 'directWholesaleFeatureTitle',
      defaultTitle: 'Direct Wholesale & Buyer Enquiries',
      descKey: 'directWholesaleFeatureDesc',
      defaultDesc: 'Zero middleman commissions. Buyers submit custom and wholesale enquiries that flow straight to artisan dashboards with 1-click WhatsApp and Phone calling.'
    },
    {
      icon: <WifiOff className="w-6 h-6 text-[#933D1E]" />,
      titleKey: 'offlineFeatureTitle',
      defaultTitle: 'Rural Offline-First Resilience',
      descKey: 'offlineFeatureDesc',
      defaultDesc: 'Engineered for remote artisan villages with weak connectivity. Full local caching with seamless automatic cloud synchronization when network restores.'
    }
  ];

  const getCraftSubName = (craft) => {
    if (language === 'te') return craft.telugu;
    if (language === 'hi') return craft.hi;
    if (language === 'ta') return craft.ta;
    if (language === 'bn') return craft.bn;
    return craft.name;
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSelectMode('BUY');
  };

  return (
    <div className="space-y-10 pb-16 animate-fade-in font-sans">
      
      {/* Kreate World Style Banner Slider Carousel */}
      <section className="relative rounded-3xl overflow-hidden shadow-2xl h-[400px] sm:h-[480px] lg:h-[520px] border border-stone-800/40 group">
        {heroBanners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              index === currentBannerIndex ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {/* Dark contrast overlay over background image */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30 z-10"></div>
            <img 
              src={banner.bgImage} 
              alt={banner.title} 
              className="w-full h-full object-cover object-center"
            />
            
            {/* Banner Content (Kreate World Exact Typography & Button Layout) */}
            <div className="absolute inset-0 z-20 flex flex-col justify-center px-8 sm:px-14 lg:px-20 max-w-3xl space-y-5">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/20 text-amber-200 text-xs font-semibold backdrop-blur-md w-fit border border-white/25">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>{banner.badge}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-none drop-shadow-md">
                {banner.title}
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-stone-200 font-normal leading-relaxed max-w-xl drop-shadow-xs">
                {banner.subtitle}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => onSelectMode('BUY')}
                  className={`px-8 py-3.5 rounded-full text-white font-bold text-sm sm:text-base shadow-2xl transition-all transform hover:scale-105 cursor-pointer flex items-center space-x-2.5 ${banner.buttonColor}`}
                >
                  <span>{banner.buttonText}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Prev/Next Buttons */}
        <button
          onClick={prevBanner}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer border border-white/20"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={nextBanner}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer border border-white/20"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Carousel Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex space-x-2">
          {heroBanners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentBannerIndex(idx)}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${
                idx === currentBannerIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'
              }`}
            ></button>
          ))}
        </div>
      </section>

      {/* Kreate World Style Search & Category Bar */}
      <section className="bg-white rounded-3xl p-6 border border-[#EADFCF] shadow-sm space-y-4 max-w-5xl mx-auto">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center bg-[#FBF8F3] rounded-2xl p-2 border border-[#EADFCF]">
          <Search className="w-5 h-5 text-stone-400 ml-3 shrink-0" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Kalamkari, Etikoppaka toys, Blue pottery, Silk sarees, Organic crafts..."
            className="w-full px-3 py-2 text-sm text-[#2A1E17] placeholder-stone-400 bg-transparent focus:outline-hidden font-medium"
          />
          <button 
            type="submit"
            className="bg-[#933D1E] hover:bg-[#7E3216] text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Search</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {['Kalamkari', 'Etikoppaka Toys', 'Blue Pottery', 'Bidriware', 'Terracotta', 'Pochampally Silks'].map((chip, idx) => (
            <button 
              key={idx}
              onClick={() => onSelectMode('BUY')}
              className="px-3.5 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-amber-100 border border-[#EADFCF] text-[#2A1E17] text-[11px] font-semibold transition-colors cursor-pointer"
            >
              ✨ {chip}
            </button>
          ))}
        </div>
      </section>

      {/* Role Selection Entry Portal */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Role 1: Artisan */}
        <div
          onClick={() => {
            if (user) {
              onSelectMode('SELL');
            } else {
              onOpenAuth();
            }
          }}
          className="group p-6 sm:p-8 rounded-3xl bg-[#FBF8F3] border-2 border-[#EADFCF] hover:border-[#933D1E] transition-all cursor-pointer flex flex-col justify-between space-y-6 shadow-sm hover:shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#933D1E]/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#933D1E] text-white flex items-center justify-center shadow-md">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#933D1E] uppercase tracking-wider">For Craft Makers</span>
              <h3 className="font-serif font-bold text-2xl text-[#2A1E17] group-hover:text-[#933D1E] pt-1 transition-colors">
                I am a Rural Artisan
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6B5B51] leading-relaxed">
              Catalog products in 30 seconds using Multilingual Voice AI (Telugu, Hindi, Tamil, Bengali). Get guaranteed cost-plus profit protection.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 text-xs font-bold text-[#933D1E] border-t border-[#EADFCF]">
            <span className="flex items-center space-x-1.5">
              <Mic className="w-4 h-4 text-[#933D1E]" />
              <span>{user ? t('artisanStudio', 'Enter Artisan Studio') : t('startAsArtisan', 'Voice Sign In / Register')}</span>
            </span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
          </div>
        </div>

        {/* Role 2: Buyer */}
        <div
          onClick={() => onSelectMode('BUY')}
          className="group p-6 sm:p-8 rounded-3xl bg-white border-2 border-[#EADFCF] hover:border-[#2A1E17] transition-all cursor-pointer flex flex-col justify-between space-y-6 shadow-sm hover:shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-stone-100 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>

          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2A1E17] text-white flex items-center justify-center shadow-md">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#2A1E17] uppercase tracking-wider">For Conscious Shoppers & Buyers</span>
              <h3 className="font-serif font-bold text-2xl text-[#2A1E17] pt-1">
                I am a Buyer / Wholesaler
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#6B5B51] leading-relaxed">
              Explore authentic GI-tagged handicrafts, connect directly with master artisans, transparent pricing breakdown with zero commission markup.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 text-xs font-bold text-[#2A1E17] border-t border-[#EADFCF]">
            <span className="flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-amber-700" />
              <span>Explore Marketplace Catalog</span>
            </span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
          </div>
        </div>
      </section>

      {/* Featured Indian Heritage Categories */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#EADFCF] pb-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-[#933D1E] uppercase tracking-wider mb-1">
              <Award className="w-4 h-4 text-[#933D1E]" />
              <span>Authentic Cultural Heritage</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-serif text-[#2A1E17]">
              Explore Traditional Craft Disciplines
            </h2>
          </div>
          <button 
            onClick={() => onSelectMode('BUY')}
            className="inline-flex items-center space-x-2 text-xs font-bold text-[#933D1E] hover:text-[#7E3216] transition-colors cursor-pointer group shrink-0"
          >
            <span>View All Categories</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {craftCategories.map((craft) => (
            <div 
              key={craft.id}
              onClick={() => onSelectMode('BUY')}
              className="bg-[#FBF8F3] rounded-2xl overflow-hidden border border-[#EADFCF] shadow-xs hover:border-[#933D1E] hover:shadow-xl transition-all flex flex-col group cursor-pointer"
            >
              <div className="relative h-52 overflow-hidden bg-[#F4EBE1]">
                <img 
                  src={craft.image} 
                  alt={craft.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=600&q=80';
                  }}
                />
                <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-amber-300 px-3 py-1 rounded-full text-[10px] font-bold border border-amber-400/30 shadow-xs">
                  {craft.tag}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold font-serif text-[#2A1E17] text-base group-hover:text-[#933D1E] transition-colors">
                    {language === 'en' ? craft.name : getCraftSubName(craft)}
                  </h3>
                  {language !== 'en' && (
                    <div className="text-xs text-[#933D1E] font-medium mt-0.5">{craft.name}</div>
                  )}
                  <div className="text-[11px] text-[#6B5B51] mt-1.5 flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-[#933D1E]" />
                    <span>{craft.origin}</span>
                  </div>
                  <p className="text-xs text-[#6B5B51] mt-2 line-clamp-2 leading-relaxed">
                    {craft.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#EADFCF]">
                  <span className="text-xs font-bold text-[#933D1E] flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                    <span>Browse {craft.name}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* REAL Live Published Products Section */}
      <section className="bg-gradient-to-b from-[#FBF8F3] to-white rounded-3xl p-6 sm:p-10 border border-[#EADFCF] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Real Live Published Crafts</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-serif text-[#2A1E17]">
              Handcrafted Items Direct from Artisans
            </h2>
          </div>
          <button 
            onClick={() => onSelectMode('BUY')}
            className="px-5 py-2.5 rounded-xl bg-[#933D1E] hover:bg-[#7E3216] text-white text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
          >
            Explore Marketplace ({realProducts.length} Items)
          </button>
        </div>

        {loadingProducts ? (
          <div className="py-12 text-center text-stone-500 space-y-3">
            <Loader2 className="w-8 h-8 text-[#933D1E] animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading live artisan products from database...</p>
          </div>
        ) : realProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
            {realProducts.slice(0, 8).map((prod) => {
              const localizedTitle = getLocalizedProductField(prod, 'title', language);
              const localizedDesc = getLocalizedProductField(prod, 'description', language);
              return (
                <div 
                  key={prod.id}
                  onClick={() => onSelectMode('BUY')}
                  className="bg-white rounded-2xl border border-[#EADFCF] overflow-hidden hover:border-[#933D1E] shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="relative h-48 overflow-hidden bg-stone-100">
                    <img 
                      src={prod.image_url || 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=600&q=80'} 
                      alt={localizedTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <div className="absolute top-2.5 left-2.5 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                      ≥20% Margin Protected
                    </div>
                  </div>

                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                        <span className="flex items-center space-x-1 font-medium text-[#933D1E]">
                          <Tag className="w-3 h-3" />
                          <span>{prod.category || 'Handicraft'}</span>
                        </span>
                      </div>

                      <h3 className="font-bold text-xs text-[#2A1E17] group-hover:text-[#933D1E] line-clamp-2 transition-colors">
                        {localizedTitle}
                      </h3>
                      <p className="text-[11px] text-stone-500 mt-1 line-clamp-2">
                        {localizedDesc}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#EADFCF] flex items-center justify-between">
                      <div>
                        <span className="text-base font-bold text-[#933D1E]">₹{Number(prod.price).toLocaleString('en-IN')}</span>
                      </div>
                      <button className="bg-[#FAF7F2] hover:bg-amber-100 text-[#933D1E] px-3 py-1.5 rounded-xl border border-[#EADFCF] text-xs font-bold transition-colors">
                        View Item
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-[#FBF8F3] rounded-2xl border border-[#EADFCF] space-y-3">
            <ShoppingBag className="w-10 h-10 text-stone-400 mx-auto" />
            <h4 className="font-serif font-bold text-base text-[#2A1E17]">No Published Products Yet</h4>
            <p className="text-xs text-[#6B5B51]">Artisans are cataloging new creations using Voice AI. Click below to explore all items in the marketplace.</p>
            <button 
              onClick={() => onSelectMode('BUY')}
              className="mt-2 px-5 py-2 rounded-xl bg-[#933D1E] text-white font-bold text-xs cursor-pointer"
            >
              Open Marketplace
            </button>
          </div>
        )}
      </section>

      {/* Core Platform Pillars */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-serif text-[#2A1E17]">
            {t('whyTrustTitle', 'Why Rural Creators & Discerning Buyers Trust Artisan AI')}
          </h2>
          <p className="text-xs sm:text-sm text-[#6B5B51]">
            {t('whyTrustSub', 'Built specifically to address the unique real-world barriers faced by craftspeople across India.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, idx) => (
            <div 
              key={idx}
              className="bg-[#FBF8F3] rounded-2xl p-6 border border-[#EADFCF] shadow-xs hover:border-[#933D1E] hover:shadow-md transition-all space-y-3 group"
            >
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center border border-[#EADFCF] group-hover:bg-amber-50 group-hover:border-[#933D1E]/30 transition-colors shadow-2xs">
                {feat.icon}
              </div>
              <h3 className="font-bold font-serif text-[#2A1E17] text-base">{t(feat.titleKey, feat.defaultTitle)}</h3>
              <p className="text-xs text-[#6B5B51] leading-relaxed">{t(feat.descKey, feat.defaultDesc)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Guarantee Banner */}
      <section className="bg-[#2A1E17] text-white rounded-3xl p-8 sm:p-10 border border-stone-800 shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="space-y-2 p-4 rounded-2xl bg-white/5 border border-white/10">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="font-serif font-bold text-base text-amber-200">100% Direct Profit Guard</h4>
            <p className="text-xs text-stone-300">Min 20% profit margin calculated automatically for every artisan.</p>
          </div>
          <div className="space-y-2 p-4 rounded-2xl bg-white/5 border border-white/10">
            <Truck className="w-8 h-8 text-amber-400 mx-auto" />
            <h4 className="font-serif font-bold text-base text-amber-200">Direct Delivery & Ordering</h4>
            <p className="text-xs text-stone-300">Orders reach artisans directly with zero commission cuts.</p>
          </div>
          <div className="space-y-2 p-4 rounded-2xl bg-white/5 border border-white/10">
            <Mic className="w-8 h-8 text-indigo-400 mx-auto" />
            <h4 className="font-serif font-bold text-base text-amber-200">Voice AI Multilingual</h4>
            <p className="text-xs text-stone-300">Empowering non-literate creators to sell in 5 Indian languages.</p>
          </div>
        </div>
      </section>

      {/* Final Call To Action Banner */}
      <section className="text-center max-w-xl mx-auto space-y-4 pt-4">
        <h3 className="text-xl sm:text-2xl font-bold font-serif text-[#2A1E17]">
          {t('readyToExperience', 'Ready to experience authentic Indian artisan commerce?')}
        </h3>
        <p className="text-xs sm:text-sm text-[#6B5B51]">
          {t('joinThousands', 'Join thousands of rural artisans bringing timeless cultural crafts directly into homes worldwide.')}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          {user?.role !== 'BUYER' && (
            <button
              onClick={() => {
                if (user) {
                  onSelectMode('SELL');
                } else {
                  onOpenAuth();
                }
              }}
              className="px-6 py-3 rounded-xl bg-[#933D1E] hover:bg-[#7E3216] text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
            >
              {t('startAsArtisan', 'Start as Artisan')}
            </button>
          )}
          <button
            onClick={() => onSelectMode('BUY')}
            className="px-6 py-3 rounded-xl bg-[#2A1E17] hover:bg-black text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
          >
            {t('shopHandmadeCrafts', 'Shop Handmade Crafts')}
          </button>
        </div>
      </section>
    </div>
  );
}
