import React from 'react';
import { 
  Store, Mic, ShieldCheck, CheckCircle2, ArrowRight, Sparkles, 
  HelpCircle, Users, TrendingUp, Smartphone, ArrowLeft, Award, 
  FileCheck, Globe, Truck, Banknote, ChevronRight
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function BecomeArtisanView({ onSelectMode, onOpenAuth, user }) {
  const { language } = useLanguage();

  const handleStartOnboarding = () => {
    window.scrollTo(0, 0);
    if (user && user.role === 'ARTISAN') {
      onSelectMode('SELL');
    } else {
      onOpenAuth('SELL_REGISTER');
    }
  };

  const handleStudioLogin = () => {
    window.scrollTo(0, 0);
    if (user && (user.role === 'ARTISAN' || user.role === 'ADMIN')) {
      onSelectMode('SELL');
    } else {
      onOpenAuth('SELL_LOGIN');
    }
  };

  const steps = [
    {
      stepNumber: '01',
      title: 'Register',
      teluguTitle: 'నమోదు చేసుకోండి',
      subtitle: 'Fast, Free & Simple',
      description: 'Sign up with your mobile number or email in seconds. Choose your preferred regional language (Telugu, Hindi, Tamil, Bengali, or English). No registration fees or hidden charges.',
      badge: 'Zero Upfront Fee',
      icon: <Store className="w-5 h-5 text-[#A6533B]" />
    },
    {
      stepNumber: '02',
      title: 'Verify',
      teluguTitle: 'ధృవీకరణ',
      subtitle: 'Artisan Authenticity',
      description: 'Submit your Artisan Pehchan Card, Aadhaar, or local craft cooperative / guild endorsement. Our team verifies genuine rural craft provenance to protect authentic creators against factory counterfeits.',
      badge: 'GI & Guild Check',
      icon: <FileCheck className="w-5 h-5 text-emerald-600" />
    },
    {
      stepNumber: '03',
      title: 'Create Catalog',
      teluguTitle: 'వాయిస్ AI కాటలాగ్',
      subtitle: 'Voice-First AI Listing',
      description: 'No English typing or complex spreadsheets needed. Simply speak in your mother tongue and snap photos of your craft. Google Gemini AI automatically transcribes titles, artisan stories, and materials.',
      badge: '5 Indian Languages',
      icon: <Mic className="w-5 h-5 text-amber-600" />
    },
    {
      stepNumber: '04',
      title: 'Admin Approval',
      teluguTitle: 'అడ్మిన్ ఆమోదం',
      subtitle: 'Quality & Fair Margin Curation',
      description: 'Platform curators review your listing within 24 hours to confirm proper GI tagging, photographic clarity, and verify that your pricing guarantees at least a 20% fair profit floor over raw materials.',
      badge: 'Fast 24h Review',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />
    },
    {
      stepNumber: '05',
      title: 'Publish',
      teluguTitle: 'ప్రపంచానికి ప్రదర్శన',
      subtitle: 'Live Marketplace Visibility',
      description: 'Once approved, your handmade crafts are instantly published to our national buyer marketplace, corporate gifting catalogs, and international heritage craft collectors.',
      badge: 'National Reach',
      icon: <Globe className="w-5 h-5 text-indigo-600" />
    },
    {
      stepNumber: '06',
      title: 'Sell & Earn',
      teluguTitle: 'నేరుగా విక్రయించండి',
      subtitle: 'Direct Payouts & Zero Middlemen',
      description: 'Receive customer orders and bulk wholesale enquiries directly to your Studio dashboard and WhatsApp. Direct payments are transferred to your bank account with zero middleman deductions.',
      badge: '100% Direct Profit',
      icon: <Banknote className="w-5 h-5 text-emerald-700" />
    }
  ];

  const benefits = [
    {
      icon: <Mic className="w-6 h-6 text-[#A6533B]" />,
      title: 'Voice AI in 5 Regional Languages',
      desc: 'Craftspeople who do not write English can list products in Telugu, Hindi, Tamil, Bengali, or English by speaking naturally into their phone.'
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
      title: 'Guaranteed 20% Profit Floor',
      desc: 'Our Cost-Plus pricing algorithm calculates raw material costs and skilled labor hours so you are never underpaid or forced into low margins.'
    },
    {
      icon: <Users className="w-6 h-6 text-blue-600" />,
      title: 'Direct Wholesale & Bulk Inquiries',
      desc: 'Connect directly with architects, luxury interior designers, and corporate gifting buyers via 1-click WhatsApp and direct calling.'
    },
    {
      icon: <Smartphone className="w-6 h-6 text-amber-600" />,
      title: 'Works Offline in Rural Villages',
      desc: 'Weak internet in your workshop? Artisan AI saves drafts and catalogs locally and syncs automatically once connectivity returns.'
    }
  ];

  const faqs = [
    {
      q: 'Do I need to speak or write in English to sell?',
      a: 'No! Artisan AI is built specifically for Indian craftspeople. You can record your craft description by speaking in Telugu, Hindi, Tamil, Bengali, or English. Gemini AI does the rest.'
    },
    {
      q: 'How and when do I receive payment for sold items?',
      a: 'Payments are transferred directly into your verified bank account or UPI ID. There are no middlemen delaying your hard-earned funds.'
    },
    {
      q: 'Is there any fee to join or register as an artisan?',
      a: 'No, registration and onboarding are completely free. We believe in direct fair-trade that empowers rural creators without financial barriers.'
    },
    {
      q: 'What crafts are eligible to be listed on Artisan AI?',
      a: 'Any authentic handmade Indian craft or handloom heritage art — including Kalamkari textiles, Etikoppaka wooden toys, Bidriware metalwork, Jaipur Blue Pottery, Terracotta, Ikat weaves, and Dhokra art.'
    },
    {
      q: 'What documents do I need to get verified?',
      a: 'You can provide your Ministry of Textiles Artisan Pehchan Card, a craft guild/cooperative membership letter, or an Aadhaar card along with photos of your craft workshop.'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 font-sans space-y-12 animate-fade-in">
      {/* Back Button */}
      <div>
        <button
          onClick={() => onSelectMode('HOME')}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-[#6B6B6B] hover:text-[#A6533B] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2A1E17] via-[#5C2B1D] to-[#933D1E] text-white p-8 sm:p-14 shadow-xl border border-stone-800">
        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/20 text-amber-200 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Artisan Empowerment & Direct Fair Trade</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold font-serif-luxury tracking-tight leading-tight">
            Sell Your Handcrafted Art Directly to the World
          </h1>

          <p className="text-sm sm:text-base text-stone-200 leading-relaxed max-w-2xl">
            Join thousands of traditional Indian craftspeople, handloom weavers, and rural creators on Artisan AI. List your crafts using <strong>Voice AI in your local language</strong>, enjoy guaranteed profit margins, and cut out exploitative middlemen forever.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-4">
            <button
              onClick={handleStartOnboarding}
              className="px-7 py-3.5 bg-amber-500 hover:bg-amber-400 text-[#1C1C1C] font-extrabold text-sm rounded-xl transition-all shadow-lg cursor-pointer inline-flex items-center space-x-2 active:scale-95"
            >
              <Store className="w-4 h-4" />
              <span>Start Artisan Registration</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleStudioLogin}
              className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl border border-white/30 backdrop-blur-xs transition-all cursor-pointer inline-flex items-center space-x-2"
            >
              <span>Already Registered? Studio Login</span>
            </button>
          </div>
        </div>

        {/* Decorative background watermark */}
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none text-white">
          <Store className="w-96 h-96" />
        </div>
      </section>

      {/* The 6-Step Artisan Onboarding Journey */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#A6533B]">
            HOW IT WORKS • 6-STEP ONBOARDING
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold font-serif-luxury text-[#1C1C1C]">
            From Village Workshop to Global Patron
          </h2>
          <p className="text-xs sm:text-sm text-[#6B6B6B]">
            Every step is designed to be effortless, transparent, and respectful of your traditional heritage.
          </p>
        </div>

        {/* Interactive Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {steps.map((item, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#E8E5DF] rounded-2xl p-6 shadow-xs hover:border-[#A6533B] hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group"
            >
              {/* Step Number Tag */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="text-xs font-black text-[#A6533B] tracking-wider uppercase">
                    Step {item.stepNumber}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FAF9F6] border border-[#E8E5DF] text-[#1C1C1C]">
                  {item.badge}
                </span>
              </div>

              {/* Title and Subtitle */}
              <div className="space-y-1.5">
                <div className="flex items-baseline space-x-2">
                  <h3 className="text-lg font-bold text-[#1C1C1C] group-hover:text-[#A6533B] transition-colors">
                    {item.title}
                  </h3>
                  <span className="text-xs text-[#A6533B] font-semibold">({item.teluguTitle})</span>
                </div>
                <p className="text-xs font-semibold text-[#6B6B6B]">{item.subtitle}</p>
                <p className="text-xs text-[#4A4A4A] leading-relaxed pt-1">
                  {item.description}
                </p>
              </div>

              {/* Step indicator arrow */}
              <div className="pt-2 border-t border-[#F0EFEB] flex items-center justify-between text-[11px] font-semibold text-[#A6533B]">
                <span>Phase {idx + 1} of 6</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Advantages for Creators */}
      <section className="bg-[#FAF9F6] border border-[#E8E5DF] rounded-3xl p-8 sm:p-12 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury text-[#1C1C1C]">
            Why Traditional Indian Artisans Choose Artisan AI
          </h2>
          <p className="text-xs sm:text-sm text-[#6B6B6B]">
            Built from the ground up to solve rural technological and financial barriers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {benefits.map((b, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-[#E8E5DF] flex items-start space-x-4 shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
                {b.icon}
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-[#1C1C1C]">{b.title}</h3>
                <p className="text-xs text-[#6B6B6B] leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#A6533B]">
            GOT QUESTIONS?
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury text-[#1C1C1C]">
            Artisan FAQs & Support
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white border border-[#E8E5DF] rounded-xl p-5 space-y-2 shadow-2xs">
              <h3 className="font-bold text-xs sm:text-sm text-[#1C1C1C] flex items-start space-x-2">
                <HelpCircle className="w-4 h-4 text-[#A6533B] shrink-0 mt-0.5" />
                <span>{faq.q}</span>
              </h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed pl-6">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Final Call to Action */}
      <section className="bg-gradient-to-r from-amber-700 via-[#A6533B] to-[#2A1E17] text-white rounded-3xl p-8 sm:p-10 text-center space-y-4 shadow-xl">
        <h2 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury">
          Ready to Share Your Handcrafted Heritage?
        </h2>
        <p className="text-xs sm:text-sm text-stone-200 max-w-xl mx-auto leading-relaxed">
          Registration takes less than 2 minutes. Start listing your creations today with Voice AI in your regional language.
        </p>
        <div className="pt-2 flex justify-center">
          <button
            onClick={handleStartOnboarding}
            className="px-8 py-3.5 bg-white text-[#A6533B] hover:bg-stone-100 font-extrabold text-sm rounded-xl transition-all shadow-md cursor-pointer inline-flex items-center space-x-2 active:scale-95"
          >
            <span>Register as an Artisan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
