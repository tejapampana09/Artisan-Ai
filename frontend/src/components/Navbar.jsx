import React from 'react';
import { Store, ShoppingBag, CheckCircle2, AlertCircle, Sparkles, UserCheck, Wifi, WifiOff, Award, Home } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

export default function Navbar({ activeMode, onToggleMode, user, readyStatus, onOpenAuth }) {
  const { isOffline, toggleOfflineMode, queueCount } = useOffline();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title (Clickable to Home or Studio/Marketplace depending on auth) */}
          <div 
            onClick={() => onToggleMode(!user ? 'HOME' : user.role === 'BUYER' ? 'BUY' : 'SELL')}
            className="flex items-center space-x-3 cursor-pointer group"
            title={!user ? "Return to Home / Entry Page" : user.role === 'BUYER' ? "Go to Marketplace" : "Go to Artisan Studio"}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xl tracking-tight text-slate-900 group-hover:text-amber-800 transition-colors">Artisan AI</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 border border-amber-500/30">
                  Enterprise SaaS
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Rural Craft Commerce & Intelligence Platform</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 shadow-inner">
              {!user && (
                <button
                  id="home-mode-toggle"
                  onClick={() => onToggleMode('HOME')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    activeMode === 'HOME'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Home className="w-3.5 h-3.5 text-amber-600" />
                  <span>Home</span>
                </button>
              )}
              {user?.role !== 'BUYER' && (
                <button
                  id="sell-mode-toggle"
                  onClick={() => onToggleMode('SELL')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    activeMode === 'SELL'
                      ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Artisan Studio</span>
                </button>
              )}
              <button
                id="buy-mode-toggle"
                onClick={() => onToggleMode('BUY')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeMode === 'BUY'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Buyer Marketplace</span>
              </button>
            </div>
          </div>

          {/* Controls: Cloud Sync & Account */}
          <div className="flex items-center space-x-2.5">
            {/* Real Rural Offline Resilience Indicator & Sync Control */}
            <button
              onClick={() => toggleOfflineMode()}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isOffline
                  ? 'bg-orange-50 border-orange-300 text-orange-800 shadow-xs'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
              title={isOffline ? 'Switch to online cloud sync' : 'Switch to rural offline cache'}
            >
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-orange-600 animate-pulse" />
                  <span className="hidden md:inline">Offline Cache</span>
                  {queueCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-orange-200 text-orange-900 rounded-full font-bold text-[10px]">
                      {queueCount}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">Cloud Synced</span>
                  {queueCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full font-bold text-[10px]">
                      {queueCount}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Account Badge & Auth Trigger */}
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-2 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 py-1.5 px-3 rounded-full text-xs text-slate-700 transition-all cursor-pointer shadow-2xs"
              title="Manage Account / Sign In"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-semibold truncate max-w-[110px]">{user?.name || 'Sign In'}</span>
              <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-full font-bold uppercase">
                {user?.role || 'PRO'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
