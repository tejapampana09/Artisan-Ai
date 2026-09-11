import React from 'react';
import { IndianRupee, Check, HelpCircle } from 'lucide-react';

export default function PriceRecommendation({ priceData, onRecalculate, loading }) {
  if (!priceData) return null;

  const {
    expected_price = 1500,
    recommended_price = 1450,
    cost_floor = 1300,
    reasoning = [
      'Market average is ₹1,320 based on verified demand data.',
      'Your expected price was ₹1,500.',
      'High demand observed for this craft category.',
      'Fair-cost protection ensures minimum 20% margin above raw materials.'
    ]
  } = priceData;

  return (
    <div className="space-y-6 bg-white p-6 sm:p-8 rounded-3xl border border-[#E7E7E2] text-[#171717] shadow-sm max-w-2xl mx-auto">
      {/* Screen 10 Header */}
      <div className="space-y-1 text-left">
        <h2 className="text-2xl font-bold text-[#171717]">Smart Price</h2>
        <p className="text-xs text-[#666666]">
          AI analyses market demand to suggest the best price
        </p>
      </div>

      {/* Product Image & Name Card */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#FAFAF7] border border-[#E7E7E2]">
        <div className="w-16 h-16 rounded-xl bg-[#E7E7E2] overflow-hidden shrink-0">
          <img
            src="https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=400&q=80"
            alt="Kondapalli Elephant"
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h3 className="font-bold text-sm text-[#171717]">Kondapalli Elephant</h3>
          <p className="text-xs text-[#666666]">Wooden Toy Craft</p>
        </div>
      </div>

      {/* Price Comparison Display */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-[#FAFAF7] border border-[#E7E7E2] text-left">
          <span className="text-xs text-[#666666] font-medium block">Current price</span>
          <span className="text-xl font-extrabold text-[#171717] mt-1 block">
            ₹{Number(cost_floor || 1300).toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-left">
          <span className="text-xs text-[#176B4D] font-bold block">Recommended</span>
          <span className="text-xl font-extrabold text-[#176B4D] mt-1 block">
            ₹{Number(recommended_price || 1450).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Why? Breakdown List */}
      <div className="space-y-3 pt-2 text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-[#176B4D]" />
          Why?
        </h4>

        <div className="space-y-2.5 text-xs text-[#171717] bg-[#FAFAF7] p-4 rounded-2xl border border-[#E7E7E2]">
          <div className="flex justify-between items-center pb-2 border-b border-[#E7E7E2]">
            <span className="text-[#666666]">Market average</span>
            <span className="font-bold">₹1,320</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-[#E7E7E2]">
            <span className="text-[#666666]">Your expected price</span>
            <span className="font-bold">₹{Number(expected_price).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-[#E7E7E2]">
            <span className="text-[#666666]">Demand</span>
            <span className="font-bold text-[#176B4D]">High</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#666666]">Fair-cost protection</span>
            <span className="font-bold text-[#176B4D]">Available</span>
          </div>
        </div>
      </div>

      {/* Accept CTA Button */}
      <div className="pt-2">
        <button
          onClick={() => {
            if (onRecalculate) onRecalculate({ price: recommended_price });
          }}
          disabled={loading}
          className="w-full py-4 bg-[#176B4D] hover:bg-[#0F4D38] text-white font-bold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          <span>Accept ₹{Number(recommended_price).toLocaleString('en-IN')}</span>
        </button>
      </div>
    </div>
  );
}
