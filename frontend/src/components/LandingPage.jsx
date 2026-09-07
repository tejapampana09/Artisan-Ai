import React from 'react';
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
  Layers, 
  Globe, 
  Heart,
  Palette,
  Award
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LandingPage({ onSelectMode, onOpenAuth, user }) {
  const { language, t } = useLanguage();

  const craftCategories = [
    {
      name: 'Kalamkari Handloom & Textiles',
      telugu: 'కలంకారీ వస్త్రాలు',
      hi: 'कलमकारी वस्त्र',
      ta: 'கலம்காரி ஜவுளி',
      bn: 'কলমকারী টেক্সটাইল',
      origin: 'Machilipatnam & Srikalahasti, AP',
      tag: 'GI Tagged Heritage',
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
      description: 'Hand-painted and block-printed cotton textiles using natural organic vegetable dyes.'
    },
    {
      name: 'Etikoppaka & Kondapalli Toys',
      telugu: 'ఏటికొప్పాక చెక్క బొమ్మలు',
      hi: 'एटीकोप्पका लकड़ी के खिलौने',
      ta: 'ஏடிகொப்பகா மர பொம்மைகள்',
      bn: 'এটিকোপ্পাকা কাঠের খেলনা',
      origin: 'Visakhapatnam & Krishna, AP',
      tag: 'Natural Lacquer Polish',
      image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=600&q=80',
      description: 'Handcrafted soft wood figurines turned on traditional lathes and glazed with vegetable lacquer.'
    },
    {
      name: 'Jaipur Blue Pottery',
      telugu: 'జయపుర బ్లూ కుండల కళ',
      hi: 'जयपुर ब्लू पॉटरी',
      ta: 'ஜெய்ப்பூர் ப்ளூ பாட்டரி',
      bn: 'জয়পুর ব্লু পটারি',
      origin: 'Jaipur, Rajasthan',
      tag: 'Quartz Ceramic Craft',
      image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80',
      description: 'Vibrant cobalt blue glazed ceramics made without clay using ground quartz stone.'
    },
    {
      name: 'Bidriware Silver Inlay Metalcraft',
      telugu: 'బిద్రి వెండి చెక్కడాలు',
      hi: 'बीदरी सिल्वर जड़ाई क्राफ्ट',
      ta: 'பித்ரி வெள்ளி கைவினை',
      bn: 'বিদ্রি রৌপ্য কারুশিল্প',
      origin: 'Bidar, Karnataka',
      tag: '800-Year Metal Art',
      image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
      description: 'Blackened zinc and copper alloy intricately inlaid with pure 99.9% sterling silver wires.'
    }
  ];

  const features = [
    {
      icon: <Mic className="w-6 h-6 text-amber-600" />,
      titleKey: 'voiceAiFeatureTitle',
      defaultTitle: 'Voice-First AI Cataloging',
      descKey: 'voiceAiFeatureDesc',
      defaultDesc: 'Artisans simply speak in Telugu, Hindi, Tamil, Bengali, or English. Gemini AI analyzes audio and craft photos to instantly build comprehensive e-commerce listings.'
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
      titleKey: 'costPlusFeatureTitle',
      defaultTitle: 'Cost-Plus Fair Margin Guard',
      descKey: 'costPlusFeatureDesc',
      defaultDesc: 'Guarantees rural creators are never underpaid. Strict cost-plus formulas compute raw materials, skilled hours, and festival demand with an inviolable minimum 20% margin.'
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-blue-600" />,
      titleKey: 'directWholesaleFeatureTitle',
      defaultTitle: 'Direct Wholesale & Buyer Enquiries',
      descKey: 'directWholesaleFeatureDesc',
      defaultDesc: 'No middleman cuts. Buyers submit custom and wholesale enquiries that flow straight to artisan dashboards with instant 1-click WhatsApp and Phone calling.'
    },
    {
      icon: <WifiOff className="w-6 h-6 text-indigo-600" />,
      titleKey: 'offlineFeatureTitle',
      defaultTitle: 'Rural Offline-First Resilience',
      descKey: 'offlineFeatureDesc',
      defaultDesc: 'Engineered for remote artisan villages with low connectivity. Full local caching with automatic cloud synchronization when network access restores.'
    }
  ];

  const getCraftSubName = (craft) => {
    if (language === 'te') return craft.telugu;
    if (language === 'hi') return craft.hi;
    if (language === 'ta') return craft.ta;
    if (language === 'bn') return craft.bn;
    return craft.name;
  };

  return (
    <div className="space-y-16 pb-12 animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-900 via-stone-900 to-slate-950 text-white p-8 md:p-14 shadow-2xl border border-amber-500/20">
        {/* Background decorative ambient glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>{t('ondcPlatformTag', 'భారతీయ హస్తకళల డిజిటల్ వేదిక • ONDC Ready Platform')}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            {t('heroHeadlineText', 'Empowering Indian Artisans with Voice-First AI & Fair Trade.')}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
            {t('heroSubheadText', 'Eliminating predatory middlemen through Multilingual Voice AI, explainable cost-plus pricing protection, and direct buyer-to-artisan connections.')}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
            {user?.role !== 'BUYER' && (
              <button
                id="landing-artisan-cta"
                onClick={() => {
                  if (user) {
                    onSelectMode('SELL');
                  } else {
                    onOpenAuth();
                  }
                }}
                className="flex items-center justify-center space-x-3 px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-base shadow-lg shadow-amber-600/30 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Store className="w-5 h-5" />
                <span>{user ? t('artisanStudio', 'Enter Artisan Studio') : t('artisanSignInJoin', 'Artisan Sign In / Join')}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            )}

            <button
              id="landing-buyer-cta"
              onClick={() => onSelectMode('BUY')}
              className={`flex items-center justify-center space-x-3 px-7 py-3.5 rounded-xl font-bold text-base transition-all hover:scale-[1.02] cursor-pointer ${
                user?.role === 'BUYER'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-600 text-white backdrop-blur-sm'
              }`}
            >
              <ShoppingBag className="w-5 h-5 text-amber-300" />
              <span>{t('exploreMarketplace', 'Explore Marketplace')}</span>
            </button>
          </div>

          {/* Platform Trust Highlights */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/80 text-xs text-slate-300">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('trustDirectArtisan', '100% Direct to Artisan')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('trust5Languages', '5 Indian Languages')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('trustMarginGuard', '≥ 20% Profit Guard')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('trustNoMiddlemen', 'Zero Middleman Cuts')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Pillars */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t('whyTrustTitle', 'Why Rural Creators & Discerning Buyers Trust Artisan AI')}
          </h2>
          <p className="text-sm text-slate-600">
            {t('whyTrustSub', 'Built specifically to address the unique real-world barriers faced by craftspeople across India.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-amber-400/50 shadow-sm hover:shadow-md transition-all space-y-3 group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-amber-50 group-hover:border-amber-200 transition-colors">
                {feat.icon}
              </div>
              <h3 className="font-bold text-slate-900 text-base">{t(feat.titleKey, feat.defaultTitle)}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{t(feat.descKey, feat.defaultDesc)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Authentic Craft Traditions */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
              <Award className="w-4 h-4 text-amber-600" />
              <span>{t('preservingHeritageTag', 'Preserving Indian Heritage')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {t('giCraftsTitle', 'Authentic Geographical Indication (GI) Crafts')}
            </h2>
          </div>
          <button
            onClick={() => onSelectMode('BUY')}
            className="inline-flex items-center space-x-2 text-sm font-bold text-amber-700 hover:text-amber-800 transition-colors cursor-pointer group"
          >
            <span>{t('viewAllCraftsMarketplace', 'View all crafts in Marketplace')}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {craftCategories.map((craft, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col group"
            >
              <div className="relative h-48 overflow-hidden bg-slate-100">
                <img 
                  src={craft.image} 
                  alt={craft.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=600&q=80';
                  }}
                />
                <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-amber-300 px-2.5 py-1 rounded-full text-[10px] font-bold border border-amber-400/30">
                  {craft.tag}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-amber-800 transition-colors">
                    {language === 'en' ? craft.name : getCraftSubName(craft)}
                  </h3>
                  {language !== 'en' && (
                    <div className="text-xs text-amber-700 font-medium">{craft.name}</div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-1">📍 {craft.origin}</div>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                    {craft.description}
                  </p>
                </div>

                <button
                  onClick={() => onSelectMode('BUY')}
                  className="w-full py-2 px-3 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-xs font-semibold border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer text-center"
                >
                  {t('exploreInCatalog', 'Explore in Catalog')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Two-Sided Workflow Walkthrough */}
      <section className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-3xl p-8 md:p-12 border border-amber-200/80 shadow-xs">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('howItWorksTitle', 'How It Works')}</h2>
            <p className="text-xs sm:text-sm text-slate-600">{t('howItWorksSub', 'Simplicity for the rural artisan. Confidence and transparency for the conscious buyer.')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* For Artisans */}
            <div className="bg-white rounded-2xl p-6 border border-amber-200 space-y-4 shadow-2xs">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{t('forMasterArtisans', 'For Master Artisans')}</h3>
                  <p className="text-xs text-slate-500">{t('fromWorkshopToGlobal', 'From workshop to global reach in minutes')}</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">1</span>
                  <span>{t('artisanStep1Text', 'Speak & Snap: Take a photo of your craft and speak about materials & hours in your native mother tongue.')}</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">2</span>
                  <span>{t('artisanStep2Text', 'Instant Fair Pricing: The AI calculates guaranteed profit floor (minimum 20% margin) and festival multipliers.')}</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">3</span>
                  <span>{t('artisanStep3Text', 'Direct Buyer Enquiries: Receive WhatsApp calls and bulk order requests directly without commissions.')}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (user) {
                    onSelectMode('SELL');
                  } else {
                    onOpenAuth();
                  }
                }}
                className="w-full mt-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer text-center"
              >
                {user ? t('artisanStudio', 'Go to Artisan Studio') : t('startAsArtisan', 'Sign In as Artisan')}
              </button>
            </div>

            {/* For Buyers */}
            <div className="bg-white rounded-2xl p-6 border border-indigo-200 space-y-4 shadow-2xs">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{t('forConsciousBuyers', 'For Conscious Buyers')}</h3>
                  <p className="text-xs text-slate-500">{t('directProvenance', 'Direct provenance, zero middleman markups')}</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center shrink-0">1</span>
                  <span>{t('buyerStep1Text', 'Browse Authentic Heritage: Filter by craft origin, GI tag status, and master artisan certifications.')}</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center shrink-0">2</span>
                  <span>{t('buyerStep2Text', 'Fair Price Transparency: See the cost breakdown of raw materials, labor, and artisan earnings.')}</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center shrink-0">3</span>
                  <span>{t('buyerStep3Text', 'Connect & Order Direct: Place orders or negotiate wholesale custom commissions directly via WhatsApp.')}</span>
                </div>
              </div>

              <button
                onClick={() => onSelectMode('BUY')}
                className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer text-center"
              >
                {t('shopHandmadeCrafts', 'Browse Artisan Marketplace')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call To Action Banner */}
      <section className="text-center max-w-xl mx-auto space-y-4 pt-4">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
          {t('readyToExperience', 'Ready to experience authentic Indian artisan commerce?')}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500">
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
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
            >
              {t('startAsArtisan', 'Start as Artisan')}
            </button>
          )}
          <button
            onClick={() => onSelectMode('BUY')}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
              user?.role === 'BUYER'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {t('shopHandmadeCrafts', 'Shop Handmade Crafts')}
          </button>
        </div>
      </section>
    </div>
  );
}

