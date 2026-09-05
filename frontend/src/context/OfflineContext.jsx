import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getStoredOfflineMode,
  setStoredOfflineMode,
  getOfflineQueue,
  addToOfflineQueue,
  removeFromOfflineQueue,
  clearOfflineQueue,
  executeBatchSync,
  getCachedProducts,
  setCachedProducts
} from '../services/offlineSync';

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isOffline, setIsOffline] = useState(() => getStoredOfflineMode());
  const [offlineQueue, setOfflineQueue] = useState(() => getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'synced', 'error'
  const [syncFeedback, setSyncFeedback] = useState('');

  // Refresh queue from storage
  const refreshQueue = useCallback(() => {
    setOfflineQueue(getOfflineQueue());
  }, []);

  // Listen to browser online/offline events as well
  useEffect(() => {
    const handleOnline = () => {
      // If user hadn't manually simulated offline, sync with hardware
      if (!getStoredOfflineMode()) {
        setIsOffline(false);
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Toggle offline mode explicitly (e.g. for cluster testing)
  const toggleOfflineMode = (forcedState) => {
    const nextState = typeof forcedState === 'boolean' ? forcedState : !isOffline;
    setIsOffline(nextState);
    setStoredOfflineMode(nextState);
    refreshQueue();
    if (!nextState && getOfflineQueue().length > 0) {
      // Reconnected and has items -> auto-sync prompt or execution
      setSyncFeedback('Connection restored. Ready to sync pending drafts.');
    }
  };

  // Queue product creation offline
  const queueProductDraft = (productPayload) => {
    const queuedItem = addToOfflineQueue({
      type: 'CREATE_PRODUCT',
      label: productPayload.title || 'Untitled Craft',
      payload: productPayload
    });

    // Also optimistically save to local cached products
    const cached = getCachedProducts();
    const optimisticProduct = {
      ...productPayload,
      id: queuedItem.client_temp_id, // temporary local id
      status: productPayload.status || 'DRAFT',
      isOfflineDraft: true,
      created_at: new Date().toISOString()
    };
    setCachedProducts([optimisticProduct, ...cached]);

    refreshQueue();
    return queuedItem;
  };

  // Queue price decision offline
  const queuePriceDecision = (decisionPayload) => {
    const queuedItem = addToOfflineQueue({
      type: 'PRICE_DECISION',
      label: `Price Approval for Product #${decisionPayload.product_id}`,
      payload: decisionPayload
    });
    refreshQueue();
    return queuedItem;
  };

  // Flush queue to backend
  const triggerSync = async () => {
    const currentQueue = getOfflineQueue();
    if (currentQueue.length === 0) return { status: 'empty' };

    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncFeedback(`Syncing ${currentQueue.length} offline item(s) to cloud...`);

    try {
      const result = await executeBatchSync();
      setIsSyncing(false);
      setSyncStatus('synced');
      setSyncFeedback(`Sync complete! ${result.total_items_synced || 0} items updated in database.`);
      refreshQueue();

      // Clear feedback after 4 seconds
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncFeedback('');
      }, 4000);

      return result;
    } catch (err) {
      console.error('Batch sync failed:', err);
      setIsSyncing(false);
      setSyncStatus('error');
      setSyncFeedback(`Sync failed: ${err.message}. Items remain safe in offline queue.`);
      throw err;
    }
  };

  const removeDraft = (clientTempId) => {
    removeFromOfflineQueue(clientTempId);
    refreshQueue();
  };

  const clearAllOffline = () => {
    clearOfflineQueue();
    refreshQueue();
  };

  return (
    <OfflineContext.Provider
      value={{
        isOffline,
        toggleOfflineMode,
        offlineQueue,
        queueCount: offlineQueue.length,
        isSyncing,
        syncStatus,
        syncFeedback,
        triggerSync,
        queueProductDraft,
        queuePriceDecision,
        removeDraft,
        clearAllOffline,
        refreshQueue
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
