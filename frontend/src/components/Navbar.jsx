import React from 'react';
import { Store, ShoppingBag, CheckCircle2, AlertCircle, Sparkles, UserCheck } from 'lucide-react';

export default function Navbar({ activeMode, onToggleMode, user, readyStatus }) {
  const isSell = activeMode === 'SELL';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xl tracking-tight text-slate-900">Artisan AI</span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  SIH 2026
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">AI-Driven Market Linkage for Marginalized Artisans</p>
            </div>
          </div>

          {/* Mode Switcher SELL <-> BUY (Center) */}
          <div className="flex items-center">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 shadow-inner">
              <button
                id="sell-mode-toggle"
                onClick={() => onToggleMode('SELL')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isSell
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>SELL Mode</span>
              </button>
              <button
                id="buy-mode-toggle"
                onClick={() => onToggleMode('BUY')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  !isSell
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>BUY Mode</span>
              </button>
            </div>
          </div>

          {/* User profile & backend status indicator */}
          <div className="flex items-center space-x-3">
            {/* Backend Connection Badge */}
            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-slate-50 text-slate-700">
              {readyStatus?.status === 'ready' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-700 font-medium">DB Connected</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-amber-700 font-medium">Connecting...</span>
                </>
              )}
            </div>

            {/* Single Account Badge */}
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 py-1 px-3 rounded-full text-xs text-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-medium truncate max-w-[120px]">{user?.name || 'Artisan'}</span>
              <span className="text-[10px] text-slate-400">({user?.craft ? 'Artisan' : 'User'})</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
