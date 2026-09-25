import React, { useState, useEffect, useRef } from 'react';
import { 
  Store, ShoppingBag, Sparkles, UserCheck, Wifi, WifiOff, Home, 
  Bell, Globe, User, Smartphone, MoreVertical, Package, Heart, 
  MessageSquare, BookOpen, Users, LogOut, ArrowRight, Search, X, Loader2,
  HelpCircle, FileText, Compass, MapPin
} from 'lucide-react';
import { useOffline } from '../context/OfflineContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';
import { 
  triggerMobilePush, 
  requestNotificationPermission, 
  getNotificationPermissionStatus 
} from '../services/mobileNotifications';
import { getNotifications, markNotificationRead, getProducts } from '../api/index.js';

export default function Navbar({ 
  activeMode, 
  onToggleMode, 
  user, 
  readyStatus, 
  onOpenAuth, 
  onOpenDownloadApp,
  searchQuery = '',
  onSearchChange,
  onSelectProduct,
  onLogout
}) {
  const { language, setIsSelectingLanguage, t } = useLanguage();
  const { isOffline, toggleOfflineMode, queueCount } = useOffline();
  const toast = useNotification();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [pushStatus, setPushStatus] = useState(getNotificationPermissionStatus());

  // Functional Navbar Search & Cart States
  const [localQuery, setLocalQuery] = useState(searchQuery || '');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const searchContainerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync cart count from localStorage
  const updateCartCount = () => {
    try {
      const raw = localStorage.getItem('artisan_ai_cart');
      const items = raw ? JSON.parse(raw) : [];
      const totalQty = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      setCartCount(totalQty);
    } catch {
      setCartCount(0);
    }
  };

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (activeMode !== 'HOME') {
      setIsScrolled(true);
      return;
    }
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeMode]);

  useEffect(() => {
    updateCartCount();
    window.addEventListener('artisan_cart_updated', updateCartCount);
    window.addEventListener('storage', updateCartCount);
    return () => {
      window.removeEventListener('artisan_cart_updated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, []);

  // Keep local search input synced with external searchQuery prop
  useEffect(() => {
    setLocalQuery(searchQuery || '');
  }, [searchQuery]);

  // Click outside listener to close search suggestion popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (val) => {
    setLocalQuery(val);
    if (onSearchChange) onSearchChange(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (val.trim().length >= 1) {
      setIsSearching(true);
      setShowSuggestions(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const results = await getProducts({ search: val.trim(), status: 'PUBLISHED' });
          setSearchResults(results.slice(0, 6)); // Top 6 autocomplete matches
        } catch (err) {
          console.error('Navbar search error:', err);
        } finally {
          setIsSearching(false);
        }
      }, 250);
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setShowSuggestions(false);
    setIsMobileSearchOpen(false);
    if (onSearchChange) onSearchChange(localQuery.trim());
    if (activeMode !== 'BUY') {
      onToggleMode('BUY');
    }
    window.scrollTo(0, 0);
  };

  const handleSelectProductSuggestion = (product) => {
    setShowSuggestions(false);
    setIsMobileSearchOpen(false);
    if (activeMode !== 'BUY') {
      onToggleMode('BUY');
    }
    if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  const handleClearSearch = () => {
    setLocalQuery('');
    setSearchResults([]);
    setShowSuggestions(false);
    if (onSearchChange) onSearchChange('');
  };

  const isInitialFetchRef = useRef(true);

  const getSeenNotifIds = () => {
    try {
      const stored = localStorage.getItem('artisan_seen_notif_ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const saveSeenNotifId = (id) => {
    try {
      const current = getSeenNotifIds();
      current.add(id);
      localStorage.setItem('artisan_seen_notif_ids', JSON.stringify(Array.from(current)));
    } catch {
      // Ignore storage errors
    }
  };

  const saveAllSeenNotifIds = (ids) => {
    try {
      const current = getSeenNotifIds();
      ids.forEach(id => current.add(id));
      localStorage.setItem('artisan_seen_notif_ids', JSON.stringify(Array.from(current)));
    } catch {
      // Ignore storage errors
    }
  };

  const fetchNotifications = async () => {
    try {
      const domain = user?.role === 'ARTISAN' ? 'STUDIO' : (user?.role === 'ADMIN' ? 'ADMIN' : 'MARKETPLACE');
      const data = await getNotifications(domain);
      setNotifications(data);

      const seenIds = getSeenNotifIds();

      // On initial app load/open:
      // Show unread notifications from the last 15 minutes that haven't been seen yet,
      // and suppress older historic notifications so we don't spam.
      if (isInitialFetchRef.current) {
        isInitialFetchRef.current = false;
        const recentThreshold = Date.now() - 15 * 60 * 1000;
        data.forEach(n => {
          const createdAtMs = n.created_at ? new Date(n.created_at).getTime() : 0;
          if (!n.is_read && !seenIds.has(n.id) && createdAtMs > recentThreshold) {
            saveSeenNotifId(n.id);
            triggerMobilePush(n.title, n.message);
            toast.info(`${n.title}: ${n.message}`, 6000);
          } else {
            saveSeenNotifId(n.id);
          }
        });
        return;
      }

      // On subsequent polling intervals, detect NEWLY arrived notifications in real time
      data.forEach(n => {
        if (!n.is_read && !seenIds.has(n.id)) {
          saveSeenNotifId(n.id);
          triggerMobilePush(n.title, n.message);
          toast.info(`${n.title}: ${n.message}`, 6000);
        } else {
          saveSeenNotifId(n.id);
        }
      });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    if (user) {
      isInitialFetchRef.current = true;
      fetchNotifications();

      // High-frequency polling (3.5s) for instant real-time updates
      const interval = setInterval(fetchNotifications, 3500);

      // Instant push on local actions across components
      const handleInstantRefresh = () => fetchNotifications();
      window.addEventListener('artisan_notification_refresh', handleInstantRefresh);

      return () => {
        clearInterval(interval);
        window.removeEventListener('artisan_notification_refresh', handleInstantRefresh);
      };
    }
  }, [user]);

  const handleEnableMobilePush = async () => {
    const granted = await requestNotificationPermission();
    const status = getNotificationPermissionStatus();
    setPushStatus(status);
    if (granted) {
      toast.success('Mobile notifications enabled! / మొబైల్ నోటిఫికేషన్లు యాక్టివ్ అయ్యాయి');
      triggerMobilePush('🔔 Mobile Notifications Active!', 'You will now receive instant push alerts for orders, enquiries, and price updates.');
    } else if (status === 'denied') {
      toast.warning('Push notifications blocked in browser settings. Please allow notifications for this site.');
    }
  };

  const handleTestNotification = () => {
    triggerMobilePush('🔔 Test Alert / టెస్ట్ నోటిఫికేషన్', 'Real-time mobile alerts and chimes are working perfectly!');
    toast.success('Test notification sent with chime & vibration!');
  };

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadList = notifications.filter(n => !n.is_read);
      await Promise.all(unreadList.map(n => markNotificationRead(n.id)));
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const isOverCarousel = activeMode === 'HOME' && !isScrolled;

  return (
    <>
      {/* Top Mobile Push Notification Banner Prompt */}
      {user && pushStatus === 'default' && (
        <div className="bg-slate-900 text-white px-3 py-2 text-xs flex items-center justify-between border-b border-amber-500/40 shadow-sm z-50">
          <div className="flex items-center space-x-2 overflow-hidden">
            <Smartphone className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
            <span className="truncate">
              <strong>🔔 Enable Mobile Alerts / మొబైల్ నోటిఫికేషన్లు:</strong> Get instant push alerts for orders & enquiries.
            </span>
          </div>
          <button
            onClick={handleEnableMobilePush}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs transition-all cursor-pointer shrink-0 ml-2 shadow-sm"
          >
            Enable Now / అనుమతించండి
          </button>
        </div>
      )}

      {/* Top Header - Overlaid transparently on carousel in HOME mode; solid on scroll and on other pages */}
      <header className={`w-full h-[64px] flex items-center transition-all duration-300 z-40 ${
        activeMode === 'HOME'
          ? (isScrolled 
              ? 'fixed top-0 left-0 right-0 bg-[#FAF7F2]/95 backdrop-blur-md shadow-2xs border-b border-[#E8E2D9] text-[#1C1C1C]' 
              : 'fixed top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/35 to-transparent text-white border-b-0')
          : 'sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8E2D9] text-[#1C1C1C] shadow-2xs'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex justify-between items-center gap-4">
          {/* Brand Logo & Name */}
          <div 
            onClick={() => onToggleMode(!user ? 'HOME' : user.role === 'BUYER' ? 'BUY' : 'SELL')}
            className="flex items-center space-x-2.5 cursor-pointer group shrink-0"
            title={!user ? "Return to Home" : user.role === 'BUYER' ? "Go to Marketplace" : "Go to Artisan Studio"}
          >
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img src="/artisan-logo.png" alt="Artisan AI Logo" className="w-full h-full object-contain" />
            </div>
            <span className={`font-extrabold text-xl tracking-tight transition-colors ${
              isOverCarousel ? 'text-white drop-shadow-sm' : 'text-[#1C1C1C] group-hover:text-[#A6533B]'
            }`}>
              ARTISAN AI
            </span>
          </div>

          {/* Desktop Center Header Navigation / Search Bar */}
          {activeMode === 'ADMIN' ? (
            <div className="hidden sm:flex items-center space-x-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#A6533B] bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full shadow-2xs">
                🛡️ Platform Admin Console
              </span>
            </div>
          ) : activeMode === 'HOME' ? (
            <div className="hidden sm:flex items-center space-x-2">
              <button
                onClick={() => onToggleMode('CRAFT_MAP')}
                className={`flex items-center space-x-1.5 text-xs sm:text-sm font-bold transition-all cursor-pointer px-3.5 py-1.5 rounded-lg shadow-2xs ${
                  isOverCarousel 
                    ? 'bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md' 
                    : 'bg-white hover:bg-stone-50 text-[#1C1C1C] hover:text-[#A6533B] border border-[#E8E2D9] hover:border-[#A6533B]'
                }`}
              >
                <Compass className={`w-4 h-4 ${isOverCarousel ? 'text-amber-300' : 'text-[#A6533B]'}`} />
                <span>Craft Map</span>
              </button>
              <button
                onClick={() => onToggleMode('BUY')}
                className={`flex items-center space-x-2 text-xs sm:text-sm font-bold transition-all cursor-pointer px-4 py-1.5 rounded-lg shadow-2xs ${
                  isOverCarousel 
                    ? 'bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md' 
                    : 'bg-white hover:bg-stone-50 text-[#1C1C1C] hover:text-[#A6533B] border border-[#E8E2D9] hover:border-[#A6533B]'
                }`}
              >
                <ShoppingBag className={`w-4 h-4 ${isOverCarousel ? 'text-amber-300' : 'text-[#A6533B]'}`} />
                <span>Shop</span>
              </button>
            </div>
          ) : (
            <div ref={searchContainerRef} className="flex-1 max-w-md hidden sm:block relative">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={localQuery}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    if (localQuery.trim().length >= 1) setShowSuggestions(true);
                  }}
                  placeholder="Search products by title, craft, material..."
                  className="w-full bg-white text-[#1C1C1C] text-xs pl-9 pr-8 py-2 rounded-lg border border-[#E8E2D9] focus:outline-none focus:border-[#A6533B] focus:ring-1 focus:ring-[#A6533B] transition-all shadow-xs"
                />
                {localQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 text-[#6B6B6B] hover:text-[#1C1C1C] p-1 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Live Autocomplete Suggestions Dropdown */}
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#E8E2D9] rounded-xl shadow-2xl z-50 overflow-hidden text-xs">
                  {isSearching ? (
                    <div className="p-4 text-center text-[#6B6B6B] flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#A6533B]" />
                      <span>Searching crafts...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="divide-y divide-[#E8E2D9] max-h-80 overflow-y-auto">
                      <div className="px-3 py-1.5 bg-[#FAF7F2] text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B]">
                        Matching Crafts ({searchResults.length})
                      </div>
                      {searchResults.map((p) => (
                        <div
                          key={`nav-search-${p.id}`}
                          onClick={() => handleSelectProductSuggestion(p)}
                          className="p-2.5 hover:bg-stone-50 flex items-center space-x-3 cursor-pointer transition-colors"
                        >
                          <img
                            src={p.image_url}
                            alt={p.title}
                            className="w-10 h-10 rounded-lg object-cover bg-stone-100 shrink-0 border border-[#E8E2D9]"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-[#1C1C1C] truncate text-xs">{p.title}</h4>
                            <p className="text-[10px] text-[#6B6B6B] truncate">{p.category} • {p.artisan_name || 'Handcrafted'}</p>
                          </div>
                          <span className="font-extrabold text-[#A6533B] text-xs shrink-0">
                            ₹{p.price?.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                      <button
                        onClick={handleSearchSubmit}
                        className="w-full p-2.5 text-center text-[#A6533B] font-bold hover:bg-amber-50 text-xs transition-colors border-t border-[#E8E2D9] cursor-pointer"
                      >
                        View all results for "{localQuery}" →
                      </button>
                    </div>
                  ) : localQuery.trim().length >= 1 ? (
                    <div className="p-4 text-center text-[#6B6B6B]">
                      <p className="font-medium text-xs">No matching crafts found for "{localQuery}"</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">Try searching by craft type (e.g. Kalamkari, Pottery, Ikat)</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Right Action Icons (Seller Login, Search, Language, Notifications, Cart & Profile) */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile Seller Login (ONLY shown for unauthenticated guests, hidden once logged in) */}
            {!user && (
              <button
                onClick={() => onOpenAuth('SELL_LOGIN')}
                className="md:hidden flex items-center space-x-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-700 to-[#A6533B] text-white text-[11px] font-bold shadow-xs active:scale-95 cursor-pointer shrink-0"
                title="Seller Login / సెల్లర్ లాగిన్"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Seller Login</span>
              </button>
            )}

            {activeMode !== 'HOME' && activeMode !== 'ADMIN' && (
              <button
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                className="sm:hidden p-1.5 text-[#1C1C1C] hover:text-[#A6533B] transition-colors cursor-pointer"
                title="Search Marketplace"
              >
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* Language Switcher */}
            <button
              onClick={() => setIsSelectingLanguage(true)}
              className={`p-1.5 transition-colors cursor-pointer flex items-center space-x-1 font-bold text-xs ${
                isOverCarousel ? 'text-white hover:text-amber-300' : 'text-[#1C1C1C] hover:text-[#A6533B]'
              }`}
              title="Change Language / భాషను మార్చుకోండి"
            >
              <Globe className={`w-5 h-5 ${isOverCarousel ? 'text-amber-300' : 'text-[#A6533B]'}`} />
              <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                isOverCarousel ? 'bg-white/20 text-white border-white/30 backdrop-blur-md' : 'bg-[#F4EBE1] text-[#933D1E] border-[#EADFCF]'
              }`}>
                {language === 'te' ? 'తెలుగు' : language === 'hi' ? 'हिन्दी' : language === 'ta' ? 'தமிழ்' : language === 'bn' ? 'বাংলা' : 'EN'}
              </span>
            </button>

            {/* Notifications Bell - Hidden in Admin Console */}
            {user && activeMode !== 'ADMIN' && (
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-1.5 transition-colors cursor-pointer relative ${
                  isOverCarousel ? 'text-white hover:text-amber-300' : 'text-[#1C1C1C] hover:text-[#A6533B]'
                }`}
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Shopping Bag / Cart - Hidden in Admin Console */}
            {activeMode !== 'ADMIN' && (
              <button
                onClick={() => onOpenAuth('CART')}
                className={`p-1.5 transition-colors cursor-pointer relative ${
                  isOverCarousel ? 'text-white hover:text-amber-300' : 'text-[#1C1C1C] hover:text-[#A6533B]'
                }`}
                title="View Shopping Bag"
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#A6533B] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-50">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </button>
            )}

            {/* Craft Map Quick Action (Hidden in Admin Console) */}
            {activeMode !== 'ADMIN' && (
              <button
                onClick={() => onToggleMode('CRAFT_MAP')}
                className={`p-1.5 transition-colors cursor-pointer relative ${
                  activeMode === 'CRAFT_MAP'
                    ? 'text-[#A6533B]'
                    : isOverCarousel ? 'text-white hover:text-amber-300' : 'text-[#1C1C1C] hover:text-[#A6533B]'
                }`}
                title="🗺️ Craft Clusters Map of India"
              >
                <Compass className="w-5 h-5" />
              </button>
            )}

            {/* Profile for standard users (Hidden in Admin Console) */}
            {activeMode !== 'ADMIN' && (
              <button
                onClick={() => onOpenAuth('PROFILE')}
                className={`p-1.5 transition-colors cursor-pointer ${
                  activeMode === 'PROFILE'
                    ? 'text-[#A6533B]'
                    : isOverCarousel ? 'text-white hover:text-amber-300' : 'text-[#1C1C1C] hover:text-[#A6533B]'
                }`}
                title="Account Settings"
              >
                <User className="w-5 h-5" />
              </button>
            )}

            {/* More Menu Toggle */}
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`p-1.5 transition-colors cursor-pointer ${
                showMoreMenu
                  ? 'text-[#A6533B]'
                  : isOverCarousel ? 'text-white hover:text-amber-300' : 'text-[#1C1C1C] hover:text-[#A6533B]'
              }`}
              title="More Options / మెనూ"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Expandable Mobile Search Bar */}
      {isMobileSearchOpen && activeMode !== 'HOME' && (
        <div className="sm:hidden px-4 pb-3 pt-1 bg-[#FAF7F2] border-b border-[#E8E2D9] z-40">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={localQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search products by title, craft, material..."
              autoFocus
              className="w-full bg-white text-[#1C1C1C] text-xs pl-9 pr-8 py-2 rounded-lg border border-[#E8E2D9] focus:outline-none focus:border-[#A6533B] shadow-xs"
            />
            {localQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 text-[#6B6B6B] hover:text-[#1C1C1C] p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Notifications Popover Modal */}
      {showNotifications && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-xs" 
            onClick={() => setShowNotifications(false)} 
          />
          <div className="fixed top-16 right-3 sm:right-6 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-[#EADFCF] z-55 overflow-hidden text-xs">
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button 
                  onClick={() => setShowNotifications(false)} 
                  className="text-[#9E8E83] hover:text-white text-base font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Real-time Push Notification Status & Test Control */}
            <div className="px-3.5 py-2 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${pushStatus === 'granted' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="font-semibold text-stone-700">
                  {pushStatus === 'granted' ? 'Mobile Alerts: Active' : 'Mobile Alerts: Not enabled'}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                {pushStatus !== 'granted' ? (
                  <button
                    onClick={handleEnableMobilePush}
                    className="px-2 py-0.5 rounded-md bg-[#A6533B] text-white font-bold text-[10px] hover:bg-[#88412F] cursor-pointer"
                  >
                    Enable
                  </button>
                ) : (
                  <button
                    onClick={handleTestNotification}
                    className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] hover:bg-amber-200 cursor-pointer"
                    title="Send test alert to mobile phone"
                  >
                    Test Alert
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-[#6B5B51]">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={`p-3 transition-colors ${n.is_read ? 'bg-white text-[#6B5B51]' : 'bg-amber-50/50 text-[#2A1E17] font-medium'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-[#2A1E17] text-xs">{n.title}</h4>
                        <p className="text-[#6B5B51] text-xs mt-0.5 leading-relaxed">{n.message}</p>
                        {n.created_at && (
                          <span className="text-[10px] text-[#9E8E83] mt-1 block">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-[10px] font-semibold text-[#933D1E] bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-md shrink-0 cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Three Dots Overflow Menu Popover */}
      {showMoreMenu && (
        <>
          <div 
            className="fixed inset-0 z-[9990] bg-slate-900/30 backdrop-blur-xs" 
            onClick={() => setShowMoreMenu(false)} 
          />
          <div className="fixed top-16 right-3 sm:right-6 w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-[#E8E2D9] z-[9999] overflow-hidden font-sans p-3 space-y-3 text-xs text-[#1C1C1C]">
            {/* Account Info Header */}
            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8E2D9] flex items-center justify-between">
              {user ? (
                <div 
                  onClick={() => { setShowMoreMenu(false); onOpenAuth('PROFILE'); }}
                  className="flex items-center space-x-3 overflow-hidden cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-full bg-[#A6533B] text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-sm text-[#1C1C1C] truncate group-hover:text-[#A6533B] transition-colors">{user.name}</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-[#A6533B] border border-amber-300">
                        {user.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B6B6B] truncate">{user.email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="font-bold text-sm text-[#1C1C1C]">Artisan AI Marketplace</p>
                    <p className="text-[11px] text-[#6B6B6B]">Sign in to access orders & studio</p>
                  </div>
                  <button
                    onClick={() => { setShowMoreMenu(false); onOpenAuth('LOGIN'); }}
                    className="bg-[#1C1C1C] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#A6533B] transition-colors cursor-pointer shrink-0"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>

            {/* Quick Action Grid */}
            {user && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] px-1">
                  My Account & Purchases
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => { setShowMoreMenu(false); onOpenAuth('ORDERS'); }}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9] hover:border-[#A6533B] hover:text-[#A6533B] font-medium transition-all cursor-pointer text-left"
                  >
                    <Package className="w-4 h-4 text-[#A6533B]" />
                    <span className="truncate">My Orders</span>
                  </button>
                  <button
                    onClick={() => { setShowMoreMenu(false); onOpenAuth('WISHLIST'); }}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9] hover:border-[#A6533B] hover:text-[#A6533B] font-medium transition-all cursor-pointer text-left"
                  >
                    <Heart className="w-4 h-4 text-[#A6533B]" />
                    <span className="truncate">Wishlist</span>
                  </button>
                  <button
                    onClick={() => { setShowMoreMenu(false); onOpenAuth('ENQUIRIES'); }}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9] hover:border-[#A6533B] hover:text-[#A6533B] font-medium transition-all cursor-pointer text-left"
                  >
                    <MessageSquare className="w-4 h-4 text-[#A6533B]" />
                    <span className="truncate">Enquiries</span>
                  </button>
                  <button
                    onClick={() => { setShowMoreMenu(false); onOpenAuth('PROFILE'); }}
                    className="flex items-center space-x-2 p-2 rounded-lg bg-[#FAF7F2] border border-[#E8E2D9] hover:border-[#A6533B] hover:text-[#A6533B] font-medium transition-all cursor-pointer text-left"
                  >
                    <User className="w-4 h-4 text-[#A6533B]" />
                    <span className="truncate">Profile</span>
                  </button>
                </div>
              </div>
            )}

            {/* Website Navigation */}
            <div className="space-y-1 border-t border-[#E8E2D9] pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] px-1">
                Explore Platform
              </p>
              <button
                onClick={() => { setShowMoreMenu(false); onToggleMode('CRAFT_MAP'); }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF7F2] font-medium text-[#1C1C1C] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2">
                  <Compass className="w-4 h-4 text-[#A6533B]" />
                  <span className="font-bold text-[#A6533B]">🗺️ Heritage Craft Map</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#A6533B]" />
              </button>

              <button
                onClick={() => { setShowMoreMenu(false); onToggleMode('BUY'); }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF7F2] font-medium text-[#1C1C1C] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-4 h-4 text-[#6B6B6B]" />
                  <span>Shop Marketplace</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#6B6B6B]" />
              </button>

              <button
                onClick={() => { setShowMoreMenu(false); onToggleMode('STORY'); }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF7F2] font-medium text-[#1C1C1C] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-[#6B6B6B]" />
                  <span>Our Story & Purpose</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#6B6B6B]" />
              </button>

              <button
                onClick={() => { setShowMoreMenu(false); onToggleMode('BECOME_ARTISAN'); }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF7F2] font-medium text-[#1C1C1C] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#A6533B]" />
                  <span>Become an Artisan (Guide)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#6B6B6B]" />
              </button>

              {/* Artisan Studio Access / Login */}
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  if (!user || user?.role === 'BUYER') {
                    onOpenAuth('SELL_LOGIN');
                  } else {
                    onToggleMode('SELL');
                  }
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/80 text-[#A6533B] font-bold transition-all hover:bg-amber-100 cursor-pointer text-left shadow-xs"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#A6533B] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#1C1C1C]">
                      {user?.role === 'ARTISAN' || user?.role === 'ADMIN' ? 'Artisan Studio' : 'Artisan Studio Login'}
                    </span>
                    <span className="block text-[10px] text-[#A6533B] font-medium">సెల్లర్ పోర్టల్ & AI ప్రైసింగ్</span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase bg-[#A6533B] text-white px-2.5 py-0.5 rounded-full">
                  {user?.role === 'ARTISAN' || user?.role === 'ADMIN' ? 'Open' : 'Sell'}
                </span>
              </button>
            </div>

            {/* App Settings */}
            <div className="space-y-1 border-t border-[#E8E2D9] pt-2">
              <button
                onClick={() => { setShowMoreMenu(false); setIsSelectingLanguage(true); }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF7F2] font-medium text-[#1C1C1C] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-[#6B6B6B]" />
                  <span>Language ({language.toUpperCase()})</span>
                </div>
                <span className="text-[10px] font-semibold uppercase text-[#A6533B]">Change</span>
              </button>

              <button
                onClick={() => { setShowMoreMenu(false); toggleOfflineMode(); }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF7F2] font-medium text-[#1C1C1C] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2">
                  {isOffline ? <WifiOff className="w-4 h-4 text-orange-600" /> : <Wifi className="w-4 h-4 text-emerald-600" />}
                  <span>Network Mode</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOffline ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {isOffline ? 'Offline' : 'Cloud'}
                </span>
              </button>

              <button
                onClick={() => { setShowMoreMenu(false); onOpenDownloadApp(); }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF7F2] font-medium text-[#1C1C1C] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-[#6B6B6B]" />
                  <span>Download Mobile App</span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">PWA</span>
              </button>
            </div>

            {/* Help & Policies */}
            <div className="space-y-1 border-t border-[#E8E2D9] pt-2">
              <button
                onClick={() => { setShowMoreMenu(false); onToggleMode('CONTACT'); }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF7F2] font-medium text-[#1C1C1C] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-[#6B6B6B]" />
                  <span>Contact Us & Help</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#6B6B6B]" />
              </button>

              <button
                onClick={() => { setShowMoreMenu(false); onToggleMode('TERMS'); }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF7F2] font-medium text-[#1C1C1C] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-[#6B6B6B]" />
                  <span>Terms & Policies</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#6B6B6B]" />
              </button>
            </div>

            {user && (
              <div className="border-t border-[#E8E2D9] pt-2">
                <button
                  onClick={() => { setShowMoreMenu(false); onOpenAuth(); }}
                  className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Manage Account / Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Flipkart / Myntra Style Fixed Native Mobile Bottom Navigation Bar with Raised Studio Action */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[99] bg-white text-stone-800 border-t border-[#E8E2D9] py-1.5 px-3 shadow-2xl flex items-end justify-between">
        <button
          onClick={() => onToggleMode('HOME')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
            activeMode === 'HOME'
              ? 'text-[#A6533B] font-extrabold'
              : 'text-stone-500 hover:text-stone-900 font-semibold'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-bold">Home</span>
        </button>

        <button
          onClick={() => onToggleMode('BUY')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
            activeMode === 'BUY'
              ? 'text-[#A6533B] font-extrabold'
              : 'text-stone-500 hover:text-stone-900 font-semibold'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-bold">Shop</span>
        </button>

        {/* Center Action: Studio button ONLY AFTER artisan/admin login; Wishlist for guests/buyers */}
        {user && (user.role === 'ARTISAN' || user.role === 'ADMIN') ? (
          <button
            onClick={() => onToggleMode('SELL')}
            className={`relative -top-3 flex flex-col items-center justify-center px-3.5 py-1.5 rounded-2xl shadow-xl transition-all active:scale-95 cursor-pointer border-2 ${
              activeMode === 'SELL'
                ? 'bg-gradient-to-tr from-[#933D1E] to-[#A6533B] text-white border-amber-300 ring-2 ring-amber-400/50 scale-105'
                : 'bg-gradient-to-tr from-amber-800 via-[#A6533B] to-[#2A1E17] text-white border-white ring-1 ring-stone-200'
            }`}
            title="Artisan Studio / సెల్లర్ స్టూడియో"
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
              <Store className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black tracking-tight mt-0.5 text-white">
              Studio
            </span>
          </button>
        ) : (
          <button
            onClick={() => onOpenAuth('WISHLIST')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
              activeMode === 'WISHLIST'
                ? 'text-[#A6533B] font-extrabold'
                : 'text-stone-500 hover:text-stone-900 font-semibold'
            }`}
          >
            <Heart className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-bold">Wishlist</span>
          </button>
        )}

        <button
          onClick={() => onOpenAuth('ORDERS')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
            activeMode === 'ORDERS'
              ? 'text-[#A6533B] font-extrabold'
              : 'text-stone-500 hover:text-stone-900 font-semibold'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-bold">Orders</span>
        </button>

        <button
          onClick={() => onOpenAuth('PROFILE')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
            activeMode === 'PROFILE'
              ? 'text-[#A6533B] font-extrabold'
              : 'text-stone-500 hover:text-stone-900 font-semibold'
          }`}
        >
          <UserCheck className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-bold">Account</span>
        </button>
      </nav>
    </>
  );
}
