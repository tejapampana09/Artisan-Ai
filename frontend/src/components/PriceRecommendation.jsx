import React from 'react';
import { IndianRupee, Check, HelpCircle, ShieldCheck, Image as ImageIcon } from 'lucide-react';

export default function PriceRecommendation({ priceData, sessionData, onRecalculate, loading }) {
  if (!priceData) return null;

  const expectedPrice = priceData.artisan_expected_price ?? priceData.expected_price ?? sessionData?.artisan_expected_price ?? 0;
  const recommendedPrice = priceData.recommended_price ?? 0;
  const costFloor = priceData.cost_floor ?? priceData.protected_cost_floor ?? 0;
  const reasoning = Array.isArray(priceData.reasoning) && priceData.reasoning.length > 0
    ? priceData.reasoning
    : (Array.isArray(sessionData?.pricing_explanation) ? sessionData.pricing_explanation : []);

  const marketAvg = priceData.market_average 
    ?? sessionData?.market_research_result?.average_price 
    ?? sessionData?.market_research?.average_price 
    ?? null;

  const productTitle = sessionData?.ai_generated_listing?.title 
    || sessionData?.category_hint 
    || 'Handcrafted Artisan Creation';

  const productCategory = sessionData?.ai_generated_listing?.category 
    || sessionData?.category_hint 
    || 'Handicraft';

  const photoUrl = sessionData?.photo_url;

  return (
    <div className="space-y-6 bg-slate-900 border border-amber-500/30 p-6 sm:p-8 rounded-3xl text-slate-100 shadow-xl max-w-2xl mx-auto">
      {/* Header */}
      <div className="space-y-1 text-left">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          AI Smart Price Recommendation
        </h2>
        <p className="text-xs text-slate-400">
          Evaluated via demand intelligence, market research, and your guaranteed cost-floor protection.
        </p>
      </div>

      {/* Product Image & Name Card */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
        <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-700">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={productTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-slate-500" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <h3 className="font-bold text-sm text-slate-100 truncate">{productTitle}</h3>
          <p className="text-xs text-amber-400">{productCategory}</p>
        </div>
      </div>

      {/* Price Comparison Display */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-left">
          <span className="text-xs text-slate-400 font-medium block">Protected Cost Floor</span>
          <span className="text-xl font-extrabold text-slate-200 mt-1 block">
            {costFloor > 0 ? `₹${Number(costFloor).toLocaleString('en-IN')}` : 'Cost Protected'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">20% guaranteed margin</span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-left">
          <span className="text-xs text-emerald-400 font-bold block">Recommended Fair Price</span>
          <span className="text-2xl font-extrabold text-emerald-300 mt-1 block">
            ₹{Number(recommendedPrice).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-emerald-400/80 block mt-0.5">Optimized for craft sales</span>
        </div>
      </div>

      {/* Why? Breakdown List */}
      <div className="space-y-3 pt-2 text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          Pricing Rationale & Signals
        </h4>

        <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
          {marketAvg && (
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">Market benchmark</span>
              <span className="font-bold text-slate-200">₹{Number(marketAvg).toLocaleString('en-IN')}</span>
            </div>
          )}
          {expectedPrice > 0 && (
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">Your expected price</span>
              <span className="font-bold text-amber-300">₹{Number(expectedPrice).toLocaleString('en-IN')}</span>
            </div>
          )}
          {reasoning.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 py-1 text-slate-300 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
