import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import SellView from './components/SellView';
import BuyView from './components/BuyView';
import OfflineSyncBanner from './components/OfflineSyncBanner';
import AuthModal from './components/AuthModal';
import NotificationCenter from './components/NotificationCenter';
import { OfflineProvider, useOffline } from './context/OfflineContext';
import { NotificationProvider } from './context/NotificationContext';
import { checkHealth, checkReady, getCurrentUser, updateUserMode, getAuthToken } from './api/index.js';

import { LanguageProvider, useLanguage } from './context/LanguageContext';
import LanguageSelectorModal from './components/LanguageSelectorModal';

function AppContent() {
  const [activeMode, setActiveMode] = useState('HOME');
  const [user, setUser] = useState(null);
  const [readyStatus, setReadyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { isOffline } = useOffline();

  const loadInitialData = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        const [, ready] = await Promise.all([checkHealth(), checkReady()]);
        setReadyStatus(ready);
        setUser(null);
        setActiveMode('HOME');
        return;
      }

      const [, ready, userData] = await Promise.all([
        checkHealth(),
        checkReady(),
        getCurrentUser()
      ]);
      setReadyStatus(ready);
      if (userData && !userData.detail && !userData.error) {
        setUser(userData);
        if (userData.role === 'BUYER') {
          setActiveMode('BUY');
        } else if (userData.active_mode && userData.active_mode !== 'HOME') {
          setActiveMode(userData.active_mode);
        } else {
          setActiveMode('SELL');
        }
      } else {
        setUser(null);
        setActiveMode('HOME');
      }
    } catch (e) {
      console.error('Initial load failed', e);
      setUser(null);
      setActiveMode('HOME');
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans relative overflow-x-hidden">
      <NotificationCenter />
      <LanguageSelectorModal />
      
      {/* Top Navigation */}
      <Navbar
        activeMode={activeMode}
        onToggleMode={handleToggleMode}
        user={user}
        readyStatus={readyStatus}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 overflow-x-hidden">
        <OfflineSyncBanner />

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Connecting to Artisan AI backend...</span>
            </div>
          </div>
        ) : (
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
        )}
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
            <span>Workspace: <strong className="text-slate-800">{activeMode === 'HOME' ? 'Home Showcase' : activeMode === 'SELL' ? 'Artisan Studio' : 'Buyer Marketplace'}</strong></span>
            <span>Sync: <strong className={isOffline ? 'text-orange-600' : 'text-emerald-600'}>{isOffline ? 'Offline (Local Cache)' : 'Live (Cloud DB)'}</strong></span>
            <span>Database: <strong className={readyStatus?.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'}>{readyStatus?.database || 'Connected'}</strong></span>
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

