import React, { useState, useEffect } from 'react';
import { 
  Store, ShoppingBag, Sparkles, UserCheck, Wifi, WifiOff, Home, 
  Bell, Globe, User, Smartphone
} from 'lucide-react';
import { useOffline } from '../context/OfflineContext';
import { useLanguage } from '../context/LanguageContext';
import { getNotifications, markNotificationRead } from '../api/trust';

export default function Navbar({ activeMode, onToggleMode, user, readyStatus, onOpenAuth, onOpenDownloadApp }) {
  const { language, setIsSelectingLanguage, t } = useLanguage();
  const { isOffline, toggleOfflineMode, queueCount } = useOffline();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 25000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      {/* Top Fixed Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo & Title */}
            <div 
              onClick={() => onToggleMode(!user ? 'HOME' : user.role === 'BUYER' ? 'BUY' : 'SELL')}
              className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group shrink-0"
              title={!user ? "Return to Home" : user.role === 'BUYER' ? "Go to Marketplace" : "Go to Artisan Studio"}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <img src="/artisan-logo.png" alt="Artisan AI Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 group-hover:text-amber-800 transition-colors">Artisan AI</span>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-300 border border-amber-500/30">
                    {t('enterpriseTag', 'Enterprise')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">{t('navbarTitle', 'Artisan AI Marketplace')}</p>
              </div>
            </div>

            {/* Desktop Mode Switcher & Right Controls */}
            <div className="hidden md:flex items-center space-x-2 sm:space-x-3">
              {/* Mode Switcher */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 shadow-inner">
                {!user && (
                  <button
                    onClick={() => onToggleMode('HOME')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      activeMode === 'HOME'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t('home', 'Home')}</span>
                  </button>
                )}
                {user?.role !== 'BUYER' && (
                  <button
                    onClick={() => onToggleMode('SELL')}
                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      activeMode === 'SELL'
                        ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>{t('artisanStudio', 'Artisan Studio')}</span>
                  </button>
                )}
                <button
                  onClick={() => onToggleMode('BUY')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    activeMode === 'BUY'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>{t('buyerMarketplace', 'Buyer Marketplace')}</span>
                </button>
              </div>

              {/* Download App Button */}
              <button
                onClick={onOpenDownloadApp}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                title="Download Artisan AI App / ఆప్‌ని ఇన్స్టాల్ చేయండి"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                <span className="text-[11px] font-bold">{t('appLabel', 'App')}</span>
              </button>

              {/* Language Selector Button */}
              <button
                onClick={() => setIsSelectingLanguage(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-bold text-xs transition-all cursor-pointer"
                title="Change Language / మీ భాషను ఎంచుకోండి"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-700" />
                <span className="uppercase text-[11px] font-extrabold">{language}</span>
              </button>

              {/* Offline Indicator */}
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
                    <span>{t('offline', 'Offline')}</span>
                    {queueCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-orange-200 text-orange-900 rounded-full font-bold text-[10px]">
                        {queueCount}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('cloud', 'Cloud')}</span>
                  </>
                )}
              </button>

              {/* Notifications */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-700 transition-all cursor-pointer relative"
                    title="System Notifications"
                  >
                    <Bell className="w-4 h-4 text-amber-700" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-60 overflow-hidden text-xs">
                      <div className="p-3 bg-amber-50 border-b border-amber-200/60 flex items-center justify-between">
                        <span className="font-bold text-amber-900 flex items-center">
                          <Bell className="w-3.5 h-3.5 mr-1 text-amber-700" />
                          Notifications
                        </span>
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                          {unreadCount} unread
                        </span>
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-xs">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`p-3 space-y-1 transition-colors ${
                                n.is_read ? 'bg-white opacity-70' : 'bg-amber-50/30'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 text-xs">{n.title}</span>
                                {!n.is_read && (
                                  <button
                                    onClick={() => handleMarkRead(n.id)}
                                    className="text-[10px] text-amber-700 hover:underline font-semibold"
                                  >
                                    Mark read
                                  </button>
                                )}
                              </div>
                              <p className="text-slate-600 text-[11px] leading-snug">{n.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Account Badge */}
              <button
                onClick={onOpenAuth}
                className="flex items-center space-x-2 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 py-1.5 px-3 rounded-full text-xs text-slate-700 transition-all cursor-pointer shadow-2xs"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-semibold truncate max-w-[110px]">{user?.name || 'Sign In'}</span>
              </button>
            </div>

            {/* Compact Mobile Top Right Controls */}
            <div className="flex md:hidden items-center space-x-1.5 shrink-0">
              <button
                onClick={onOpenDownloadApp}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-extrabold text-xs cursor-pointer active:scale-95 transition-transform"
                title="Download App"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                <span className="text-[10px] font-bold">App</span>
              </button>

              <button
                onClick={() => setIsSelectingLanguage(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-extrabold text-xs cursor-pointer active:scale-95 transition-transform"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-700" />
                <span className="uppercase text-[10px]">{language}</span>
              </button>

              <button
                onClick={onOpenAuth}
                className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 cursor-pointer active:scale-95 transition-transform"
                title="Account / Sign In"
              >
                <UserCheck className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-50 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl p-1.5 shadow-2xl border border-slate-700/60 flex items-center justify-around">
        {!user && (
          <button
            onClick={() => onToggleMode('HOME')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
              activeMode === 'HOME'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span className="text-[10px] font-semibold mt-0.5">Home</span>
          </button>
        )}

        {user?.role !== 'BUYER' && (
          <button
            onClick={() => onToggleMode('SELL')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
              activeMode === 'SELL'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span className="text-[10px] font-semibold mt-0.5">Studio</span>
          </button>
        )}

        <button
          onClick={() => onToggleMode('BUY')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
            activeMode === 'BUY'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="text-[10px] font-semibold mt-0.5">Market</span>
        </button>

        <button
          onClick={onOpenDownloadApp}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-amber-400 hover:text-amber-300 transition-all cursor-pointer"
        >
          <Smartphone className="w-4 h-4" />
          <span className="text-[10px] font-bold mt-0.5">App</span>
        </button>

        <button
          onClick={() => setIsSelectingLanguage(true)}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-slate-400 hover:text-white transition-all"
        >
          <Globe className="w-4 h-4 text-indigo-400" />
          <span className="text-[10px] font-semibold mt-0.5 uppercase">{language}</span>
        </button>
      </nav>
    </>
  );
}
