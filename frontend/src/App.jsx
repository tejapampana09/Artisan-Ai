import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import SellView from './components/SellView';
import BuyView from './components/BuyView';
import OfflineSyncBanner from './components/OfflineSyncBanner';
import JudgeDemoModal from './components/JudgeDemoModal';
import AuthModal from './components/AuthModal';
import { OfflineProvider, useOffline } from './context/OfflineContext';
import { checkHealth, checkReady, getCurrentUser, updateUserMode } from './api';
import { Award, Sparkles } from 'lucide-react';

function AppContent() {
  const [activeMode, setActiveMode] = useState('SELL');
  const [user, setUser] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [readyStatus, setReadyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isJudgeGuideOpen, setIsJudgeGuideOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { isOffline, queueCount } = useOffline();

  const loadInitialData = async () => {
    try {
      const [health, ready, userData] = await Promise.all([
        checkHealth(),
        checkReady(),
        getCurrentUser()
      ]);
      setHealthStatus(health);
      setReadyStatus(ready);
      if (userData) {
        setUser(userData);
        if (userData.active_mode) {
          setActiveMode(userData.active_mode);
        }
      }
    } catch (e) {
      console.error('Initial load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [refreshTrigger]);

  const handleToggleMode = async (newMode) => {
    setActiveMode(newMode);
    if (!isOffline) {
      const updated = await updateUserMode(newMode);
      if (updated) {
        setUser(updated);
      }
    }
  };

  const handleRefreshAll = async () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans relative">
      {/* Top Navigation */}
      <Navbar
        activeMode={activeMode}
        onToggleMode={handleToggleMode}
        user={user}
        readyStatus={readyStatus}
        onOpenGuide={() => setIsJudgeGuideOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Step 7: Offline Sync & Cluster Status Banner */}
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
            {activeMode === 'SELL' ? (
              <SellView user={user} key={`sell_${refreshTrigger}`} />
            ) : (
              <BuyView user={user} key={`buy_${refreshTrigger}`} />
            )}
          </div>
        )}
      </main>

      {/* Floating SIH Evaluator Pill (Bottom Right) */}
      <div className="fixed bottom-14 right-6 z-40">
        <button
          onClick={() => setIsJudgeGuideOpen(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-slate-900 to-amber-950 text-amber-300 px-4 py-2.5 rounded-full shadow-xl border border-amber-400/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Award className="w-4 h-4 text-amber-400 animate-bounce" />
          <span className="text-xs font-bold tracking-wide">SIH Judge Guide</span>
          {queueCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
              {queueCount}
            </span>
          )}
        </button>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onAuthChange={(newUser) => {
          setUser(newUser);
          if (newUser?.active_mode) {
            setActiveMode(newUser.active_mode);
          }
          handleRefreshAll();
        }}
      />

      {/* SIH Judge Demo Walkthrough Modal */}
      <JudgeDemoModal
        isOpen={isJudgeGuideOpen}
        onClose={() => setIsJudgeGuideOpen(false)}
        onRefreshData={handleRefreshAll}
      />

      {/* Step 1-7 Verification Status Bar */}
      <footer className="bg-white border-t border-slate-200 py-3 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div>
            <span>SIH 2026 — Problem Statement ID: <strong>26090</strong> (Heritage & Culture)</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Mode: <strong className="text-slate-800">{activeMode}</strong></span>
            <span>Network: <strong className={isOffline ? 'text-orange-600' : 'text-emerald-600'}>{isOffline ? 'Offline (Local Sandbox)' : 'Online (Cloud DB)'}</strong></span>
            <span>Database: <strong className={readyStatus?.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'}>{readyStatus?.database || 'checking'}</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <OfflineProvider>
      <AppContent />
    </OfflineProvider>
  );
}

