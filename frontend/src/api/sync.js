import { apiRequest } from './client.js';

export async function checkHealth() {
  try {
    return await apiRequest('/health', { retries: 0 });
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

export async function checkReady() {
  try {
    return await apiRequest('/ready', { retries: 0 });
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

export async function getSyncStatus() {
  try {
    return await apiRequest('/sync/status', { retries: 0 });
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}

export async function syncBatch(batchData) {
  return await apiRequest('/sync/batch', {
    method: 'POST',
    body: JSON.stringify(batchData),
  });
}
