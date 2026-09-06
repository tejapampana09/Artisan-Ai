import React from 'react';
import { Bot, TrendingUp, Package, MessageSquare, ArrowUpRight, Sparkles, Check } from 'lucide-react';

export default function CopilotWidget({ copilotInsight, onActionTaken, onOpenEnquiries }) {
  if (!copilotInsight) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl border border-indigo-500/30 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/10">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-orange-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-wide uppercase text-amber-300">AI Business Copilot</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                Live Signal
              </span>
            </div>
            <p className="text-xs text-slate-300">Transforms real-time buyer marketplace events into actionable seller decisions</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/10 text-slate-200 border border-white/10 self-start sm:self-auto">
          {copilotInsight.category}
        </span>
      </div>

      {/* Headline & Evidence Narrative */}
      <div className="mt-4 space-y-3">
        <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span>"{copilotInsight.headline}"</span>
        </h3>
        
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-white/5 p-3.5 rounded-xl border border-white/10">
          {copilotInsight.narrative}
        </p>

        {/* Signals Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block">Market Demand</span>
            <div className="flex items-center space-x-1 mt-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-base font-bold text-emerald-400">{copilotInsight.demand_label}</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block">Current Stock</span>
            <div className="flex items-center space-x-1 mt-1">
              <Package className="w-4 h-4 text-amber-400" />
              <span className="text-base font-bold text-white">{copilotInsight.stock} units</span>
            </div>
          </div>

          <div 
            onClick={() => onOpenEnquiries && onOpenEnquiries()}
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 cursor-pointer transition-colors"
            title="Click to view buyer enquiries"
          >
            <span className="text-[11px] text-slate-400 block">Buyer Enquiries</span>
            <div className="flex items-center space-x-1 mt-1">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span className="text-base font-bold text-white">{copilotInsight.buyer_enquiries} leads</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block">Comparable Range</span>
            <span className="text-xs font-bold text-amber-300 mt-1 block">
              {copilotInsight.benchmark_range}
            </span>
          </div>
        </div>

        {/* Next Best Action Card */}
        <div className="mt-2 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 border border-amber-400/40 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">Next Best Action</span>
            <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
              {copilotInsight.next_best_action}
            </p>
          </div>
          <button
            onClick={() => onActionTaken && onActionTaken(copilotInsight)}
            className="inline-flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <span>Apply Opportunity</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
