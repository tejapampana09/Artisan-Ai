import React, { useState } from 'react';
import { IndianRupee, ShieldAlert, Sparkles, TrendingUp, HelpCircle, RefreshCw } from 'lucide-react';

export default function PriceRecommendation({ priceData, onRecalculate, loading }) {
  if (!priceData) return null;

  const {
    cost_floor = 0,
    expected_price = 0,
    recommended_price = 0,
    pricing_model = 'Option B (+25% cap)',
    reasoning = [],
    is_capped = false,
    uncapped_recommended_price = 0,
    max_capped_price = 0,
    breakdown = {}
  } = priceData;

  const [costs, setCosts] = useState({
    material_cost: breakdown.material_cost || 0,
    labour_cost: breakdown.labour_cost || 0,
    packaging_cost: breakdown.packaging_cost || 0,
    other_cost: breakdown.other_cost || 0,
  });

  const [showCostEditor, setShowCostEditor] = useState(false);

  const handleCostChange = (field, val) => {
    setCosts((prev) => ({ ...prev, [field]: parseFloat(val) || 0 }));
  };

  const handleApplyRecalculate = (e) => {
    e.preventDefault();
    if (onRecalculate) {
      onRecalculate(costs);
    }
  };

  return (
    <div className="space-y-6 bg-slate-900/90 p-6 rounded-2xl border border-amber-500/30 text-slate-100">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold text-amber-300 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Explainable AI Dynamic Pricing
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Artisan-controlled pricing with evidence-based market floors and safety caps ({pricing_model})
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold px-3 py-1 bg-amber-500/10 text-amber-300 rounded-full border border-amber-500/30">
            P0 Option B Cap Active
          </span>
        </div>
      </div>

      {/* Main Pricing Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cost Floor Card */}
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Fair Cost Floor
          </div>
          <div className="text-2xl font-bold text-slate-200 flex items-center">
            <IndianRupee className="w-5 h-5 text-slate-400" />
            {Number(cost_floor).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Materials + Labour + Packaging minimum guaranteed return
          </p>
        </div>

        {/* Artisan Expected Price */}
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Artisan Expected
          </div>
          <div className="text-2xl font-bold text-purple-300 flex items-center">
            <IndianRupee className="w-5 h-5 text-purple-400" />
            {Number(expected_price).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Your desired valuation based on craft expertise
          </p>
        </div>

        {/* AI Recommended Price */}
        <div className="bg-gradient-to-br from-amber-950/60 to-purple-950/60 p-4 rounded-xl border border-amber-500/40 relative overflow-hidden">
          <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            Recommended Price
          </div>
          <div className="text-3xl font-extrabold text-amber-400 flex items-center">
            <IndianRupee className="w-6 h-6 text-amber-400" />
            {Number(recommended_price).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-amber-200/80 mt-2">
            Optimal market price balancing buyer demand & artisan equity
          </p>
        </div>
      </div>

      {/* Option B Cap Alert Notification */}
      {is_capped && (
        <div className="bg-amber-950/50 border border-amber-500/50 p-4 rounded-xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200 space-y-1">
            <span className="font-bold text-amber-300">Single-Cycle +25% Cap Applied (Option B):</span>
            <p>
              To protect market liquidity and avoid sudden buyer shock, the price increase from your floor/previous valuation (₹{Number(cost_floor).toLocaleString('en-IN')}) was capped at +25% for this selling cycle (Max: ₹{Number(max_capped_price).toLocaleString('en-IN')}).
            </p>
            {uncapped_recommended_price > recommended_price && (
              <p className="text-slate-400 italic">
                Full market valuation target is ₹{Number(uncapped_recommended_price).toLocaleString('en-IN')}, which will be reached gradually across future successful orders.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pricing Reasoning List */}
      {reasoning && reasoning.length > 0 && (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
          <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            Why this price? (Explainable AI Breakdown)
          </h4>
          <ul className="space-y-2">
            {reasoning.map((item, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cost Floor Editor Toggle */}
      <div className="pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setShowCostEditor(!showCostEditor)}
          className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {showCostEditor ? 'Hide Cost Calculator' : 'Adjust Material & Labour Cost Breakdown'}
        </button>

        {showCostEditor && (
          <form onSubmit={handleApplyRecalculate} className="mt-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Material (₹)</label>
              <input
                type="number"
                min="0"
                value={costs.material_cost}
                onChange={(e) => handleCostChange('material_cost', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Labour (₹)</label>
              <input
                type="number"
                min="0"
                value={costs.labour_cost}
                onChange={(e) => handleCostChange('labour_cost', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Packaging (₹)</label>
              <input
                type="number"
                min="0"
                value={costs.packaging_cost}
                onChange={(e) => handleCostChange('packaging_cost', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Other Costs (₹)</label>
              <input
                type="number"
                min="0"
                value={costs.other_cost}
                onChange={(e) => handleCostChange('other_cost', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
            <div className="col-span-2 md:col-span-4 mt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow"
              >
                {loading ? 'Recalculating...' : 'Recalculate Floor & Price'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
