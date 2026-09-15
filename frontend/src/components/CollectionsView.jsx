import React, { useState } from 'react';
import { Sparkles, MapPin, Tag, ArrowRight, ShieldCheck, Layers, Eye } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function CollectionsView({ onSelectMode, onOpenAuth }) {
  const { language } = useLanguage();
  const [selectedRegion, setSelectedRegion] = useState('All');

  const collectionsList = [
    {
      id: 'kalamkari',
      category: 'Kalamkari',
      title: 'Srikalahasti Natural Dye Kalamkari Collection',
      titleTe: 'శ్రీకాళహస్తి సహజ రంగుల కలంకారీ కలెక్షన్',
      origin: 'Srikalahasti & Machilipatnam, Andhra Pradesh',
      giTag: 'GI Tag Certified • 300-Year Heritage',
      itemsCount: '18 Authentic Creations',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
      description: 'Hand-painted cotton and silk textiles crafted with bamboo pens (kalam) using 100% organic vegetable dyes extracted from indigo, madder root, and pomegranate rind.',
      highlights: ['100% Organic Dyes', 'Bamboo Pen Art', 'River Washed Silk']
    },
    {
      id: 'etikoppaka',
      category: 'Wooden Toys',
      title: 'Etikoppaka Organic Lacquer Wood Toys',
      titleTe: 'ఏటికొప్పాక ఆర్గానిక్ చెక్క బొమ్మల కలెక్షన్',
      origin: 'Visakhapatnam, Andhra Pradesh',
      giTag: 'Eco Lacquer Polish • Non-Toxic Child Safe',
      itemsCount: '24 Hand-turned Toys',
      image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=80',
      description: 'Hereditary wood-turning lathe craftsmanship using seasoned soft Ankudu wood coated with non-toxic natural lacquer extracted from botanical tree resins.',
      highlights: ['Zero Synthetic Dyes', 'Child-Safe Finish', 'Hand-turned Lathe']
    },
    {
      id: 'bluepottery',
      category: 'Blue Pottery',
      title: 'Jaipur Cobalt Blue Quartz Pottery',
      titleTe: 'జయపుర కోబాల్ట్ బ్లూ కుండల కలెక్షన్',
      origin: 'Jaipur, Rajasthan',
      giTag: 'UNESCO Recognized • Persian Clay-Free Quartz',
      itemsCount: '15 Hand-glazed Pieces',
      image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80',
      description: 'Traditional Egyptian and Persian blue pottery technique crafted without clay using ground quartz stone, Multani Mitti, and cobalt oxide glazes fired in kilns.',
      highlights: ['Clay-Free Quartz Slurry', 'Mughal Botanical Motifs', 'Wood Kiln Fired']
    },
    {
      id: 'bidriware',
      category: 'Bidriware',
      title: 'Bidriware Pure Sterling Silver Inlay Metalcraft',
      titleTe: 'బిద్రి వెండి చెక్కడాల రాజ కలెక్షన్',
      origin: 'Bidar, Karnataka',
      giTag: 'Royal Heritage Alloy • 800-Year Legacy',
      itemsCount: '12 Master Artifacts',
      image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
      description: 'Centuries-old metal art of Bidar Fort where pure 99.9% sterling silver wire is hammered into engraved blackened zinc-copper alloy metalwork.',
      highlights: ['99.9% Sterling Silver Wire', 'Bidar Soil Oxidation', 'Royal Inlay Geometry']
    },
    {
      id: 'ikat',
      category: 'Pochampally Ikat',
      title: 'Pochampally Double-Ikat Silk Sarees',
      titleTe: 'పోచంపల్లి డబుల్-ఇక్కత్ పట్టు చీరల కలెక్షన్',
      origin: 'Pochampally, Telangana',
      giTag: 'GI Tagged Weave • Bhoodan Heritage',
      itemsCount: '20 Heirloom Weaves',
      image: 'https://images.unsplash.com/photo-1606744888344-493238951221?auto=format&fit=crop&w=800&q=80',
      description: 'Intricate tie-dye geometry where warp and weft silk threads are individually dyed before handloom weaving, creating legendary Pochampally motifs.',
      highlights: ['Warp & Weft Tie-Dye', 'Pure Mulberry Silk', 'Heritage Handloom']
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans">
      {/* Editorial Header */}
      <div className="bg-[#FAF9F6] border border-[#E8E5DF] rounded-2xl p-6 sm:p-10 text-center space-y-4">
        <span className="text-xs uppercase tracking-widest text-[#A6533B] font-semibold block">
          CURATED INDIAN CRAFT ALBUMS & REGIONAL HERITAGE
        </span>
        <h1 className="text-3xl sm:text-5xl font-bold text-[#1C1C1C] tracking-tight max-w-3xl mx-auto">
          Explore Curated Heritage Craft Collections
        </h1>
        <p className="text-xs sm:text-sm text-[#6B6B6B] max-w-2xl mx-auto leading-relaxed">
          Discover handpicked collections grouped by traditional GI-tagged crafts, regional artisan clusters, and authentic raw material origins across India.
        </p>
      </div>

      {/* Collections Showcase Cards */}
      <div className="space-y-8">
        {collectionsList.map((col, idx) => (
          <div 
            key={col.id}
            className="bg-white rounded-3xl border border-[#E8E5DF] overflow-hidden shadow-xs hover:border-[#A6533B]/40 transition-all grid grid-cols-1 md:grid-cols-12"
          >
            {/* Image Column */}
            <div className="md:col-span-5 relative h-64 md:h-auto bg-[#FAF9F6] border-b md:border-b-0 md:border-r border-[#E8E5DF]">
              <img 
                src={col.image} 
                alt={col.title} 
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 bg-[#1C1C1C]/90 backdrop-blur-xs text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/20">
                {col.itemsCount}
              </span>
            </div>

            {/* Content Column */}
            <div className="md:col-span-7 p-6 sm:p-8 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded bg-amber-50 text-[#A6533B] border border-[#E8E5DF]">
                    {col.giTag}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight">{col.title}</h2>
                <p className="text-xs text-[#A6533B] font-semibold">{col.titleTe}</p>
                
                <p className="text-xs text-[#6B6B6B] flex items-center font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#A6533B] mr-1 shrink-0" />
                  <span>{col.origin}</span>
                </p>

                <p className="text-xs text-[#6B6B6B] leading-relaxed pt-1">
                  {col.description}
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  {col.highlights.map((h, i) => (
                    <span key={i} className="text-[10px] font-semibold text-[#1C1C1C] bg-[#FAF9F6] border border-[#E8E5DF] px-2.5 py-1 rounded-md">
                      ✓ {h}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E8E5DF] flex items-center justify-between">
                <span className="text-xs font-medium text-[#6B6B6B]">Direct Artisan Fair-Trade</span>
                <button
                  onClick={() => onSelectMode('BUY')}
                  className="px-6 py-2.5 bg-[#A6533B] hover:bg-[#88412F] text-white text-xs font-semibold rounded-xl transition-all flex items-center space-x-2 cursor-pointer shadow-xs"
                >
                  <span>Shop This Collection</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
