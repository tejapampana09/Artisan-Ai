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
import { checkHealth, checkReady, getCurrentUser, getAuthToken } from './api/index.js';

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

function AppContent() {
  const [activeMode, setActiveMode] = useState('HOME'); // 'HOME' | 'BUY' | 'SELL' | 'STORY' | 'ARTISANS'
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

      const token = getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }

      const userData = await getCurrentUser();
      if (userData && !userData.detail && !userData.error) {
        setUser(userData);
        setStoredUser(userData);
        if (userData.role === 'BUYER') {
          setActiveMode('BUY');
        } else if (userData.role === 'ADMIN') {
          setActiveMode('ADMIN');
        } else {
          setActiveMode('SELL');
        }
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
    if (user && targetMode === 'HOME') {
      targetMode = user.role === 'BUYER' ? 'BUY' : 'SELL';
    }
    setActiveMode(targetMode);
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleRefreshAll = () => {
    setRefreshTrigger(prev => prev + 1);
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
    <div className="min-h-screen bg-[#FAF9F6] text-[#1C1C1C] flex flex-col font-sans relative overflow-x-hidden">
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
        />
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 overflow-x-hidden">
        <OfflineSyncBanner />

        <div>
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
              activeSellerTab={sellerTab}
              onSelectSellerTab={setSellerTab}
              key={`sell_${refreshTrigger}`} 
            />
          ) : activeMode === 'ADMIN' ? (
            <AdminView 
              user={user}
              onAuthChange={setUser}
              onSelectMode={handleToggleMode}
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

      {/* Download PWA App Modal */}
      <DownloadAppModal
        isOpen={isDownloadAppOpen}
        onClose={() => setIsDownloadAppOpen(false)}
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

