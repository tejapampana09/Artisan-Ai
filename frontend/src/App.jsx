import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import SellView from './components/SellView';
import BuyView from './components/BuyView';
import OfflineSyncBanner from './components/OfflineSyncBanner';
import AuthModal from './components/AuthModal';
import NotificationCenter from './components/NotificationCenter';
import SplashScreen from './components/SplashScreen';
import { OfflineProvider, useOffline } from './context/OfflineContext';
import { NotificationProvider } from './context/NotificationContext';
import { checkHealth, checkReady, getCurrentUser, getAuthToken, setAuthToken, clearAuthToken, logoutUser } from './api/index.js';

import { LanguageProvider, useLanguage } from './context/LanguageContext';
import LanguageSelectorModal from './components/LanguageSelectorModal';
import DownloadAppModal from './components/DownloadAppModal';
import { setStoredUser, getStoredUser } from './services/offlineSync';

import OurStoryView from './components/OurStoryView';
import ArtisansView from './components/ArtisansView';
import CollectionsView from './components/CollectionsView';
import OrdersView from './components/OrdersView';
import WishlistView from './components/WishlistView';
import EnquiriesView from './components/EnquiriesView';
import ProfileView from './components/ProfileView';
import CartView from './components/CartView';
import Footer from './components/Footer';
import AdminView from './components/AdminView';
import LegalView from './components/LegalView';
import BecomeArtisanView from './components/BecomeArtisanView';

const roleDomain = (role) => (
  role === 'ARTISAN' ? 'STUDIO' : role === 'ADMIN' ? 'ADMIN' : role === 'BUYER' ? 'BUYER' : null
);

const roleHomeMode = (role) => (
  role === 'ARTISAN' ? 'SELL' : role === 'ADMIN' ? 'ADMIN' : 'BUY'
);

const getInitialModeFromUrl = () => {
  try {
    const hash = window.location.hash.toLowerCase().replace('#', '');
    const path = window.location.pathname.toLowerCase();
    const route = hash || path;
    if (route.includes('privacy')) return 'PRIVACY';
    if (route.includes('terms')) return 'TERMS';
    if (route.includes('refund') || route.includes('cancellation')) return 'REFUND';
    if (route.includes('contact') || route.includes('support')) return 'CONTACT';
    if (route.includes('become-artisan') || route.includes('seller-onboarding') || route.includes('artisan-guide')) return 'BECOME_ARTISAN';
    if (route.includes('story')) return 'STORY';
    if (route.includes('artisans')) return 'ARTISANS';
    if (route.includes('collections')) return 'COLLECTIONS';
    return 'HOME';
  } catch {
    return 'HOME';
  }
};

