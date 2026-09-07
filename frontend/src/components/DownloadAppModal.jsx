import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, CheckCircle, Share, PlusSquare, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function DownloadAppModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.deferredPwaPrompt) {
      setDeferredPrompt(window.deferredPwaPrompt);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.deferredPwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.deferredPwaPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Automatically trigger native browser install prompt when modal opens
  useEffect(() => {
    if (isOpen && (deferredPrompt || window.deferredPwaPrompt) && !isInstalled) {
      const activePrompt = deferredPrompt || window.deferredPwaPrompt;
      try {
        activePrompt.prompt();
        activePrompt.userChoice.then(({ outcome }) => {
          if (outcome === 'accepted') {
            setIsInstalled(true);
          }
          setDeferredPrompt(null);
          window.deferredPwaPrompt = null;
        }).catch(() => {});
      } catch (e) {
        // Browser requires user gesture or already prompted
      }
    }
  }, [isOpen, deferredPrompt, isInstalled]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const activePrompt = deferredPrompt || window.deferredPwaPrompt;
    if (activePrompt) {
      activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      window.deferredPwaPrompt = null;
    } else {
      alert(t('pwaBrowserNote', 'Automatic install prompt initialized! If your browser blocked it, tap the 3 dots menu in Chrome/Edge and select "Install app" or "Add to Home Screen".'));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-20 sm:pb-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] my-auto">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 shadow-inner">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {t('downloadAppTitle', 'Download Artisan AI Mobile App')}
          </h2>
          <p className="text-xs text-amber-100 mt-1">
            {t('downloadAppSub', 'Fast, works offline in rural areas, and 100% fair artisan pricing.')}
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-800">
          {/* Main Action: Instant Install */}
          {isInstalled ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center space-x-3 text-emerald-800">
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-sm">{t('alreadyInstalled', 'App Already Installed!')}</p>
                <p className="text-xs text-emerald-700">{t('alreadyInstalledSub', 'Artisan AI is ready on your device home screen.')}</p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-900">
                    {t('instantInstallTitle', 'Instant 1-Click Installation')}
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {t('instantInstallSub', 'No App Store login required. Works natively on Android, iOS, & Desktop.')}
                  </p>
                </div>
              </div>

              <button
                onClick={handleInstallClick}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center space-x-2 transition-all cursor-pointer transform active:scale-98"
              >
                <Download className="w-5 h-5" />
                <span>{t('installAppNowBtn', 'Install App Now / ఆప్‌ని ఇన్స్టాల్ చేయండి')}</span>
              </button>
            </div>
          )}

          {/* Features Highlights */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium text-slate-700">{t('featureOfflineMode', 'Rural Offline Mode')}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-medium text-slate-700">{t('featureVoiceAi', 'Voice AI Guide')}</span>
            </div>
          </div>

          {/* How to add to home screen manually */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="font-bold text-xs text-slate-600 uppercase tracking-wider mb-2">
              {t('manualInstallHeader', 'Manual Setup Instructions')}
            </h4>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-lg">
                <Share className="w-4 h-4 text-indigo-600 shrink-0" />
                <span><strong>iOS / Safari:</strong> {t('iosInstallGuide', 'Tap Share button -> Add to Home Screen')}</span>
              </div>
              <div className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-lg">
                <PlusSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                <span><strong>Android / Chrome:</strong> {t('androidInstallGuide', 'Tap 3 dots menu -> Install app or Add to Home screen')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
          >
            {t('closeBtn', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
