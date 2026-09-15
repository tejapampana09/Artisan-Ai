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
      {/* Hero Section (Matching Exact Design of Screenshot) */}
      <section className="relative bg-slate-950 text-white overflow-hidden rounded-2xl max-w-7xl mx-auto my-4 shadow-xl border border-[#E8E5DF]">
        <div className="relative h-[380px] sm:h-[460px] md:h-[500px] w-full flex items-center">
          {/* Background Image with Dark Overlay */}
          <img
            src={heroBanners[currentBannerIndex].bgImage}
            alt={heroBanners[currentBannerIndex].title}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-700 brightness-[0.45]"
          />

          {/* Banner Copy & CTA */}
          <div className="relative z-10 max-w-2xl px-8 sm:px-14 space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight font-serif-luxury">
              {heroBanners[currentBannerIndex].title}
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-stone-200 font-medium leading-relaxed max-w-lg">
              {heroBanners[currentBannerIndex].subtitle}
            </p>
            <div className="pt-2">
              <button
                onClick={() => onSelectMode('BUY')}
                className="px-7 py-3 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold text-sm rounded-xl transition-all cursor-pointer inline-flex items-center space-x-2 shadow-md active:scale-95"
              >
                <span>{heroBanners[currentBannerIndex].buttonText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Left Circular Slider Arrow (<) */}
          <button
            onClick={prevBanner}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer border border-white/30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Right Circular Slider Arrow (>) */}
          <button
            onClick={nextBanner}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer border border-white/30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Bottom Pagination Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2">
            {heroBanners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBannerIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  currentBannerIndex === idx ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </div>
      </section>
      {/* Featured Live Published Products Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury text-[#1C1C1C] tracking-tight">
              Featured pieces
            </h2>
            <p className="text-sm text-[#6B6B6B] mt-1">Authentic craft pieces from verified artisans</p>
          </div>
          <button 
            onClick={() => onSelectMode('BUY')}
            className="text-sm font-semibold text-[#A6533B] hover:text-[#88412F] transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <span>View all</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loadingProducts ? (
          <div className="py-12 text-center text-[#6B6B6B] space-y-3">
            <Loader2 className="w-6 h-6 text-[#A6533B] animate-spin mx-auto" />
            <p className="text-xs">Loading authentic artisan products...</p>
          </div>
        ) : realProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {realProducts.slice(0, 8).map((prod) => {
              const localizedTitle = getLocalizedProductField(prod, 'title', language);
              return (
                <div 
                  key={prod.id}
                  onClick={() => onSelectMode('BUY')}
                  className="group cursor-pointer space-y-2"
                >
                  <div className="aspect-4/5 rounded-md overflow-hidden bg-white border border-[#E8E5DF] relative">
                    <img 
                      src={prod.image_url || 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=600&q=80'} 
                      alt={localizedTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <button className="absolute top-3 right-3 p-1.5 rounded-full bg-white/80 backdrop-blur-sm text-[#1C1C1C] hover:text-[#A6533B] transition-colors">
                      <Heart className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-[#1C1C1C] group-hover:text-[#A6533B] transition-colors line-clamp-1">
                      {localizedTitle}
                    </h3>
                    <p className="text-xs text-[#6B6B6B]">{prod.category || 'Handicraft'}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-semibold text-sm text-[#1C1C1C]">₹{Number(prod.price).toLocaleString('en-IN')}</span>
                      <span className="text-xs text-[#6B6B6B] flex items-center space-x-1">
                        <Star className="w-3 h-3 fill-[#A6533B] text-[#A6533B]" />
                        <span>4.8</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-[#6B6B6B]">
            <p className="text-sm">No live products available yet.</p>
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
    </div>
  );
}
