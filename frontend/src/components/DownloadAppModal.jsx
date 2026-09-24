import React, { useState } from 'react';
import { X, Smartphone, Download, CheckCircle2, Info } from 'lucide-react';

export default function DownloadAppModal({ isOpen, onClose }) {
  const [showInstructions, setShowInstructions] = useState(false);

  if (!isOpen) return null;

  const handleInstallPWA = () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      window.deferredPrompt.userChoice.then(() => {
        window.deferredPrompt = null;
      });
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-[#E8E2D9] shadow-2xl space-y-5 text-[#1C1C1C] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-800 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-[#A6533B] text-white flex items-center justify-center mx-auto shadow-md">
            <Smartphone className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A6533B] bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
            Native Mobile PWA App
          </span>
          <h3 className="text-xl font-bold text-[#1C1C1C]">Download Artisan AI App</h3>
          <p className="text-xs text-[#6B6B6B] leading-relaxed">
            Get instant push notifications for orders, offline catalog sync, and Voice AI creation directly on your mobile device.
          </p>
        </div>

        <div className="space-y-2.5 bg-[#FAF7F2] p-4 rounded-2xl border border-[#E8E2D9] text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Fast, lightweight app experience (Zero store download needed)</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Works offline with automatic cloud synchronization</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Instant push alerts for buyer enquiries & sales</span>
          </div>
        </div>

        <button
          onClick={handleInstallPWA}
          className="w-full py-3 bg-[#A6533B] hover:bg-[#88412F] text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 text-sm"
        >
          <Download className="w-4 h-4" />
          <span>Install App / Add to Home Screen</span>
        </button>

        {showInstructions && (
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-stone-800 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center space-x-1.5 font-bold text-[#A6533B]">
              <Info className="w-4 h-4" />
              <span>Easy Manual Install:</span>
            </div>
            <p className="leading-relaxed">
              1. Tap your browser menu (<span className="font-bold">⋮</span> on Android, or <span className="font-bold">Share ⎋</span> on iOS Safari).<br />
              2. Select <span className="font-bold">"Add to Home Screen"</span> or <span className="font-bold">"Install App"</span>.
            </p>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-[#6B6B6B] hover:text-[#1C1C1C] transition-colors cursor-pointer"
          >
            Close & Continue in Browser
          </button>
        </div>
      </div>
    </div>
  );
}
