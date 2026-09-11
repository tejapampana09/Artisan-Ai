import React from 'react';
import { ArrowRight, Sparkles, Store, ShoppingBag, CheckCircle2, ShieldCheck, Heart, Award, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LandingPage({ onSelectMode, onOpenAuth, user }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-12 pb-12 animate-fade-in max-w-6xl mx-auto">
      
      {/* Screen 1 Hero Section */}
      <section className="bg-white rounded-3xl p-8 sm:p-12 md:p-16 border border-[#E7E7E2] shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
        
        {/* Left Hero Content */}
        <div className="flex-1 space-y-6 text-left">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#176B4D]/10 text-[#176B4D] border border-[#176B4D]/20 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-[#176B4D]" />
            <span>Preserving Indian Heritage & Global Trade</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#171717] tracking-tight leading-[1.15]">
            India’s Craft Stories <br className="hidden sm:block" />
            <span className="text-[#176B4D]">to the World</span>
          </h1>

          <p className="text-base sm:text-lg text-[#666666] leading-relaxed max-w-xl">
            Empowering artisans with AI. Preserving heritage. Creating global opportunities.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <button
              onClick={() => {
                if (user) {
                  onSelectMode('SELL');
                } else {
                  onOpenAuth();
                }
              }}
              className="px-8 py-4 rounded-2xl bg-[#176B4D] hover:bg-[#0F4D38] text-white font-bold text-base shadow-md shadow-[#176B4D]/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => onSelectMode('BUY')}
              className="px-8 py-4 rounded-2xl bg-[#FAFAF7] hover:bg-stone-100 text-[#171717] font-semibold text-base border border-[#E7E7E2] flex items-center justify-center transition-all"
            >
              Explore Crafts
            </button>
          </div>

          {/* Trust Highlights */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-[#E7E7E2] text-xs text-[#666666]">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#176B4D] shrink-0" />
              <span>Direct to Artisan</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#176B4D] shrink-0" />
              <span>5 Indian Languages</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#176B4D] shrink-0" />
              <span>Fair Price Guard</span>
            </div>
          </div>
        </div>

        {/* Right Hero Image Card */}
        <div className="w-full md:w-5/12 relative">
          <div className="relative rounded-3xl overflow-hidden border border-[#E7E7E2] shadow-lg bg-[#FAFAF7]">
            <img 
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80" 
              alt="Indian Master Artisan" 
              className="w-full h-[400px] object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=800&q=80';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-white/60 text-left shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#176B4D] block mb-0.5">
                Authentic Craftsmanship
              </span>
              <p className="text-xs text-[#171717] font-semibold">
                Handmade Stories, Brighter Futures for Indian Master Creators.
              </p>
            </div>
          </div>
        </div>

      </section>

      {/* Screen 1 Journey Choice Card */}
      <section className="bg-white rounded-3xl p-8 border border-[#E7E7E2] shadow-sm max-w-3xl mx-auto space-y-6 text-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[#171717]">
            How would you like to use Artisan AI?
          </h2>
          <p className="text-xs text-[#666666]">
            Select your mode to continue
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => {
              if (user) {
                onSelectMode('SELL');
              } else {
                onOpenAuth();
              }
            }}
            className="p-6 rounded-2xl bg-[#FAFAF7] border border-[#E7E7E2] hover:border-[#176B4D] transition-all cursor-pointer text-left space-y-3 hover:shadow-md group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#176B4D] text-white flex items-center justify-center shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#171717] group-hover:text-[#176B4D] transition-colors">
                I am an Artisan
              </h3>
              <p className="text-xs text-[#666666] mt-1">
                Voice cataloging, AI pricing, and direct wholesale connection.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-[#176B4D] flex items-center gap-1">
              <span>Start Selling</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => onSelectMode('BUY')}
            className="p-6 rounded-2xl bg-[#FAFAF7] border border-[#E7E7E2] hover:border-[#176B4D] transition-all cursor-pointer text-left space-y-3 hover:shadow-md group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#176B4D]/20 text-[#176B4D] flex items-center justify-center shadow-sm">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#171717] group-hover:text-[#176B4D] transition-colors">
                I am a Buyer
              </h3>
              <p className="text-xs text-[#666666] mt-1">
                Discover verified authentic handmade craft directly from creators.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-[#176B4D] flex items-center gap-1">
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
