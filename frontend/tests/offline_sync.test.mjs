import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { 
  getSavedProductIds, 
  saveProductId, 
  removeSavedProductId, 
  getOfflineQueue, 
  addToOfflineQueue, 
  removeFromOfflineQueue 
} from '../src/services/offlineSync.js';

test('Wishlist offline saved product IDs work as expected', () => {
  const userId = 999;
  let saved = getSavedProductIds(userId);
  assert.deepEqual(saved, []);

  // Add product ID 42
  saveProductId(userId, 42);
  saved = getSavedProductIds(userId);
  assert.ok(saved.includes(42));

  // Remove product ID 42
  removeSavedProductId(userId, 42);
  saved = getSavedProductIds(userId);
  assert.ok(!saved.includes(42));
});

test('Offline queue operations enqueue and dequeue correctly', () => {
  const item = addToOfflineQueue('CREATE_PRODUCT', { title: 'Test Craft', price: 500 });
  assert.ok(item.client_temp_id);

  let queue = getOfflineQueue();
  assert.ok(queue.some(q => q.client_temp_id === item.client_temp_id));

  removeFromOfflineQueue(item.client_temp_id);
  queue = getOfflineQueue();
  assert.ok(!queue.some(q => q.client_temp_id === item.client_temp_id));
});
