import React from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

export default function OfflineSyncBanner() {
  const {
    isOffline,
    queueCount,
    offlineQueue,
    isSyncing,
    syncStatus,
    syncFeedback,
    triggerSync,
    toggleOfflineMode
  } = useOffline();

  // If online, not syncing, and no pending items, hide banner
  if (!isOffline && queueCount === 0 && !syncFeedback && syncStatus === 'idle') {
    return null;
  }

  return (
    <div className="mb-6 transition-all duration-300">
      {/* Offline Mode Active Banner */}
      {isOffline ? (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-amber-400">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <WifiOff className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm">Rural Cluster Offline Mode Active</span>
                <span className="text-[10px] font-bold bg-white/20 uppercase px-2 py-0.5 rounded-full">
                  Local Device Sandbox
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                Cataloging, voice transcription drafts, and price decisions are safely stored on device. Zero data loss.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-center">
            {queueCount > 0 && (
              <span className="text-xs font-semibold bg-amber-900/60 px-3 py-1 rounded-lg border border-amber-400/40">
                {queueCount} {queueCount === 1 ? 'Action' : 'Actions'} Queued
              </span>
            )}
            <button
              onClick={() => toggleOfflineMode(false)}
              className="px-3.5 py-1.5 bg-white text-amber-900 hover:bg-amber-50 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              Reconnect Cloud
            </button>
          </div>
        </div>
      ) : (
        /* Reconnected with Pending Queue Banner */
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-indigo-700">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center flex-shrink-0 text-emerald-400">
              {isSyncing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Wifi className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm">
                  {isSyncing
                    ? 'Syncing Offline Queue...'
                    : queueCount > 0
                    ? `Cloud Reconnected (${queueCount} Pending Drafts)`
                    : 'Cloud Sync Successful'}
                </span>
                {queueCount > 0 && (
                  <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase px-2 py-0.5 rounded-full">
                    Ready to Sync
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                {syncFeedback || (queueCount > 0
                  ? `You have ${queueCount} item(s) drafted offline waiting to be committed to the central database.`
                  : 'All rural artisan actions are synchronized with central cloud database.')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-center">
            {queueCount > 0 && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync All to Cloud Now'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