function AppContent() {
  const [activeMode, setActiveMode] = useState(getInitialModeFromUrl);
  const [user, setUser] = useState(getStoredUser());
  const [readyStatus, setReadyStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem('artisan_splash_seen');
    } catch {
      return false;
    }
  });
  const [splashFading, setSplashFading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState('ORDERS');
  const [isDownloadAppOpen, setIsDownloadAppOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sellerTab, setSellerTab] = useState('DASHBOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductFromSearch, setSelectedProductFromSearch] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeMode, sellerTab]);

  useEffect(() => {
    const handleUrlChange = () => {
      const mode = getInitialModeFromUrl();
      if (mode && mode !== 'HOME') {
        setActiveMode(mode);
      }
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Auto-logout when JWT expires: any 401 from the API fires this event
  useEffect(() => {
    const handleSessionExpired = (e) => {
      setUser(null);
      setActiveMode('HOME');
      setIsAuthOpen(true);
      setAuthInitialTab('LOGIN');
      // Brief toast-like notification so user knows why they were logged out
      console.info('[Artisan AI] Session expired:', e.detail?.message);
    };
    window.addEventListener('artisan:session-expired', handleSessionExpired);
    return () => window.removeEventListener('artisan:session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    if (showSplash) {
      try {
        sessionStorage.setItem('artisan_splash_seen', 'true');
      } catch {}
      // Hard safety timer: dismiss splash screen quickly (max 800ms)
      const timer = setTimeout(() => {
        setSplashFading(true);
        const hide = setTimeout(() => setShowSplash(false), 400);
        return () => clearTimeout(hide);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  const { isOffline } = useOffline();
  const { t } = useLanguage();

  const loadInitialData = async () => {
    try {
      // Non-blocking background health and readiness checks
      checkHealth().catch(() => {});
      checkReady().then(ready => {
        if (ready) setReadyStatus(ready);
      }).catch(() => {});

      const storedUser = getStoredUser();
      const domain = roleDomain(storedUser?.role);
      const token = getAuthToken(domain);
      if (!token) {
        setUser(null);
        return;
      }

      const userData = await getCurrentUser(domain);
      if (userData && !userData.detail && !userData.error) {
        // Migrate any session created before single-role sessions were enforced.
        // Keep only the token that was just verified for this user's role.
        const verifiedDomain = roleDomain(userData.role);
        if (verifiedDomain) {
          clearAuthToken();
          setAuthToken(token, verifiedDomain);
        }
        setUser(userData);
        setStoredUser(userData);

        const publicPages = ['TERMS', 'PRIVACY', 'REFUND', 'CONTACT', 'BECOME_ARTISAN', 'STORY', 'ARTISANS', 'COLLECTIONS'];
        setActiveMode(prev => {
          if (publicPages.includes(prev)) return prev;
          if (userData.role === 'BUYER') return 'BUY';
          if (userData.role === 'ADMIN') return 'ADMIN';
          return 'SELL';
        });
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error('Initial load failed', e);
      setUser(null);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [refreshTrigger]);

  const handleToggleMode = async (newMode) => {
    let targetMode = newMode;
    const role = user?.role;
    if (user && targetMode === 'HOME') {
      targetMode = roleHomeMode(role);
    }

    // Role workspaces are intentionally isolated. Public pages remain
    // navigable, but an authenticated role cannot enter another role's area.
    if (user) {
      const buyerOnlyModes = ['BUY', 'CART', 'ORDERS', 'WISHLIST', 'ENQUIRIES', 'PROFILE'];
      const isWrongWorkspace =
        (targetMode === 'SELL' && role !== 'ARTISAN') ||
        (targetMode === 'ADMIN' && role !== 'ADMIN') ||
        (buyerOnlyModes.includes(targetMode) && role !== 'BUYER');
      if (isWrongWorkspace) {
        targetMode = roleHomeMode(role);
      }
    }
    setActiveMode(targetMode);

    try {
      const modeToHash = {
        'HOME': '',
        'BUY': 'shop',
        'SELL': 'studio',
        'STORY': 'story',
        'ARTISANS': 'artisans',
        'COLLECTIONS': 'collections',
        'TERMS': 'terms',
        'PRIVACY': 'privacy',
        'REFUND': 'refund-cancellation',
        'CONTACT': 'contact',
        'BECOME_ARTISAN': 'become-artisan'
      };
      if (modeToHash[targetMode] !== undefined) {
        const hashVal = modeToHash[targetMode] ? `#${modeToHash[targetMode]}` : '';
        if (!hashVal) {
          window.history.replaceState(null, '', window.location.pathname);
        } else {
          window.history.replaceState(null, '', hashVal);
        }
      }
    } catch {}

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleRefreshAll = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogout = () => {
    logoutUser();
    clearAuthToken();
    setUser(null);
    setStoredUser(null);
    setActiveMode('HOME');
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleOpenAuth = (tabOrMode = 'ORDERS') => {
    const target = typeof tabOrMode === 'string' ? tabOrMode : 'ORDERS';
    if (target === 'CART') {
      setActiveMode('CART');
      return;
    }
    if (user && ['ORDERS', 'WISHLIST', 'ENQUIRIES', 'PROFILE', 'CART'].includes(target)) {
      setActiveMode(target);
    } else {
      setAuthInitialTab(target);
      setIsAuthOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1C1C] flex flex-col font-sans relative overflow-x-hidden">
      {showSplash && <SplashScreen fadeOut={splashFading} />}
      <NotificationCenter />
      <LanguageSelectorModal />
      <DownloadAppModal 
        isOpen={isDownloadAppOpen} 
        onClose={() => setIsDownloadAppOpen(false)} 
      />
      
      {/* Top Navigation - Hidden when in Seller Studio */}
      {activeMode !== 'SELL' && (
        <Navbar
          activeMode={activeMode}
          onToggleMode={handleToggleMode}
          user={user}
          readyStatus={readyStatus}
          onOpenAuth={handleOpenAuth}
          onOpenDownloadApp={() => setIsDownloadAppOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectProduct={(prod) => {
            setSelectedProductFromSearch(prod);
            handleToggleMode('BUY');
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Main Container */}
      <main className={`flex-1 w-full ${activeMode === 'HOME' ? 'p-0 m-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6'} overflow-x-hidden`}>
        <OfflineSyncBanner />

        <div className={activeMode === 'HOME' ? 'w-full p-0 m-0' : ''}>
          {activeMode === 'HOME' ? (
            <LandingPage
              onSelectMode={handleToggleMode}
              onOpenAuth={handleOpenAuth}
              user={user}
            />
          ) : activeMode === 'STORY' ? (
            <OurStoryView
              onSelectMode={handleToggleMode}
              onOpenAuth={handleOpenAuth}
              user={user}
            />
          ) : activeMode === 'ARTISANS' ? (
            <ArtisansView
              user={user}
              onOpenAuth={handleOpenAuth}
              onSelectMode={handleToggleMode}
            />
          ) : activeMode === 'COLLECTIONS' ? (
            <CollectionsView
              onSelectMode={handleToggleMode}
              onOpenAuth={handleOpenAuth}
            />
          ) : activeMode === 'BECOME_ARTISAN' ? (
            <BecomeArtisanView
              user={user}
              onSelectMode={handleToggleMode}
              onOpenAuth={handleOpenAuth}
            />
          ) : ['TERMS', 'PRIVACY', 'REFUND', 'CONTACT'].includes(activeMode) ? (
            <LegalView
              initialTab={activeMode}
              onSelectMode={handleToggleMode}
              onOpenAuth={handleOpenAuth}
            />
          ) : activeMode === 'ORDERS' ? (
            <OrdersView
              user={user}
              onSelectMode={handleToggleMode}
              onOpenAuth={handleOpenAuth}
            />
          ) : activeMode === 'WISHLIST' ? (
            <WishlistView
              user={user}
              onSelectMode={handleToggleMode}
              onOpenAuth={handleOpenAuth}
            />
          ) : activeMode === 'ENQUIRIES' ? (
            <EnquiriesView
              user={user}
              onSelectMode={handleToggleMode}
              onOpenAuth={handleOpenAuth}
            />
          ) : activeMode === 'PROFILE' ? (
            <ProfileView
              user={user}
              onSelectMode={handleToggleMode}
              onAuthChange={setUser}
            />
          ) : activeMode === 'CART' ? (
            <CartView
              user={user}
              onSelectMode={handleToggleMode}
              onOpenAuth={handleOpenAuth}
            />
          ) : activeMode === 'SELL' ? (
            <SellView 
              user={user} 
              onOpenAuth={handleOpenAuth} 
              onSwitchMode={handleToggleMode}
              onAuthChange={setUser}
              onLogout={handleLogout}
              activeSellerTab={sellerTab}
              onSelectSellerTab={setSellerTab}
              key={`sell_${refreshTrigger}`} 
            />
          ) : activeMode === 'ADMIN' ? (
            <AdminView 
              user={user}
              onAuthChange={setUser}
              onSelectMode={handleToggleMode}
              onLogout={handleLogout}
            />
          ) : (
            <BuyView 
              user={user} 
              onOpenAuth={handleOpenAuth} 
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              initialSelectedProduct={selectedProductFromSearch}
              onClearInitialSelectedProduct={() => setSelectedProductFromSearch(null)}
              key={`buy_${refreshTrigger}`} 
            />
          )}
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        initialTab={authInitialTab}
        onAuthChange={(newUser) => {
          setUser(newUser);
          if (!newUser) {
            setActiveMode('HOME');
          } else if (newUser.role === 'BUYER') {
            setActiveMode('BUY');
          } else if (newUser.role === 'ADMIN') {
            setActiveMode('ADMIN');
          } else {
            setActiveMode('SELL');
          }
          handleRefreshAll();
        }}
        onNavigateMode={handleToggleMode}
      />

      {/* Main Page Footer */}
      <Footer 
        onSelectMode={handleToggleMode} 
        onOpenAuth={handleOpenAuth} 
        user={user} 
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <OfflineProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </OfflineProvider>
    </LanguageProvider>
  );
}

