import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Sparkles, Tag, ShieldCheck, Edit3, Save, Trash2, 
  TrendingUp, ArrowRight, CheckCircle2, AlertCircle, Info, Lock
} from 'lucide-react';
import { getPriceRecommendation, submitPriceDecision } from '../api';
import { useOffline } from '../context/OfflineContext';
import { useNotification } from '../context/NotificationContext';

export default function ProductDetailModal({ product, isOpen, onClose, onUpdated, onDelete, currentUser }) {
  const notify = useNotification();
  const { isOffline, queuePriceDecision } = useOffline();
  
  const isOwner = !product || !currentUser || !product.seller_id || product.seller_id === currentUser?.id;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: product?.title || '',
    price: product?.price || 0,
    stock: product?.stock || 0,
    description: product?.description || '',
    craft_story: product?.craft_story || '',
    materials: product?.materials || '',
    material_cost: product?.material_cost || 0,
    labour_cost: product?.labour_cost || 0,
    packaging_cost: product?.packaging_cost || 0,
  });
  const [saving, setSaving] = useState(false);
  
  // Step 6: Pricing Recommendation State
  const [pricingRec, setPricingRec] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState('');
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  const fetchPricing = useCallback(async () => {
    if (!product) return;
    setPricingLoading(true);
    if (isOffline || (typeof product.id === 'string' && product.id.startsWith('draft_local_'))) {
      setPricingRec({
        unavailable_offline: true,
        reasoning: [
          'Pricing recommendation unavailable offline. Cloud sync required.',
          'Live competitor benchmarks and AI pricing models require cloud connectivity.',
          'Connect to the internet to run real-time fair wage and demand analysis for this product.'
        ]
      });
      setPricingLoading(false);
      return;
    }

    try {
      const data = await getPriceRecommendation(product.id);
      setPricingRec(data);
    } catch (err) {
      console.error('Failed to fetch pricing recommendation:', err);
    } finally {
      setPricingLoading(false);
    }
  }, [isOffline, product]);

  useEffect(() => {
    if (isOpen && product) {
      setIsEditing(false);
      setDecisionFeedback('');
      setFormData({
        title: product.title,
        price: product.price,
        stock: product.stock,
        description: product.description || '',
        craft_story: product.craft_story || '',
        materials: product.materials || '',
        material_cost: product.material_cost,
        labour_cost: product.labour_cost,
        packaging_cost: product.packaging_cost,
      });
      fetchPricing();
    }
  }, [isOpen, product, fetchPricing]);

  if (!isOpen || !product) return null;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdated(product.id, formData);
      setIsEditing(false);
      await fetchPricing();
      notify.success('Product updated successfully');
    } catch (err) {
      notify.error('Error updating product: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (decision) => {
    setDecisionSubmitting(true);
    if (isOffline) {
      const appliedPrice = decision === 'ACCEPT' ? (pricingRec?.recommended_price || product.price) : product.price;
      queuePriceDecision({
        product_id: typeof product.id === 'number' ? product.id : 1,
        decision,
        recommended_price: pricingRec?.recommended_price || product.price,
        previous_price: product.price,
        demand_factor: pricingRec?.demand_factor || 1.0,
        market_adjustment: pricingRec?.market_adjustment || 1.0,
        reasoning_summary: decision === 'ACCEPT' ? 'Artisan approved in offline mode' : 'Artisan kept current price in offline mode'
      });
      if (decision === 'ACCEPT') {
        setDecisionFeedback(`Decision saved offline! Price updated locally to ₹${appliedPrice.toLocaleString('en-IN')}. Will sync to cloud on reconnect.`);
        await onUpdated(product.id, { price: appliedPrice });
      } else {
        setDecisionFeedback('Rejection saved offline. Current price maintained.');
      }
      setDecisionSubmitting(false);
      return;
    }

    try {
      const res = await submitPriceDecision(product.id, decision);
      if (decision === 'ACCEPT') {
        setDecisionFeedback(`Accepted! Product price updated to ₹${res.applied_price.toLocaleString('en-IN')}.`);
        await onUpdated(product.id, { price: res.applied_price });
      } else {
        setDecisionFeedback(`Kept current price at ₹${res.applied_price.toLocaleString('en-IN')}. Decision recorded.`);
      }
      await fetchPricing();
    } catch (err) {
      notify.error('Decision submission failed: ' + err.message);
    } finally {
      setDecisionSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {product.category}
              </span>
              <span className="text-[11px] text-slate-500">ID #{product.id}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">{product.title}</h3>
          </div>
          <div className="flex items-center space-x-2">
            {!isOwner ? (
              <span className="inline-flex items-center space-x-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>View-only (Other Seller)</span>
              </span>
            ) : !isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Fields</span>
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this craft?')) {
                    onDelete(product.id);
                    onClose();
                  }
                }}
                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Delete Craft"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {decisionFeedback && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{decisionFeedback}</span>
            </div>
            <button onClick={() => setDecisionFeedback('')} className="text-emerald-700 hover:text-emerald-900">✕</button>
          </div>
        )}

        {/* STEP 6: EXPLAINABLE DYNAMIC PRICING PANEL */}
        <div className="mt-5 bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-slate-50 border border-amber-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-amber-200/50">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Explainable Dynamic Pricing Recommendation</h4>
                <p className="text-[11px] text-slate-500">Continuous market-aware guidance with guaranteed margin protection</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 border border-amber-300 px-2.5 py-1 rounded-full self-start sm:self-auto flex items-center space-x-1">
              <Lock className="w-3 h-3" />
              <span>Artisan Controlled</span>
            </span>
          </div>

          {pricingLoading ? (
            <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Computing price recommendation...</span>
            </div>
          ) : pricingRec?.unavailable_offline ? (
            <div className="bg-white rounded-xl p-4 border border-amber-300 shadow-xs space-y-2.5">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Pricing recommendation unavailable offline. Cloud sync required.</span>
              </div>
              <ul className="space-y-1 pl-6 list-disc text-[11px] text-slate-600">
                {pricingRec.reasoning.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : pricingRec ? (
            <div className="space-y-4">
              {/* CURRENT vs RECOMMENDED PRICE HERO */}
              <div className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Price</span>
                    <span className="text-xl font-extrabold text-slate-700">₹{pricingRec.current_price.toLocaleString('en-IN')}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-700 block flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>AI Recommended</span>
                    </span>
                    <span className="text-2xl font-black text-amber-700">₹{pricingRec.recommended_price.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Delta Badge */}
                <div className="text-left sm:text-right">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                    pricingRec.price_change_amount > 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : pricingRec.price_change_amount < 0
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {pricingRec.price_change_amount > 0 ? `+₹${pricingRec.price_change_amount} (+${pricingRec.price_change_percentage}%)` : `₹0 (Optimized)`}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">Based on Demand + Cost Guard</span>
                </div>
              </div>

              {/* WHY THIS PRICE? (EXPLANATION BREAKDOWN) */}
              <div className="bg-white/80 rounded-xl p-4 border border-slate-200 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wide flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    <span>Why this price? (Data Breakdown)</span>
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-700">
                    Position: {pricingRec.current_market_position}
                  </span>
                </div>

                {/* Cost Basis vs Minimum Fair Price Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Total Cost Basis</span>
                    <strong className="text-xs text-slate-900">₹{pricingRec.cost_basis}</strong>
                    <span className="text-[9px] text-slate-400 block">Mat: ₹{product.material_cost} | Lab: ₹{product.labour_cost}</span>
                  </div>
                  <div className="bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 font-bold block flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Min Safe Price</span>
                    </span>
                    <strong className="text-xs text-emerald-900">₹{pricingRec.minimum_fair_price}</strong>
                    <span className="text-[9px] text-emerald-700 block">Guarantees ≥ {pricingRec.safety_constraints.min_margin_percentage}% margin</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Demand Factor</span>
                    <strong className="text-xs text-slate-900">{pricingRec.demand_factor}x</strong>
                    <span className="text-[9px] text-slate-400 block">Bounded [0.95, 1.15]</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Market Benchmark</span>
                    <strong className="text-xs text-slate-900">₹{pricingRec.market_range.low}–₹{pricingRec.market_range.high}</strong>
                    <span className="text-[9px] text-slate-400 block">Adj: {pricingRec.market_adjustment}x</span>
                  </div>
                </div>

                {/* Reasoning Bullet Points */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 block">Key Observations:</span>
                  <ul className="space-y-1">
                    {pricingRec.reasoning.map((r, i) => (
                      <li key={i} className="text-[11px] text-slate-600 flex items-start space-x-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* SELLER CONTROL BUTTONS & MANDATORY NOTICE */}
              <div className="pt-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <p className="text-[11px] text-slate-500 italic flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Your price will not change automatically. The artisan always makes the final decision.</span>
                </p>

                {isOwner ? (
                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleDecision('REJECT')}
                      disabled={decisionSubmitting}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                    >
                      Keep Current Price
                    </button>
                    <button
                      onClick={() => handleDecision('ACCEPT')}
                      disabled={decisionSubmitting || pricingRec.recommended_price === pricingRec.current_price}
                      className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept ₹{pricingRec.recommended_price.toLocaleString('en-IN')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Price decisions can only be approved by the owning artisan</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Existing Product Media & Story Section */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <img
              src={product.enhanced_image_url || product.image_url}
              alt={product.title}
              className="w-full h-48 rounded-xl object-cover border border-slate-200 shadow-xs"
            />
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Stock Inventory:</span>
                {isEditing ? (
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    className="w-20 border rounded px-1 text-right text-xs"
                  />
                ) : (
                  <strong className="text-slate-800">{product.stock} units</strong>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Listing Price:</span>
                <strong className="text-slate-900 font-bold">₹{product.price.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="font-semibold text-slate-700 block mb-1">Description</span>
              {isEditing ? (
                <textarea
                  name="description"
                  rows="2"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              ) : (
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {product.description || 'No description entered.'}
                </p>
              )}
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1">Heritage & Craft Story</span>
              {isEditing ? (
                <textarea
                  name="craft_story"
                  rows="2"
                  value={formData.craft_story}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              ) : (
                <p className="text-slate-600 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100 leading-relaxed italic">
                  "{product.craft_story || 'No craft story attached.'}"
                </p>
              )}
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1">Materials</span>
              {isEditing ? (
                <input
                  type="text"
                  name="materials"
                  value={formData.materials}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              ) : (
                <p className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {product.materials || 'Traditional artisan materials'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
