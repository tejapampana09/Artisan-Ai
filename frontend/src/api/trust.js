import { apiRequest } from './client.js';

// Artisan Profile & Verification
export async function getArtisanProfile(artisanId) {
  return await apiRequest(`/artisan/${artisanId}`);
}

export async function updateArtisanProfile(data) {
  return await apiRequest('/artisan/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Verified Reviews & Ratings
export async function getProductReviews(productId) {
  return await apiRequest(`/products/${productId}/reviews`);
}

export async function createProductReview(productId, data) {
  return await apiRequest(`/products/${productId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Persistent Notifications
export async function getNotifications() {
  return await apiRequest('/notifications');
}

export async function markNotificationRead(notificationId) {
  return await apiRequest(`/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

// Order Cancellation & Refund
export async function cancelBuyerOrder(orderId, reason) {
  return await apiRequest(`/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function cancelSellerOrder(orderId, reason) {
  return await apiRequest(`/seller/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
