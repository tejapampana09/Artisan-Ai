import React from 'react';
import { Store, ShoppingBag, CheckCircle2, AlertCircle, Sparkles, UserCheck, Wifi, WifiOff, Award } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

export default function Navbar({ activeMode, onToggleMode, user, readyStatus, onOpenGuide }) {
  const isSell = activeMode === 'SELL';
  const { isOffline, toggleOfflineMode, queueCount } = useOffline();

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
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
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
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
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

          {/* Controls: Offline Simulation, Judge Guide & User */}
          <div className="flex items-center space-x-2.5">
            {/* Step 7: Offline Simulation Toggle Button */}
            <button
              onClick={() => toggleOfflineMode()}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isOffline
                  ? 'bg-orange-50 border-orange-300 text-orange-800 shadow-xs'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
              title={isOffline ? 'Switch back to online cloud' : 'Simulate remote cluster offline mode'}
            >
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-orange-600 animate-pulse" />
                  <span className="hidden md:inline">Offline Mode</span>
                  {queueCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-orange-200 text-orange-900 rounded-full font-bold text-[10px]">
                      {queueCount}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">Online Sync</span>
                  {queueCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full font-bold text-[10px]">
                      {queueCount}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* SIH Judge Demo Guide Button */}
            <button
              onClick={onOpenGuide}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Demo Guide</span>
            </button>

            {/* Single Account Badge */}
            <div className="hidden lg:flex items-center space-x-2 bg-slate-50 border border-slate-200 py-1 px-3 rounded-full text-xs text-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-medium truncate max-w-[100px]">{user?.name || 'Artisan'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
