import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import SellView from './components/SellView';
import BuyView from './components/BuyView';
import { checkHealth, checkReady, getCurrentUser, updateUserMode } from './api';

export default function App() {
  const [activeMode, setActiveMode] = useState('SELL');
  const [user, setUser] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [readyStatus, setReadyStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      setLoading(true);
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
      setLoading(false);
    }
    init();
  }, []);

  const handleToggleMode = async (newMode) => {
    // Instant optimistic UI update
    setActiveMode(newMode);
    const updated = await updateUserMode(newMode);
    if (updated) {
      setUser(updated);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        activeMode={activeMode}
        onToggleMode={handleToggleMode}
        user={user}
        readyStatus={readyStatus}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              <SellView user={user} />
            ) : (
              <BuyView user={user} />
            )}
          </div>
        )}
      </main>

      {/* Step 1 Verification Status Bar */}
      <footer className="bg-white border-t border-slate-200 py-3 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div>
            <span>SIH 2026 — Problem Statement ID: <strong>26090</strong> (Heritage & Culture)</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Mode: <strong className="text-slate-800">{activeMode}</strong></span>
            <span>API: <strong className={healthStatus?.status === 'ok' ? 'text-emerald-600' : 'text-amber-600'}>{healthStatus?.status || 'checking'}</strong></span>
            <span>Database: <strong className={readyStatus?.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'}>{readyStatus?.database || 'checking'}</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
