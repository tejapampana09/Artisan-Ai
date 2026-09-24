import React, { useState } from 'react';
import { MapPin, CheckCircle2, Star, Eye, ShoppingBag } from 'lucide-react';
import ArtisanProfileModal from './ArtisanProfileModal';

export default function ArtisansView({ user, onOpenAuth, onSelectMode }) {
  const [selectedArtisanId, setSelectedArtisanId] = useState(null);
  const [selectedCraftFilter, setSelectedCraftFilter] = useState('All');

  const masterArtisansList = [
    {
      id: 1,
      name: 'Lakshmi Devi',
      craft: 'Kalamkari Handloom Painting',
      location: 'Srikalahasti, Andhra Pradesh',
      experience: 28,
      rating: 4.9,
      productsCount: 14,
      verificationStatus: 'VERIFIED_ARTISAN',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
      craftImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
      bio: 'Master of 300-year-old family tradition of organic vegetable dye Kalamkari painting using handmade bamboo pens (kalam).'
    },
    {
      id: 2,
      name: 'Ramu Achari',
      craft: 'Etikoppaka Lacquer Toys',
      location: 'Visakhapatnam, Andhra Pradesh',
      experience: 22,
      rating: 4.8,
      productsCount: 18,
      verificationStatus: 'VERIFIED_ARTISAN',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      craftImage: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&auto=format&fit=crop&q=80',
      bio: 'Hand-turning soft ivory wood toys coated with non-toxic natural lacquer polish extracted from seeds and tree resins.'
    },
    {
      id: 3,
      name: 'Sunder Lal Kripal',
      craft: 'Jaipur Blue Pottery',
      location: 'Jaipur, Rajasthan',
      experience: 35,
      rating: 5.0,
      productsCount: 21,
      verificationStatus: 'VERIFIED_ARTISAN',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
      craftImage: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&auto=format&fit=crop&q=80',
      bio: 'Pioneer of glazed cobalt blue quartz pottery crafted using traditional clay-free Persian stone technology.'
    },
    {
      id: 4,
      name: 'Syed Ahmed Bidri',
      craft: 'Bidriware Silver Inlay',
      location: 'Bidar, Karnataka',
      experience: 40,
      rating: 4.9,
      productsCount: 16,
      verificationStatus: 'VERIFIED_ARTISAN',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
      craftImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
      bio: 'Engraving 99.9% pure sterling silver wire into oxidized zinc alloy metalwork using ancient soil formulas from Bidar Fort.'
    }
  ];

  const craftFilters = ['All', 'Kalamkari', 'Wooden Toys', 'Blue Pottery', 'Bidriware'];

  const filteredArtisans = selectedCraftFilter === 'All'
    ? masterArtisansList
    : masterArtisansList.filter(a => a.craft.toLowerCase().includes(selectedCraftFilter.toLowerCase()));

  return (
    <div className="space-y-8 pb-24 max-w-6xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl p-6 sm:p-8 space-y-2 shadow-xs">
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#8C3F2B]/10 text-[#8C3F2B] text-[10px] font-bold tracking-wider uppercase">
          <span>👥 Master Artisans Directory</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1C1C1C] tracking-tight">
          Meet Rural Indian Heritage Creators
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 font-medium leading-relaxed max-w-xl">
          Discover traditional craftsmen and craftswomen across India keeping centuries of traditional heritage art alive with fair-wage protection.
        </p>
      </div>

      {/* Craft Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
        {craftFilters.map((craft) => (
          <button
            key={craft}
            onClick={() => setSelectedCraftFilter(craft)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCraftFilter === craft
                ? 'bg-[#A6533B] text-white border-[#A6533B] shadow-xs'
                : 'bg-white text-[#1C1C1C] border-[#E8E2D9] hover:border-[#A6533B] hover:text-[#A6533B]'
            }`}
          >
            {craft}
          </button>
        ))}
      </div>

      {/* Artisans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredArtisans.map((artisan) => (
          <div
            key={artisan.id}
            className="bg-white rounded-2xl border border-[#E8E2D9] overflow-hidden p-5 shadow-2xs hover:border-[#A6533B]/60 transition-all space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={artisan.avatar}
                    alt={artisan.name}
                    className="w-14 h-14 rounded-full object-cover border border-[#E8E2D9] bg-[#FAF7F2]"
                  />
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h3 className="font-bold text-base text-[#1C1C1C]">{artisan.name}</h3>
                      <span className="flex items-center text-[10px] font-semibold text-[#356B4A] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-[#356B4A] mr-0.5" />
                        Verified
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#A6533B] mt-0.5">{artisan.craft}</p>
                    <p className="text-[11px] text-[#6B6B6B] flex items-center mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-[#A6533B] mr-1 shrink-0" />
                      <span>{artisan.location}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center space-x-1 text-xs font-bold text-[#1C1C1C]">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{artisan.rating}</span>
                  </div>
                  <span className="text-[10px] text-[#6B6B6B] block">{artisan.experience} Yrs Exp</span>
                </div>
              </div>

              <div className="aspect-16/9 rounded-xl overflow-hidden bg-[#FAF7F2] border border-[#E8E2D9] relative">
                <img src={artisan.craftImage} alt={artisan.craft} className="w-full h-full object-cover" />
                <span className="absolute bottom-2 left-2 bg-stone-900/80 text-amber-100 text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
                  {artisan.productsCount} Heritage Items Listed
                </span>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed italic">
                "{artisan.bio}"
              </p>
            </div>

            <div className="pt-3 border-t border-[#E8E2D9] flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedArtisanId(artisan.id)}
                className="flex-1 py-2 bg-[#FAF7F2] border border-[#E8E2D9] hover:border-[#A6533B] text-[#1C1C1C] font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Full Profile & Passports</span>
              </button>

              <button
                onClick={() => onSelectMode('BUY')}
                className="py-2 px-4 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>View Crafts</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Artisan Profile Modal */}
      <ArtisanProfileModal
        artisanId={selectedArtisanId}
        isOpen={Boolean(selectedArtisanId)}
        onClose={() => setSelectedArtisanId(null)}
        currentUser={user}
      />
    </div>
  );
}
