import { apiRequest } from './client.js';

export async function getProducts(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/products?${query}` : '/products';
  return await apiRequest(endpoint);
}

export async function getProduct(id) {
  return await apiRequest(`/products/${id}`);
}

export async function createProduct(data) {
  return await apiRequest('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(id, data) {
  return await apiRequest(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id) {
  await apiRequest(`/products/${id}`, {
    method: 'DELETE',
  });
  return true;
}

export async function processAICatalog(data) {
  return await apiRequest('/ai/process-catalog', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveAndPublishAICatalog(data) {
  return await apiRequest('/ai/approve-and-publish', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPriceRecommendation(productId) {
  return await apiRequest(`/products/${productId}/price-recommendation`);
}

export async function submitPriceDecision(productId, decision) {
  return await apiRequest(`/products/${productId}/price-decision`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

export async function sendBuyerCopilotMessage(payload) {
  return await apiRequest('/buyer/copilot-chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function translateProduct(payload) {
  return await apiRequest('/ai/translate-product', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function estimateFairPrice(payload) {
  return await apiRequest('/ai/estimate-price', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

