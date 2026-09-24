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
  const isSeller = params === 'seller' || params?.role_view === 'seller';
  const query = typeof params === 'string'
    ? `role_view=${encodeURIComponent(params)}`
    : new URLSearchParams(params).toString();
  const endpoint = query ? `/marketplace/enquiries?${query}` : '/marketplace/enquiries';
  return await apiRequest(endpoint, isSeller ? { domain: 'STUDIO' } : {});
}

export async function getOrders(params = {}) {
  const isSeller = params === 'seller' || params?.role_view === 'seller';
  const query = typeof params === 'string'
    ? `role_view=${encodeURIComponent(params)}`
    : new URLSearchParams(params).toString();
  const endpoint = query ? `/marketplace/orders?${query}` : '/marketplace/orders';
  return await apiRequest(endpoint, isSeller ? { domain: 'STUDIO' } : {});
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

export async function createPayment(orderId, provider = 'RAZORPAY', idempotencyKey = null) {
  return await apiRequest('/marketplace/payments/create', {
    method: 'POST',
    body: JSON.stringify({
      order_id: orderId,
      provider: provider,
      idempotency_key: idempotencyKey
    }),
  });
}

export async function verifyPayment(payload) {
  return await apiRequest('/marketplace/payments/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function previewWishlistReminders(daysThreshold = 3) {
  return await apiRequest(`/notifications/wishlist-reminders/preview?days_threshold=${daysThreshold}`);
}

export async function triggerWishlistReminders({ daysThreshold = 3, dryRun = false } = {}) {
  return await apiRequest(`/notifications/wishlist-reminders/run?days_threshold=${daysThreshold}&dry_run=${dryRun}`, {
    method: 'POST'
  });
}


