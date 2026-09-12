import React, { useState } from 'react';
import { IndianRupee, ShieldCheck, ArrowRight, Layers, Clock, Package, Sparkles } from 'lucide-react';

export default function CostBreakdownInput({ onSubmit, onSkip, loading, expectedPrice }) {
  const [materialCost, setMaterialCost] = useState('');
  const [labourCost, setLabourCost] = useState('');
  const [packagingCost, setPackagingCost] = useState('');
  const [otherCost, setOtherCost] = useState('');

  const numMaterial = parseFloat(materialCost) || 0;
  const numLabour = parseFloat(labourCost) || 0;
  const numPackaging = parseFloat(packagingCost) || 0;
  const numOther = parseFloat(otherCost) || 0;

  const totalCost = numMaterial + numLabour + numPackaging + numOther;
  const costFloor = totalCost > 0 ? Math.round(totalCost * 1.20) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      material_cost: numMaterial,
      labour_cost: numLabour,
      packaging_cost: numPackaging,
      other_cost: numOther,
    });
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onSubmit({
        material_cost: 0,
        labour_cost: 0,
        packaging_cost: 0,
        other_cost: 0,
      });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-2">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-slate-100">
          Production Cost Breakdown
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Share your actual crafting costs. We use this to calculate a protected floor price ensuring you always earn a fair livelihood.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Material Cost */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" /> Raw Materials (₹)
            </label>
            <p className="text-[11px] text-slate-500">Wood, silk, brass, dyes, clay, etc.</p>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                min="0"
                step="1"
                value={materialCost}
                onChange={(e) => setMaterialCost(e.target.value)}
                placeholder="e.g. 400"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm font-semibold text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
          </div>

          {/* Labour Cost */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Artisan Time & Labour (₹)
            </label>
            <p className="text-[11px] text-slate-500">Hours or days spent handcrafting</p>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                min="0"
                step="1"
                value={labourCost}
                onChange={(e) => setLabourCost(e.target.value)}
                placeholder="e.g. 500"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm font-semibold text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
          </div>

          {/* Packaging Cost */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-400" /> Packaging & Finishing (₹)
            </label>
            <p className="text-[11px] text-slate-500">Boxes, padding, polish, wrapping</p>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                min="0"
                step="1"
                value={packagingCost}
                onChange={(e) => setPackagingCost(e.target.value)}
                placeholder="e.g. 100"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm font-semibold text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
          </div>

          {/* Other Costs */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Other / Transport (₹)
            </label>
            <p className="text-[11px] text-slate-500">Freight, fuel, tools, firing, electricity</p>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                min="0"
                step="1"
                value={otherCost}
                onChange={(e) => setOtherCost(e.target.value)}
                placeholder="e.g. 50"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm font-semibold text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Live Protection Summary */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-300">Fair-Cost Protected Floor</div>
              <div className="text-[11px] text-slate-400">
                Total Cost: ₹{totalCost.toLocaleString('en-IN')} + 20% guaranteed safety margin
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold text-amber-400">
              {costFloor ? `₹${costFloor.toLocaleString('en-IN')}` : '₹0'}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Minimum Floor</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-slate-200 px-4 py-2 rounded-xl transition-all"
          >
            Skip (Use Estimated Cost)
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-7 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all"
          >
            {loading ? 'Evaluating Dynamic Pricing...' : 'Calculate Fair Valuation'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
