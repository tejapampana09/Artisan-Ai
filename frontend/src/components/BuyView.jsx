import React from 'react';
import { Search, ShoppingBag, Heart, Sparkles, Filter } from 'lucide-react';

export default function BuyView({ user }) {
  const craftCategories = [
    { name: 'Kalamkari Art', region: 'Andhra Pradesh', trending: '+32%' },
    { name: 'Channapatna Toys', region: 'Karnataka', trending: '+24%' },
    { name: 'Blue Pottery', region: 'Rajasthan', trending: '+18%' },
    { name: 'Bidriware Metalwork', region: 'Karnataka', trending: '+15%' },
    { name: 'Pochampally Ikat', region: 'Telangana', trending: '+28%' },
  ];

  return (
    <div className="space-y-6">
      {/* Buyer Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg shadow-indigo-950/20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-indigo-700/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-indigo-200 mb-2 border border-indigo-500/30">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Buyer Marketplace Active (Single Account Seamless Mode)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Discover Authentic Indian Crafts Direct from Artisans</h1>
          <p className="text-indigo-200 text-sm mt-1">
            Empower marginalized weavers and creators. B2C shopping and B2B bulk orders supported.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mt-5 flex items-center bg-white/10 backdrop-blur-md rounded-xl p-1.5 border border-white/20 max-w-xl">
          <Search className="w-5 h-5 text-indigo-200 ml-2.5 mr-2" />
          <input
            type="text"
            placeholder="Search Kalamkari, Channapatna toys, sarees..."
            className="w-full bg-transparent text-white placeholder-indigo-300 text-sm focus:outline-none"
            readOnly
          />
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold">
            Search
          </button>
        </div>
      </div>

      {/* Trending Categories */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>High-Demand Heritage Crafts</span>
          </h2>
          <span className="text-xs text-slate-500">Live demand engine signals</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {craftCategories.map((c) => (
            <div
              key={c.name}
              className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-800">{c.name}</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  {c.trending}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{c.region}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
