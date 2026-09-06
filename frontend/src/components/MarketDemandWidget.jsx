import React from 'react';
import { TrendingUp, Flame, Activity } from 'lucide-react';

export default function MarketDemandWidget({ demands = [] }) {
  if (!demands || demands.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">Regional Craft Market Demand</h3>
        </div>
        <span className="text-[11px] text-slate-500 flex items-center space-x-1">
          <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
          <span>Calculated from Buyer Events</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {demands.map((d) => (
          <div
            key={d.category}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-slate-900 block">{d.category}</span>
                <span className="text-[10px] text-slate-400 font-medium">Market Benchmark: {d.benchmark_price_range}</span>
              </div>
              <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                d.demand_pct >= 30
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {d.demand_pct_label}
              </span>
            </div>

            {/* Demand Progress Bar */}
            <div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    d.demand_pct >= 30 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, d.demand_pct)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>{d.total_buyer_events} buyer interactions</span>
                <span className="font-semibold text-slate-700">{d.trend_direction}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
