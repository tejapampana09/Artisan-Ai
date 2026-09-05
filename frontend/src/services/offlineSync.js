import { syncBatch } from '../api';

const OFFLINE_QUEUE_KEY = 'artisan_ai_offline_queue';
const CACHED_PRODUCTS_KEY = 'artisan_ai_cached_products';
const OFFLINE_MODE_KEY = 'artisan_ai_offline_mode';

// Mode helpers
export function getStoredOfflineMode() {
  try {
    return localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setStoredOfflineMode(isOffline) {
  try {
    localStorage.setItem(OFFLINE_MODE_KEY, String(isOffline));
  } catch (e) {
    console.error('Failed to write offline mode to localStorage', e);
  }
}

// Queue helpers
export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse offline queue', e);
    return [];
  }
}

export function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline queue', e);
  }
}

export function addToOfflineQueue(item) {
  const queue = getOfflineQueue();
  const newItem = {
    ...item,
    client_temp_id: item.client_temp_id || `draft_local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: 'PENDING_SYNC',
    queued_at: new Date().toISOString()
  };
  queue.push(newItem);
  saveOfflineQueue(queue);
  return newItem;
}

export function removeFromOfflineQueue(clientTempId) {
  const queue = getOfflineQueue();
  const filtered = queue.filter(item => item.client_temp_id !== clientTempId);
  saveOfflineQueue(filtered);
  return filtered;
}

export function clearOfflineQueue() {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (e) {
    console.error('Failed to clear offline queue', e);
  }
}

// Cached products helpers
export function getCachedProducts() {
  try {
    const raw = localStorage.getItem(CACHED_PRODUCTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function setCachedProducts(products) {
  try {
    localStorage.setItem(CACHED_PRODUCTS_KEY, JSON.stringify(products));
  } catch (e) {
    console.error('Failed to cache products', e);
  }
}

// Sync execution helper
export async function executeBatchSync() {
  const queue = getOfflineQueue();
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

  // Clear queue upon successful response
  clearOfflineQueue();

  return response;
}
