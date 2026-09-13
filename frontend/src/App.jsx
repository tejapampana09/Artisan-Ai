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
import { checkHealth, checkReady, getCurrentUser, updateUserMode, getAuthToken } from './api/index.js';

import { LanguageProvider, useLanguage } from './context/LanguageContext';
import LanguageSelectorModal from './components/LanguageSelectorModal';
import DownloadAppModal from './components/DownloadAppModal';
import { setStoredUser } from './services/offlineSync';

function AppContent() {
  const [activeMode, setActiveMode] = useState('HOME');
  const [user, setUser] = useState(null);
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
  const [isDownloadAppOpen, setIsDownloadAppOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
        } else if (userData.active_mode && userData.active_mode !== 'HOME') {
          setActiveMode(userData.active_mode);
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
    if (!isOffline && user && (targetMode === 'SELL' || targetMode === 'BUY')) {
      const updated = await updateUserMode(targetMode);
      if (updated) {
        setUser(updated);
      }
    }
  };

  const handleRefreshAll = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C1A0E] flex flex-col font-sans relative overflow-x-hidden">
      {showSplash && <SplashScreen fadeOut={splashFading} />}
      <NotificationCenter />
      <LanguageSelectorModal />
      <DownloadAppModal 
        isOpen={isDownloadAppOpen} 
        onClose={() => setIsDownloadAppOpen(false)} 
      />
      
      {/* Top Navigation */}
      <Navbar
        activeMode={activeMode}
        onToggleMode={handleToggleMode}
        user={user}
        readyStatus={readyStatus}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenDownloadApp={() => setIsDownloadAppOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 overflow-x-hidden">
        <OfflineSyncBanner />

        <div>
          {activeMode === 'HOME' ? (
            <LandingPage
              onSelectMode={handleToggleMode}
              onOpenAuth={() => setIsAuthOpen(true)}
              user={user}
            />
          ) : activeMode === 'SELL' ? (
            <SellView 
              user={user} 
              onOpenAuth={() => setIsAuthOpen(true)} 
              onSwitchMode={handleToggleMode}
              key={`sell_${refreshTrigger}`} 
            />
          ) : (
            <BuyView user={user} onOpenAuth={() => setIsAuthOpen(true)} key={`buy_${refreshTrigger}`} />
          )}
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onAuthChange={(newUser) => {
          setUser(newUser);
          if (!newUser) {
            setActiveMode('HOME');
          } else if (newUser.role === 'BUYER') {
            setActiveMode('BUY');
          } else {
            setActiveMode(newUser.active_mode && newUser.active_mode !== 'HOME' ? newUser.active_mode : 'SELL');
          }
          handleRefreshAll();
        }}
        onNavigateMode={handleToggleMode}
      />

      {/* Enterprise Platform Status Bar */}
      <footer className="bg-white border-t border-slate-200 py-3 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div>
            <span>© 2026 <strong>Artisan AI Technologies</strong>. Enterprise SaaS Platform for Rural Craft Communities.</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>{t('workspaceLabel', 'Workspace')}: <strong className="text-slate-800">{activeMode === 'HOME' ? t('homeShowcase', 'Home Showcase') : activeMode === 'SELL' ? t('artisanStudio', 'Artisan Studio') : t('buyerMarketplace', 'Buyer Marketplace')}</strong></span>
            <span>{t('syncLabel', 'Sync')}: <strong className={isOffline ? 'text-orange-600' : 'text-emerald-600'}>{isOffline ? t('offlineLocalCache', 'Offline (Local Cache)') : t('liveCloudDb', 'Live (Cloud DB)')}</strong></span>
            <span>{t('databaseLabel', 'Database')}: <strong className={readyStatus?.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'}>{readyStatus?.database || t('connectedStatus', 'Connected')}</strong></span>
          </div>
        </div>
      </footer>
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

