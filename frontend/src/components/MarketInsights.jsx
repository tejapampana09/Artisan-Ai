import React from 'react';
import { BarChart3, TrendingUp, ShieldCheck, ExternalLink, ArrowRight } from 'lucide-react';

export default function MarketInsights({ marketData, onContinue }) {
  if (!marketData) return null;

  const { market_range = {}, median = 0, comparable_count = 0, evidences = [] } = marketData;
  const low = market_range.low || 0;
  const high = market_range.high || 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6">
      <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <BarChart3 className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Evidence-Based Market Research
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                {comparable_count} comparable listings
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Real market evidence retrieved for similar handcrafted creations
            </p>
          </div>
        </div>
      </div>

      {/* Price Range Visualizer Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <span className="text-xs text-slate-400">Comparable Market Price Range</span>
          <span className="text-xs font-mono text-amber-400 font-semibold">
            Median: ₹{median.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="relative pt-2 pb-6">
          <div className="h-3 bg-slate-800 rounded-full w-full relative overflow-hidden">
            <div className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 to-purple-600 rounded-full w-full"></div>
          </div>

          <div className="flex justify-between items-center text-sm font-mono font-bold text-slate-200 mt-2">
            <span>₹{low.toLocaleString('en-IN')}</span>
            <span className="text-amber-400 text-base">₹{median.toLocaleString('en-IN')}</span>
            <span>₹{high.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Comparable Evidence List */}
      {evidences && evidences.length > 0 && (
        <div className="space-y-3 mb-6">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Comparable Listings ({evidences.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {evidences.slice(0, 4).map((ev, idx) => (
              <div key={idx} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-200 truncate">{ev.title}</div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{ev.category}</span>
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" />
                      {ev.source.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="font-mono font-bold text-amber-300 text-sm flex-shrink-0">
                  ₹{Number(ev.listed_price).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {onContinue && (
        <button
          onClick={onContinue}
          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg transition-all"
        >
          <span>Continue to Enter Your Expected Price</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
