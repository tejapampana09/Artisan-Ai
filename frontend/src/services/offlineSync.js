import { syncBatch } from '../api/index.js';

export function getCurrentUserId(userIdOverride = null) {
  if (userIdOverride) return userIdOverride;
  try {
    const raw = localStorage.getItem('artisan_ai_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.id) return user.id;
    }
  } catch {}
  return 'guest';
}

export function setStoredUser(user) {
  try {
    if (user && user.id) {
      localStorage.setItem('artisan_ai_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('artisan_ai_user');
    }
  } catch (e) {
    console.error('Failed to set stored user:', e);
  }
}

function getQueueKey(userId) {
  return `artisan_ai_offline_queue_${getCurrentUserId(userId)}`;
}
function getProductsKey(userId) {
  return `artisan_ai_cached_products_${getCurrentUserId(userId)}`;
}
function getDemandsKey(userId) {
  return `artisan_ai_cached_demands_${getCurrentUserId(userId)}`;
}
function getCopilotKey(userId) {
  return `artisan_ai_cached_copilot_${getCurrentUserId(userId)}`;
}
function getOpportunitiesKey(userId) {
  return `artisan_ai_cached_opportunities_${getCurrentUserId(userId)}`;
}
function getModeKey(userId) {
  return `artisan_ai_offline_mode_${getCurrentUserId(userId)}`;
}

// Migrate legacy global keys if present
function migrateLegacyKeys(userId) {
  const uid = getCurrentUserId(userId);
  const legacyQueue = localStorage.getItem('artisan_ai_offline_queue');
  if (legacyQueue) {
    try {
      const targetKey = `artisan_ai_offline_queue_${uid}`;
      if (!localStorage.getItem(targetKey)) {
        localStorage.setItem(targetKey, legacyQueue);
      }
    } catch (e) {}
    localStorage.removeItem('artisan_ai_offline_queue');
  }
}

// Mode helpers
export function getStoredOfflineMode(userId) {
  try {
    return localStorage.getItem(getModeKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function setStoredOfflineMode(isOffline, userId) {
  try {
    localStorage.setItem(getModeKey(userId), String(isOffline));
  } catch (e) {
    console.error('Failed to write offline mode to localStorage', e);
  }
}

// Queue helpers
export function getOfflineQueue(userId) {
  try {
    migrateLegacyKeys(userId);
    const raw = localStorage.getItem(getQueueKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse offline queue', e);
    return [];
  }
}

export function saveOfflineQueue(queue, userId) {
  try {
    localStorage.setItem(getQueueKey(userId), JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline queue', e);
  }
}

export function addToOfflineQueue(item, userId) {
  const queue = getOfflineQueue(userId);
  const newItem = {
    ...item,
    client_temp_id: item.client_temp_id || `draft_local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: 'PENDING_SYNC',
    queued_at: new Date().toISOString()
  };
  queue.push(newItem);
  saveOfflineQueue(queue, userId);
  return newItem;
}

export function removeFromOfflineQueue(clientTempId, userId) {
  const queue = getOfflineQueue(userId);
  const filtered = queue.filter(item => item.client_temp_id !== clientTempId);
  saveOfflineQueue(filtered, userId);
  return filtered;
}

export function clearOfflineQueue(userId) {
  try {
    localStorage.removeItem(getQueueKey(userId));
  } catch (e) {
    console.error('Failed to clear offline queue', e);
  }
}

// Cached products helpers
export function getCachedProducts(userId) {
  try {
    const raw = localStorage.getItem(getProductsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function setCachedProducts(products, userId) {
  try {
    localStorage.setItem(getProductsKey(userId), JSON.stringify(products));
  } catch (e) {
    console.error('Failed to cache products', e);
  }
}

export function getCachedDemands(userId) {
  try {
    const raw = localStorage.getItem(getDemandsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedDemands(demands, userId) {
  try {
    localStorage.setItem(getDemandsKey(userId), JSON.stringify(demands));
  } catch (e) {
    console.error('Failed to cache demands', e);
  }
}

export function getCachedCopilotInsight(userId) {
  try {
    const raw = localStorage.getItem(getCopilotKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedCopilotInsight(insight, userId) {
  try {
    if (insight) {
      localStorage.setItem(getCopilotKey(userId), JSON.stringify(insight));
    } else {
      localStorage.removeItem(getCopilotKey(userId));
    }
  } catch (e) {
    console.error('Failed to cache copilot insight', e);
  }
}

export function getCachedOpportunities(userId) {
  try {
    const raw = localStorage.getItem(getOpportunitiesKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedOpportunities(opps, userId) {
  try {
    if (opps && opps.length > 0) {
      localStorage.setItem(getOpportunitiesKey(userId), JSON.stringify(opps));
    } else {
      localStorage.removeItem(getOpportunitiesKey(userId));
    }
  } catch (e) {
    console.error('Failed to cache opportunities', e);
  }
}

/**
 * Account Logout Cleanup Helper.
 * Explicit Security & Resilience Policy:
 * 1. Clears transient cached view data (products, demand metrics, copilot recommendations, opportunities).
 * 2. PRESERVES the user's namespaced offline queue (`artisan_ai_offline_queue_<userId>`) so that unsynced
 *    craft drafts created in low-connectivity rural environments remain safe and will auto-sync when
 *    this specific artisan logs back in.
 * 3. Removes active session identity (`artisan_ai_user`) from localStorage.
 */
export function clearUserOfflineCache(userId) {
  try {
    const uid = userId || getCurrentUserId();
    // Clear transient cached view data to prevent UI bleed on shared devices
    localStorage.removeItem(`artisan_ai_cached_products_${uid}`);
    localStorage.removeItem(`artisan_ai_cached_demands_${uid}`);
    localStorage.removeItem(`artisan_ai_cached_copilot_${uid}`);
    localStorage.removeItem(`artisan_ai_cached_opportunities_${uid}`);
    localStorage.removeItem(`artisan_ai_offline_mode_${uid}`);
    // Clear active session identity
    localStorage.removeItem('artisan_ai_user');
    // NOTE: artisan_ai_offline_queue_${uid} is intentionally preserved to prevent data loss.
  } catch (e) {
    console.error('Failed to clear user offline cache on logout', e);
  }
}

// Wishlist / Saved items persistence
export function getSavedProductIds(userId) {
  try {
    const key = `artisan_ai_wishlist_${userId || 'guest'}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProductId(userId, productId) {
  try {
    const ids = getSavedProductIds(userId);
    if (!ids.includes(productId)) {
      ids.push(productId);
      const key = `artisan_ai_wishlist_${userId || 'guest'}`;
      localStorage.setItem(key, JSON.stringify(ids));
    }
    return ids;
  } catch {
    return [];
  }
}

export function removeSavedProductId(userId, productId) {
  try {
    let ids = getSavedProductIds(userId);
    ids = ids.filter(id => id !== productId);
    const key = `artisan_ai_wishlist_${userId || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(ids));
    return ids;
  } catch {
    return [];
  }
}

// Sync execution helper
export async function executeBatchSync(userId) {
  const queue = getOfflineQueue(userId);
  if (queue.length === 0) {
    return { status: 'empty', total_items_synced: 0 };
  }

  const productsToSync = queue
    .filter(item => item.type === 'CREATE_PRODUCT')
    .map(item => ({
      client_temp_id: item.client_temp_id,
      title: item.payload.title,
      description: item.payload.description,
      craft_story: item.payload.craft_story,
      category: item.payload.category,
      materials: item.payload.materials,
      price: Number(item.payload.price) || 0,
      stock: Number(item.payload.stock) || 1,
      image_url: item.payload.image_url,
      enhanced_image_url: item.payload.enhanced_image_url,
      status: item.payload.status || 'PUBLISHED',
      material_cost: Number(item.payload.material_cost) || 0,
      labour_cost: Number(item.payload.labour_cost) || 0,
      packaging_cost: Number(item.payload.packaging_cost) || 0,
      other_cost: Number(item.payload.other_cost) || 0,
      min_margin_pct: Number(item.payload.min_margin_pct) || 0.20,
      created_at_client: item.queued_at
    }));

  const decisionsToSync = queue
    .filter(item => item.type === 'PRICE_DECISION')
    .map(item => ({
      product_id: item.payload.product_id,
      decision: item.payload.decision,
      recommended_price: Number(item.payload.recommended_price),
      previous_price: Number(item.payload.previous_price),
      demand_factor: Number(item.payload.demand_factor) || 1.0,
      market_adjustment: Number(item.payload.market_adjustment) || 1.0,
      reasoning_summary: item.payload.reasoning_summary || 'Approved in offline mode',
      created_at_client: item.queued_at
    }));

  const payload = {
    client_sync_timestamp: new Date().toISOString(),
    products: productsToSync,
    price_decisions: decisionsToSync
  };

  const response = await syncBatch(payload);

  // Inspect per-item backend response to remove ONLY successfully synced items
  const syncedProductTempIds = new Set(
    (response?.products_synced || [])
      .filter(p => p.server_id > 0 && p.status !== 'FAILED' && !p.status?.startsWith('FAILED'))
      .map(p => p.client_temp_id)
      .filter(Boolean)
  );

  const syncedDecisionProductIds = new Set(
    (response?.price_decisions_synced || [])
      .filter(d => d.status === 'APPLIED' || d.status === 'SYNCED' || d.status === 'SKIPPED_NOT_FOUND' || d.status === 'REJECTED_UNAUTHORIZED')
      .map(d => d.product_id)
  );

  const currentQueue = getOfflineQueue(userId);
  const remainingQueue = currentQueue.filter(q => {
    if (q.type === 'CREATE_PRODUCT') {
      return !syncedProductTempIds.has(q.client_temp_id);
    }
    if (q.type === 'PRICE_DECISION') {
      return !syncedDecisionProductIds.has(q.payload?.product_id);
    }
    return true; // Retain unrecognized queued items for safety
  });

  saveOfflineQueue(remainingQueue, userId);

  return response;
}
