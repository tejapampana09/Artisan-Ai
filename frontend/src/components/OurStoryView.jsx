import React from 'react';
import { 
  Sparkles, ShieldCheck, Heart, Globe, Mic, ArrowRight, Award, 
  MapPin, Store, CheckCircle2, TrendingUp, Users, BookOpen
} from 'lucide-react';

export default function OurStoryView({ onSelectMode, onOpenAuth, user }) {
  const masterArtisans = [
    {
      name: 'Lakshmi Devi',
      craft: 'Kalamkari Handloom Painting',
      location: 'Srikalahasti, Andhra Pradesh',
      experience: '28 Years',
      tag: 'GI Tagged Heritage Master',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
      bio: 'Practicing 300-year-old family tradition of organic vegetable dye Kalamkari painting using bamboo pens.'
    },
    {
      name: 'Ramu Achari',
      craft: 'Etikoppaka Lacquer Toys',
      location: 'Visakhapatnam, Andhra Pradesh',
      experience: '22 Years',
      tag: 'Eco Lacquer Specialist',
      image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=600&q=80',
      bio: 'Hand-turning ivory wood toys coated with non-toxic natural lacquer extracted from seeds and roots.'
    },
    {
      name: 'Sunder Lal Kripal',
      craft: 'Jaipur Blue Pottery',
      location: 'Jaipur, Rajasthan',
      experience: '35 Years',
      tag: 'UNESCO Heritage Craft',
      image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=600&q=80',
      bio: 'Crafting glazed cobalt blue quartz pottery using traditional clay-free Persian technology.'
    },
    {
      name: 'Syed Ahmed Bidri',
      craft: 'Bidriware Silver Inlay',
      location: 'Bidar, Karnataka',
      experience: '40 Years',
      tag: 'Royal Inlay Artisan',
      image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
      bio: 'Engraving 99.9% pure sterling silver wire into oxidized zinc alloy metalwork using ancient soil formulas.'
    }
  ];

  return (
    <div className="space-y-12 pb-24 max-w-6xl mx-auto font-sans">
      {/* Editorial Header */}
      <section className="bg-[#FAF9F6] border border-[#E8E5DF] rounded-2xl p-8 sm:p-12 text-center space-y-4">
        <span className="text-xs uppercase tracking-widest text-[#A6533B] font-semibold block">
          OUR MISSION & HERITAGE PURPOSE
        </span>
        <h1 className="text-3xl sm:text-5xl font-bold text-[#1C1C1C] tracking-tight max-w-3xl mx-auto leading-tight">
          Empowering Rural Indian Master Artisans Through Voice AI & Direct Fair Trade
        </h1>
        <p className="text-sm sm:text-base text-[#6B6B6B] max-w-2xl mx-auto leading-relaxed">
          Artisan AI bridges rural master craftspeople directly with global buyers — eliminating middleman exploitation, guaranteeing minimum 20% fair profit margins, and preserving endangered UNESCO & GI-tagged cultural heritage.
        </p>
      </section>

      {/* Difference Between Landing Page & Our Story */}
      <section className="bg-white border border-[#E8E5DF] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#E8E5DF] pb-4">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#A6533B]" />
            <h2 className="text-xl font-bold text-[#1C1C1C] tracking-tight">
              Understanding Our Platform Architecture
            </h2>
          </div>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Why our website separates the commercial Landing Page from Our Story mission
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Card 1: Landing Page */}
          <div className="p-5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#1C1C1C] flex items-center space-x-1.5">
                <Store className="w-4 h-4 text-[#A6533B]" />
                <span>1. The Landing Page (Commercial Marketplace)</span>
              </span>
              <span className="text-[10px] font-semibold bg-amber-50 text-[#A6533B] px-2 py-0.5 rounded border border-[#E8E5DF]">
                Storefront
              </span>
            </div>
            <p className="text-[#6B6B6B] leading-relaxed">
              The Landing Page is our **buyer discovery showcase**. It is designed for high-conversion product exploration, featuring craft categories (Kalamkari, Blue Pottery, etc.), hero photographs, live craft cards, search filters, and quick AI Studio highlights for sellers.
            </p>
            <ul className="space-y-1.5 text-[#1C1C1C] pt-1">
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#356B4A]" />
                <span>Product discovery & direct buyer checkout</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#356B4A]" />
                <span>Shop by Craft category filters & search</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#356B4A]" />
                <span>Instant Seller Studio entry point for creators</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Our Story */}
          <div className="p-5 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#1C1C1C] flex items-center space-x-1.5">
                <Heart className="w-4 h-4 text-[#A6533B]" />
                <span>2. Our Story (Brand Mission & Heritage)</span>
              </span>
              <span className="text-[10px] font-semibold bg-emerald-50 text-[#356B4A] px-2 py-0.5 rounded border border-emerald-200">
                Brand Purpose
              </span>
            </div>
            <p className="text-[#6B6B6B] leading-relaxed">
              Our Story is the **"why" behind Artisan AI**. It details how Voice AI breaks literacy barriers for rural artisans, our strict cost-plus 20% profit protection policy, GI provenance verification, and our goal to sustain generational artisan families across India.
            </p>
            <ul className="space-y-1.5 text-[#1C1C1C] pt-1">
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#356B4A]" />
                <span>Voice AI in 5 Indian languages (Telugu, Hindi, Tamil, etc.)</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#356B4A]" />
                <span>Protected ≥20% fair margin floor for every listing</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#356B4A]" />
                <span>Direct 100% earnings to rural master craftspeople</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4 Core Purpose Pillars */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">
            How Artisan AI Solves Real Rural Challenges
          </h2>
          <p className="text-xs text-[#6B6B6B]">
            Technology engineered specifically for non-literate creators in remote artisan clusters
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-[#E8E5DF] space-y-2">
            <div className="w-10 h-10 rounded-md bg-[#FAF9F6] border border-[#E8E5DF] text-[#A6533B] flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[#1C1C1C]">Voice-First Accessibility</h3>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              Artisans simply speak in Telugu or Hindi. Gemini AI converts voice notes and craft photos into complete e-commerce listings.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#E8E5DF] space-y-2">
            <div className="w-10 h-10 rounded-md bg-[#FAF9F6] border border-[#E8E5DF] text-[#356B4A] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[#1C1C1C]">Protected 20% Margin</h3>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              Cost-plus formulas combine material, labour, and packaging expenses with a guaranteed ≥20% profit floor to prevent underpricing.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#E8E5DF] space-y-2">
            <div className="w-10 h-10 rounded-md bg-[#FAF9F6] border border-[#E8E5DF] text-[#1C1C1C] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[#1C1C1C]">Direct Wholesale Enquiries</h3>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              Buyers connect directly with artisans via WhatsApp and Phone calls for bulk and custom orders without middleman cuts.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#E8E5DF] space-y-2">
            <div className="w-10 h-10 rounded-md bg-[#FAF9F6] border border-[#E8E5DF] text-[#A6533B] flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[#1C1C1C]">GI Heritage Preservation</h3>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              Cryptographically verified digital craft passports preserving origin, natural materials, and GI tag authenticity.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Master Artisans Spotlight */}
      <section className="space-y-6">
        <div className="flex justify-between items-end border-b border-[#E8E5DF] pb-3">
          <div>
            <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">
              MEET OUR MASTER ARTISANS
            </h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              The skilled hands keeping India's ancient craft heritage alive
            </p>
          </div>
          <button 
            onClick={() => onSelectMode('BUY')}
            className="text-xs font-semibold text-[#A6533B] hover:text-[#88412F] flex items-center space-x-1 cursor-pointer"
          >
            <span>Explore all crafts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {masterArtisans.map((artisan, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-[#E8E5DF] overflow-hidden space-y-3 p-4">
              <div className="aspect-4/3 rounded-md overflow-hidden bg-[#FAF9F6] border border-[#E8E5DF]">
                <img src={artisan.image} alt={artisan.name} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#A6533B] bg-amber-50 px-2 py-0.5 rounded border border-[#E8E5DF]">
                  {artisan.tag}
                </span>
                <h3 className="font-bold text-sm text-[#1C1C1C] pt-1">{artisan.name}</h3>
                <p className="text-xs font-medium text-[#6B6B6B]">{artisan.craft}</p>
                <p className="text-[11px] text-[#6B6B6B] flex items-center mt-1">
                  <MapPin className="w-3 h-3 text-[#A6533B] mr-1 shrink-0" />
                  <span>{artisan.location}</span>
                </p>
                <p className="text-xs text-[#6B6B6B] pt-1 leading-snug italic">
                  "{artisan.bio}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="bg-[#1C1C1C] text-white rounded-2xl p-8 sm:p-10 text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Join the Direct Fair Trade Movement
        </h2>
        <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto leading-relaxed">
          Whether you are a buyer seeking authentic handmade craft art or an artisan ready to list your crafts online with AI, Artisan AI is built for you.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            onClick={() => onSelectMode('BUY')}
            className="px-6 py-2.5 bg-[#A6533B] hover:bg-[#88412F] text-white font-semibold text-xs rounded-md transition-colors cursor-pointer"
          >
            Explore Marketplace
          </button>
          <button
            onClick={() => user ? onSelectMode('SELL') : onOpenAuth()}
            className="px-6 py-2.5 bg-white text-[#1C1C1C] hover:bg-stone-100 font-semibold text-xs rounded-md transition-colors cursor-pointer"
          >
            Start Seller Studio
          </button>
        </div>
      </section>
    </div>
  );
}
