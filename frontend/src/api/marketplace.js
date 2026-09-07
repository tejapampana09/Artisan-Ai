import { apiRequest } from './client.js';

export async function submitEnquiry(data) {
  return await apiRequest('/marketplace/enquire', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function placeOrder(data) {
  return await apiRequest('/marketplace/order', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getTrendingProducts() {
  return await apiRequest('/marketplace/trending');
}

export async function getEnquiries(params = {}) {
  const query = typeof params === 'string'
    ? `role_view=${encodeURIComponent(params)}`
    : new URLSearchParams(params).toString();
  const endpoint = query ? `/marketplace/enquiries?${query}` : '/marketplace/enquiries';
  return await apiRequest(endpoint);
}

export async function getOrders(params = {}) {
  const query = typeof params === 'string'
    ? `role_view=${encodeURIComponent(params)}`
    : new URLSearchParams(params).toString();
  const endpoint = query ? `/marketplace/orders?${query}` : '/marketplace/orders';
  return await apiRequest(endpoint);
}

export async function replyToEnquiry(enquiryId, replyText) {
  return await apiRequest(`/marketplace/enquiries/${enquiryId}/reply`, {
    method: 'PUT',
    body: JSON.stringify({ artisan_reply: replyText }),
  });
}

export async function updateOrderStatus(orderId, newStatus) {
  return await apiRequest(`/marketplace/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus }),
  });
}
