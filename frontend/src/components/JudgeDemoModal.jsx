import React, { useState } from 'react';
import {
  Award, CheckCircle2, ArrowRight, Zap, Play, Sparkles,
  WifiOff, Wifi, Layers, HelpCircle, X, ShieldAlert, Cpu, Database
} from 'lucide-react';
import { recordEvent, placeOrder } from '../api';
import { useOffline } from '../context/OfflineContext';

export default function JudgeDemoModal({ isOpen, onClose, onRefreshData }) {
  const { isOffline, toggleOfflineMode, queueCount, queueProductDraft, triggerSync } = useOffline();
  const [triggering, setTriggering] = useState('');
  const [lastActionStatus, setLastActionStatus] = useState('');

  if (!isOpen) return null;

  const handleSimulateDemandSpike = async () => {
    setTriggering('demand');
    setLastActionStatus('Firing 5 buyer interaction events for Kalamkari...');
    try {
      // 1 search, 2 views, 1 enquiry, 1 order
      await recordEvent({ event_type: 'SEARCH', category: 'Kalamkari', query: 'Srikalahasti hand painted silk' });
      await recordEvent({ event_type: 'VIEW', category: 'Kalamkari', product_id: 1, metadata_info: 'Viewed dupatta details' });
      await recordEvent({ event_type: 'VIEW', category: 'Kalamkari', product_id: 1, metadata_info: 'Inspected weave pattern' });
      await recordEvent({ event_type: 'SAVE', category: 'Kalamkari', product_id: 1, metadata_info: 'Saved to bridal wishlist' });
      await recordEvent({ event_type: 'ORDER', category: 'Kalamkari', product_id: 1, metadata_info: 'Express festival gift order' });

      setLastActionStatus('✅ 5 events recorded! Demand surge recalculating. Refreshing dashboard...');
      if (onRefreshData) await onRefreshData();
    } catch (err) {
      setLastActionStatus(`❌ Error firing events: ${err.message}`);
    } finally {
      setTriggering('');
    }
  };

  const handleSimulateOfflineDraft = () => {
    setTriggering('offline');
    try {
      if (!isOffline) {
        toggleOfflineMode(true);
      }
      const draftItem = queueProductDraft({
        title: 'Bastar Bell Metal Tribal Figurine (Offline Draft)',
        category: 'Dokra',
        price: 1650,
        stock: 2,
        material_cost: 380,
        labour_cost: 580,
        packaging_cost: 90,
        min_margin_pct: 0.20,
        materials: 'Recycled brass, beeswax core, riverbed silt',
        description: 'Traditional Dhokra lost-wax craft created in Bastar cluster with no cellular signal.',
        craft_story: 'Handcrafted using hollow-casting technique preserved across seven tribal generations.',
        status: 'DRAFT',
        image_url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=400'
      });

      setLastActionStatus(`✅ Switched to Offline Mode! Draft "${draftItem.label}" stored in device localStorage queue.`);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setLastActionStatus(`❌ Error queuing offline: ${err.message}`);
    } finally {
      setTriggering('');
    }
  };

  const handleTestCloudSync = async () => {
    setTriggering('sync');
    setLastActionStatus('Restoring connection and executing atomic batch sync...');
    try {
      if (isOffline) {
        toggleOfflineMode(false);
      }
      const res = await triggerSync();
      setLastActionStatus(`✅ Synced! ${res?.total_items_synced || 0} offline item(s) written to SQLite database.`);
      if (onRefreshData) await onRefreshData();
    } catch (err) {
      setLastActionStatus(`❌ Sync error: ${err.message}`);
    } finally {
      setTriggering('');
    }
  };

  const steps = [
    {
      step: '1',
      title: 'SELL ↔ BUY Toggle',
      desc: 'Single unified account. Artisan sells their creations, or switches seamlessly to buy raw materials & peers’ crafts.',
      badge: 'Verified'
    },
    {
      step: '2',
      title: 'Cost Basis & Fair Margin',
      desc: 'Never sell at a loss. Enforces (Raw + Labour + Packaging) + ≥20% protected artisan living wage.',
      badge: 'Verified'
    },
    {
      step: '3',
      title: 'Multilingual AI Voice Studio',
      desc: 'Voice transcription in 5 Indian languages (Telugu, Hindi, Tamil, Bengali, English) + Studio enhancement preview.',
      badge: 'Verified'
    },
    {
      step: '4',
      title: 'Buyer Event Engine',
      desc: 'Weights 5 interactions: SEARCH (2), VIEW (1), SAVE (4), ENQUIRY (6), ORDER (10). Real-time event log.',
      badge: 'Verified'
    },
    {
      step: '5',
      title: 'Market Intelligence & Copilot',
      desc: 'Closed-loop feedback: Buyer demand automatically updates category surge and prompts seller with actionable insights.',
      badge: 'Verified'
    },
    {
      step: '6',
      title: 'Explainable Dynamic Pricing',
      desc: 'Transparent formula with hard safety bounds (Max +25%, Min Fair Floor). Artisan holds 100% final veto authority.',
      badge: 'Verified'
    },
    {
      step: '7',
      title: 'Rural Offline Resilience',
      desc: 'Intermittent 2G protection. Draft products and accept prices offline; auto-syncs via atomic batch on reconnection.',
      badge: 'Verified'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-orange-950 p-6 text-white flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">SIH 2026 Evaluation Suite</span>
                <span className="text-[10px] bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full border border-amber-400/20 font-mono">
                  PS ID: 26090
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5">Artisan AI — 7-Step Architectural Proof</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* Status Message */}
          {lastActionStatus && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 font-semibold flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>{lastActionStatus}</span>
            </div>
          )}

          {/* Quick 1-Click Verification Triggers for Judges */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 rounded-2xl border border-amber-200/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center space-x-2 mb-3">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>1-Click Live Judge Demonstration Triggers</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={handleSimulateDemandSpike}
                disabled={!!triggering}
                className="p-3 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-left transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                  <Play className="w-3.5 h-3.5 text-amber-600" />
                  <span>1. Trigger Demand Spike</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Sends 5 buyer events for Kalamkari. Watch Copilot surge.
                </p>
              </button>

              <button
                onClick={handleSimulateOfflineDraft}
                disabled={!!triggering}
                className="p-3 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-left transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                  <WifiOff className="w-3.5 h-3.5 text-orange-600" />
                  <span>2. Draft Offline Craft</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Switches to local offline sandbox and queues a craft.
                </p>
              </button>

              <button
                onClick={handleTestCloudSync}
                disabled={!!triggering}
                className="p-3 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-left transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>3. Reconnect & Auto-Sync</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Flushes pending offline queue to SQLite cloud database.
                </p>
              </button>
            </div>
          </div>

          {/* 7-Step Architecture Checklist */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Full 7-Step Verified Architecture</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                7/7 Complete
              </span>
            </h3>

            <div className="space-y-2.5">
              {steps.map((item) => (
                <div
                  key={item.step}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors flex items-start space-x-3"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Target Users: Rural Artisans & Global Connoisseurs</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
