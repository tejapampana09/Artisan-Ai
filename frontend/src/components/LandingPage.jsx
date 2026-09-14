import React, { useState } from 'react';
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
  Layers,
  Globe,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LandingPage({ onSelectMode, onOpenAuth, user }) {
  const { language, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const craftCategories = [
    {
      id: 'kalamkari',
      name: 'Kalamkari Handlooms',
      telugu: 'కలంకారీ వస్త్రాలు',
      hi: 'कलमकारी वस्त्र',
      ta: 'கலம்காரி ஜவுளி',
      bn: 'কলমকারী টেক্সটাইল',
      origin: 'Srikalahasti, AP',
      tag: 'GI Tagged Heritage',
      price: '₹2,499',
      rating: '4.9',
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
      description: 'Hand-painted cotton textiles crafted using 100% natural organic vegetable dyes.'
    },
    {
      id: 'etikoppaka',
      name: 'Etikoppaka Lacquer Toys',
      telugu: 'ఏటికొప్పాక చెక్క బొమ్మలు',
      hi: 'एटीकोप्पका लकड़ी के खिलौने',
      ta: 'ஏடிகொப்பகா மர பொம்மைகள்',
      bn: 'এটিকোপ্পাকা কাঠের খেলনা',
      origin: 'Visakhapatnam, AP',
      tag: 'Eco Lacquer Polish',
      price: '₹899',
      rating: '4.8',
      image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=600&q=80',
      description: 'Turned soft wood figurines glazed with non-toxic botanical lac polish.'
    },
    {
      id: 'pottery',
      name: 'Jaipur Blue Pottery',
      telugu: 'జయపుర బ్లూ కుండల కళ',
      hi: 'जयपुर ब्लू पॉटरी',
      ta: 'ஜெய்ப்பூர் ப்ளூ பாட்டரி',
      bn: 'জয়পুর ব্লু পটারি',
      origin: 'Jaipur, Rajasthan',
      tag: 'Quartz Ceramic Art',
      price: '₹1,299',
      rating: '5.0',
      image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80',
      description: 'Vibrant cobalt blue glazed ceramics made without clay using ground quartz stone.'
    },
    {
      id: 'bidriware',
      name: 'Bidriware Silver Inlay',
      telugu: 'బిద్రి వెండి చెక్కడాలు',
      hi: 'बीदरी सिल्वर जड़ाई क्राफ्ट',
      ta: 'பித்ரி வெள்ளி கைவினை',
      bn: 'বিদ্রি রৌপ্য কারুশিল্প',
      origin: 'Bidar, Karnataka',
      tag: '800-Year Alloy Art',
      price: '₹3,200',
      rating: '4.9',
      image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
      description: 'Blackened zinc-copper alloy intricately inlaid with 99.9% sterling silver.'
    },
    {
      id: 'terracotta',
      name: 'Terracotta & Clay Art',
      telugu: 'టెర్రకోటా మట్టి పాత్రలు',
      hi: 'टेराकोटा मिट्टी के बर्तन',
      ta: 'சுடுமண் கலை',
      bn: 'টেরাকোটা মৃৎশিল্প',
      origin: 'Bankura, WB',
      tag: 'Earth-Fired Heritage',
      price: '₹750',
      rating: '4.7',
      image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80',
      description: 'Traditional burnt-clay decorative artifacts and Bankura horses.'
    },
    {
      id: 'ikat',
      name: 'Pochampally Ikat Silks',
      telugu: 'పోచంపల్లి ఇక్కత్ చీరలు',
      hi: 'पोचमपल्ली इकत साड़ी',
      ta: 'போச்சம்பள்ளி இக்கத் பட்டு',
      bn: 'পোচমপল্লী ইকাত সিল্ক',
      origin: 'Pochampally, TS',
      tag: 'GI Tag Weave',
      price: '₹4,999',
      rating: '5.0',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
      description: 'Intricate geometric dyed silk threads woven into heirloom sarees.'
    }
  ];

  const featuredMarketplaceItems = [
    {
      id: 1,
      title: 'Hand-painted Srikalahasti Kalamkari Tree of Life Tapestry',
      artisan: 'Ramesh Varma',
      location: 'Srikalahasti, AP',
      price: '₹3,499',
      originalPrice: '₹4,500',
      artisanShare: '82% Direct Earnings',
      tag: 'GI Certified',
      rating: 4.9,
      reviews: 38,
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 2,
      title: 'Authentic Etikoppaka Traditional Wooden Raja Rani Pair',
      artisan: 'Chinna Satyanarayana',
      location: 'Etikoppaka, AP',
      price: '₹1,199',
      originalPrice: '₹1,600',
      artisanShare: '85% Direct Earnings',
      tag: 'Natural Lacquer',
      rating: 4.8,
      reviews: 52,
      image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 3,
      title: 'Handcrafted Jaipur Cobalt Blue Floral Planter Vase',
      artisan: 'Sunita Devi',
      location: 'Jaipur, Rajasthan',
      price: '₹1,450',
      originalPrice: '₹1,850',
      artisanShare: '80% Direct Earnings',
      tag: 'Quartz Clay Free',
      rating: 5.0,
      reviews: 29,
      image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 4,
      title: 'Bidriware Pure Silver Wire Inlaid Decorative Jewellery Box',
      artisan: 'Mohammed Rashid',
      location: 'Bidar, Karnataka',
      price: '₹2,890',
      originalPrice: '₹3,500',
      artisanShare: '84% Direct Earnings',
      tag: 'Heritage Metal',
      rating: 4.9,
      reviews: 44,
      image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80'
    }
  ];

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
    <div className="space-y-12 pb-16 animate-fade-in font-sans">
      
      {/* Search & Top Announcement Bar */}
      <section className="bg-gradient-to-r from-[#933D1E] via-[#B84D26] to-[#7E3216] text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-amber-900/30 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto space-y-6 text-center">
          
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-amber-200 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{t('ondcPlatformTag', 'India’s #1 Voice-AI Direct Artisan Marketplace • ONDC Integrated')}</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-white">
            Discover Authentic Indian Handicrafts Direct from Master Artisans
          </h1>

          <p className="text-sm sm:text-base text-amber-100/90 font-normal max-w-2xl mx-auto leading-relaxed">
            Eliminating middlemen through Multilingual Voice AI, transparent cost-plus pricing protection, and direct buyer-to-artisan connections.
          </p>

          {/* Quick Search Bar (Kreate World Style) */}
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto pt-2">
            <div className="relative flex items-center bg-white rounded-2xl p-2 shadow-2xl border border-amber-200/50">
              <Search className="w-5 h-5 text-stone-400 ml-3 shrink-0" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Kalamkari, Etikoppaka toys, Blue pottery, Silk sarees..."
                className="w-full px-3 py-2 text-sm text-[#2A1E17] placeholder-stone-400 bg-transparent focus:outline-hidden font-medium"
              />
              <button 
                type="submit"
                className="bg-[#933D1E] hover:bg-[#7E3216] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Search</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Quick Category Chips */}
          <div className="flex flex-wrap justify-center gap-2 pt-2 text-xs">
            {['Kalamkari', 'Etikoppaka Toys', 'Blue Pottery', 'Bidriware', 'Terracotta', 'Pochampally Silks'].map((chip, idx) => (
              <button 
                key={idx}
                onClick={() => onSelectMode('BUY')}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-amber-100 text-[11px] font-medium backdrop-blur-xs transition-colors cursor-pointer"
              >
                ✨ {chip}
              </button>
            ))}
          </div>
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

      {/* Featured Indian Heritage Categories (Kreate Style Grid) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#EADFCF] pb-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-[#933D1E] uppercase tracking-wider mb-1">
              <Award className="w-4 h-4 text-[#933D1E]" />
              <span>Authentic Cultural Heritage</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-serif text-[#2A1E17]">
              Explore Handmade Craft Traditions
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
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs text-[#933D1E] font-bold px-2.5 py-1 rounded-lg text-xs border border-[#EADFCF] shadow-xs flex items-center space-x-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{craft.rating}</span>
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
                  <span className="text-xs text-stone-500">Starting from <strong className="text-sm font-bold text-[#2A1E17] ml-1">{craft.price}</strong></span>
                  <span className="text-xs font-bold text-[#933D1E] flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                    <span>Explore</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trending Direct-Artisan Marketplace Products (Kreate World Showcase) */}
      <section className="bg-gradient-to-b from-[#FBF8F3] to-white rounded-3xl p-6 sm:p-10 border border-[#EADFCF] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-100 text-[#933D1E] text-xs font-bold mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Trending Verified Listings</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-serif text-[#2A1E17]">
              Handcrafted Masterpieces Ready to Ship
            </h2>
          </div>
          <button 
            onClick={() => onSelectMode('BUY')}
            className="px-5 py-2.5 rounded-xl bg-[#933D1E] hover:bg-[#7E3216] text-white text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
          >
            Go to Full Marketplace
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          {featuredMarketplaceItems.map((item) => (
            <div 
              key={item.id}
              onClick={() => onSelectMode('BUY')}
              className="bg-white rounded-2xl border border-[#EADFCF] overflow-hidden hover:border-[#933D1E] shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="relative h-48 overflow-hidden bg-stone-100">
                <img 
                  src={item.image} 
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2.5 left-2.5 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                  {item.artisanShare}
                </div>
                <div className="absolute top-2.5 right-2.5 bg-white/90 text-stone-700 p-1.5 rounded-full shadow-xs hover:text-red-500 transition-colors">
                  <Heart className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-[#933D1E]" />
                      <span>{item.location}</span>
                    </span>
                    <span className="flex items-center space-x-1 font-semibold text-amber-600">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{item.rating} ({item.reviews})</span>
                    </span>
                  </div>

                  <h3 className="font-bold text-xs text-[#2A1E17] group-hover:text-[#933D1E] line-clamp-2 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-1">Artisan: <strong className="text-stone-700">{item.artisan}</strong></p>
                </div>

                <div className="pt-2 border-t border-[#EADFCF] flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold text-[#933D1E]">{item.price}</span>
                    <span className="text-xs text-stone-400 line-through ml-1.5">{item.originalPrice}</span>
                  </div>
                  <button className="bg-[#FAF7F2] hover:bg-amber-100 text-[#933D1E] p-2 rounded-xl border border-[#EADFCF] transition-colors">
                    <ShoppingBag className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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
