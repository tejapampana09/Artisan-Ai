import React, { useState, useEffect } from 'react';
import { 
  Store, ShoppingBag, Home, Bell, Globe, Smartphone, UserCheck, Wifi, WifiOff, LogOut, Check
} from 'lucide-react';
import { useOffline } from '../context/OfflineContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';
import { 
  triggerMobilePush, 
  requestNotificationPermission, 
  getNotificationPermissionStatus 
} from '../services/mobileNotifications';
import { getNotifications, markNotificationRead } from '../api/index.js';

export default function Navbar({ activeMode, onToggleMode, user, onOpenAuth, onOpenDownloadApp }) {
  const { language, setIsSelectingLanguage, t } = useLanguage();
  const { isOffline, toggleOfflineMode, queueCount } = useOffline();
  const toast = useNotification();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pushStatus, setPushStatus] = useState(getNotificationPermissionStatus());

  const getSeenNotifIds = () => {
    try {
      const stored = sessionStorage.getItem('artisan_seen_notif_ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const saveSeenNotifId = (id) => {
    try {
      const current = getSeenNotifIds();
      current.add(id);
      sessionStorage.setItem('artisan_seen_notif_ids', JSON.stringify(Array.from(current)));
    } catch {
      // Ignore
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);

      const seenIds = getSeenNotifIds();
      data.forEach(n => {
        if (!n.is_read && !seenIds.has(n.id)) {
          saveSeenNotifId(n.id);
          triggerMobilePush(
            n.title || "Artisan AI Notification",
            n.message || "You have a new update.",
            { notificationId: n.id, type: n.type || "INFO" }
          );
          if (toast && toast.info) {
            toast.info(`${n.title}: ${n.message}`);
          }
        }
      });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 4000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleEnableMobilePush = async () => {
    const granted = await requestNotificationPermission();
    setPushStatus(getNotificationPermissionStatus());
    if (granted) {
      triggerMobilePush('🔔 Mobile Notifications Enabled!', 'You will now receive instant push alerts.');
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
      {/* Top Header Bar */}
      <header className="bg-white border-b border-[#E7E7E2] sticky top-0 z-40 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Brand Logo & Title */}
            <div 
              onClick={() => onToggleMode(!user ? 'HOME' : user.role === 'BUYER' ? 'BUY' : 'SELL')}
              className="flex items-center space-x-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#176B4D]/10 flex items-center justify-center p-1.5 border border-[#176B4D]/20">
                <img src="/artisan-logo.png" alt="Artisan AI Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="font-bold text-lg text-[#171717] tracking-tight group-hover:text-[#176B4D] transition-colors">
                  Artisan AI
                </span>
                <span className="ml-2 text-[10px] font-semibold text-[#176B4D] bg-[#176B4D]/10 border border-[#176B4D]/20 px-2 py-0.5 rounded-full">
                  Craft Studio
                </span>
              </div>
            </div>

            {/* Navigation Tabs (Seller View Mode Switchers) */}
            <div className="hidden md:flex items-center space-x-1">
              {!user && (
                <button
                  onClick={() => onToggleMode('HOME')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeMode === 'HOME'
                      ? 'bg-[#176B4D] text-white shadow-sm'
                      : 'text-[#666666] hover:text-[#171717] hover:bg-[#FAFAF7]'
                  }`}
                >
                  Home
                </button>
              )}
              {user?.role !== 'BUYER' && (
                <button
                  onClick={() => onToggleMode('SELL')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeMode === 'SELL'
                      ? 'bg-[#176B4D] text-white shadow-sm'
                      : 'text-[#666666] hover:text-[#171717] hover:bg-[#FAFAF7]'
                  }`}
                >
                  Artisan Studio
                </button>
              )}
              <button
                onClick={() => onToggleMode('BUY')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeMode === 'BUY'
                    ? 'bg-[#176B4D] text-white shadow-sm'
                    : 'text-[#666666] hover:text-[#171717] hover:bg-[#FAFAF7]'
                }`}
              >
                Buyer Marketplace
              </button>
            </div>

            {/* Right Action Icons & User Account */}
            <div className="flex items-center space-x-3">
              {/* Language Selector */}
              <button
                onClick={() => setIsSelectingLanguage(true)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#FAFAF7] border border-[#E7E7E2] text-[#171717] font-semibold text-xs hover:border-[#176B4D]/40 transition-all"
                title="Change Language"
              >
                <Globe className="w-3.5 h-3.5 text-[#176B4D]" />
                <span className="uppercase text-[11px] font-bold">{language}</span>
              </button>

              {/* Offline / Cloud Status Badge */}
              <button
                onClick={() => toggleOfflineMode()}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isOffline
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                {isOffline ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                    <span>Offline</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Cloud</span>
                  </>
                )}
              </button>

              {/* Notifications Bell */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-xl bg-[#FAFAF7] border border-[#E7E7E2] hover:border-[#176B4D]/40 text-[#171717] transition-all relative"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4 text-[#171717]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#176B4D] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Panel */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#E7E7E2] z-50 overflow-hidden text-xs">
                      <div className="p-3 bg-[#FAFAF7] border-b border-[#E7E7E2] flex items-center justify-between">
                        <span className="font-bold text-[#171717] flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-[#176B4D]" />
                          Notifications
                        </span>
                        <span className="text-[10px] bg-[#176B4D]/10 text-[#176B4D] px-2 py-0.5 rounded-full font-bold">
                          {unreadCount} unread
                        </span>
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-[#E7E7E2]">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-[#666666] text-xs">
                            No new notifications.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`p-3 space-y-1 transition-colors ${
                                n.is_read ? 'bg-white opacity-70' : 'bg-emerald-50/40'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#171717] text-xs">{n.title}</span>
                                {!n.is_read && (
                                  <button
                                    onClick={() => handleMarkRead(n.id)}
                                    className="text-[10px] text-[#176B4D] hover:underline font-semibold"
                                  >
                                    Mark read
                                  </button>
                                )}
                              </div>
                              <p className="text-[#666666] text-[11px] leading-snug">{n.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Account / Sign In Button */}
              <button
                onClick={onOpenAuth}
                className="flex items-center space-x-2 bg-[#FAFAF7] hover:bg-emerald-50 border border-[#E7E7E2] hover:border-[#176B4D]/40 py-1.5 px-3.5 rounded-xl text-xs text-[#171717] transition-all font-semibold"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#176B4D]" />
                <span className="truncate max-w-[100px]">{user?.name || 'Sign In'}</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Responsive Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-3 left-4 right-4 z-50 bg-white/90 backdrop-blur-md text-[#171717] rounded-2xl p-2 shadow-lg border border-[#E7E7E2] flex items-center justify-around">
        {!user && (
          <button
            onClick={() => onToggleMode('HOME')}
            className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-xl text-xs font-semibold ${
              activeMode === 'HOME' ? 'bg-[#176B4D] text-white' : 'text-[#666666]'
            }`}
          >
            <Home className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Home</span>
          </button>
        )}

        {user?.role !== 'BUYER' && (
          <button
            onClick={() => onToggleMode('SELL')}
            className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-xl text-xs font-semibold ${
              activeMode === 'SELL' ? 'bg-[#176B4D] text-white' : 'text-[#666666]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Studio</span>
          </button>
        )}

        <button
          onClick={() => onToggleMode('BUY')}
          className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-xl text-xs font-semibold ${
            activeMode === 'BUY' ? 'bg-[#176B4D] text-white' : 'text-[#666666]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Market</span>
        </button>

        <button
          onClick={() => setIsSelectingLanguage(true)}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[#666666]"
        >
          <Globe className="w-4 h-4 text-[#176B4D]" />
          <span className="text-[10px] mt-0.5 uppercase">{language}</span>
        </button>
      </nav>
    </>
  );
}
