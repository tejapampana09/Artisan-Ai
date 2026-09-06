const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const AUTH_TOKEN_KEY = 'artisan_ai_auth_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to write auth token:', e);
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {
    console.error('Failed to clear auth token:', e);
  }
}

export function getAuthHeaders(extra = {}) {
  const token = getAuthToken();
  const headers = { ...extra };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Authentication APIs
export async function registerUser(userData) {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || `HTTP error ${res.status}`);
    }
    const data = await res.json();
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  } catch (err) {
    console.error('Registration error:', err);
    throw err;
  }
}

export async function loginUser(credentials) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
      throw new Error(err.detail || `HTTP error ${res.status}`);
    }
    const data = await res.json();
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  } catch (err) {
    console.error('Login error:', err);
    throw err;
  }
}

export async function resetPassword(payload) {
  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Password reset failed' }));
      throw new Error(err.detail || `HTTP error ${res.status}`);
    }
    const data = await res.json();
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  } catch (err) {
    console.error('Reset password error:', err);
    throw err;
  }
}

export function logoutUser() {
  clearAuthToken();
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

export async function checkReady() {
  try {
    const res = await fetch(`${API_BASE}/ready`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

export async function getCurrentUser() {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching user:', err);
    return null;
  }
}

export async function updateUserMode(mode) {
  try {
    const res = await fetch(`${API_BASE}/me/mode`, {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error updating mode:', err);
    return null;
  }
}

// Product APIs
export async function getProducts(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_BASE}/products?${query}` : `${API_BASE}/products`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching products:', err);
    return [];
  }
}

export async function getProduct(id) {
  try {
    const res = await fetch(`${API_BASE}/products/${id}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error fetching product ${id}:`, err);
    return null;
  }
}

export async function createProduct(data) {
  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error creating product:', err);
    throw err;
  }
}

export async function updateProduct(id, data) {
  try {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error updating product ${id}:`, err);
    throw err;
  }
}

export async function deleteProduct(id) {
  try {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return true;
  } catch (err) {
    console.error(`Error deleting product ${id}:`, err);
    throw err;
  }
}

// Step 3: AI Catalog APIs
export async function processAICatalog(data) {
  try {
    const res = await fetch(`${API_BASE}/ai/process-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = typeof errData.detail === 'string'
        ? errData.detail
        : Array.isArray(errData.detail)
          ? errData.detail.map((d) => d.msg || d.message).join(', ')
          : `HTTP error ${res.status}`;
      throw new Error(msg);
    }
    return await res.json();
  } catch (err) {
    console.error('Error in AI catalog processing:', err);
    throw err;
  }
}

export async function approveAndPublishAICatalog(data) {
  try {
    const res = await fetch(`${API_BASE}/ai/approve-and-publish`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = typeof errData.detail === 'string'
        ? errData.detail
        : Array.isArray(errData.detail)
          ? errData.detail.map((d) => d.msg || d.message).join(', ')
          : `HTTP error ${res.status}`;
      throw new Error(msg);
    }
    return await res.json();
  } catch (err) {
    console.error('Error approving AI catalog:', err);
    throw err;
  }
}

// Step 4: Event & Marketplace APIs
export async function recordEvent(eventData) {
  try {
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error recording event:', err);
    return null;
  }
}

export async function getEvents(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_BASE}/events?${query}` : `${API_BASE}/events`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching events:', err);
    return [];
  }
}

export async function submitEnquiry(data) {
  try {
    const res = await fetch(`${API_BASE}/marketplace/enquire`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error submitting enquiry:', err);
    throw err;
  }
}

export async function placeOrder(data) {
  try {
    const res = await fetch(`${API_BASE}/marketplace/order`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error placing order:', err);
    throw err;
  }
}

export async function getTrendingProducts() {
  try {
    const res = await fetch(`${API_BASE}/marketplace/trending`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching trending products:', err);
    return [];
  }
}

export async function getEnquiries(params = {}) {
  try {
    const query = typeof params === 'string'
      ? `role_view=${encodeURIComponent(params)}`
      : new URLSearchParams(params).toString();
    const url = query ? `${API_BASE}/marketplace/enquiries?${query}` : `${API_BASE}/marketplace/enquiries`;
    const res = await fetch(url, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching enquiries:', err);
    return [];
  }
}

export async function getOrders(params = {}) {
  try {
    const query = typeof params === 'string'
      ? `role_view=${encodeURIComponent(params)}`
      : new URLSearchParams(params).toString();
    const url = query ? `${API_BASE}/marketplace/orders?${query}` : `${API_BASE}/marketplace/orders`;
    const res = await fetch(url, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching orders:', err);
    return [];
  }
}

// Step 5: Market Intelligence APIs
export async function getMarketDemand() {
  try {
    const res = await fetch(`${API_BASE}/market/demand`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching market demand:', err);
    return [];
  }
}

export async function getSellerOpportunities() {
  if (!getAuthToken()) {
    return { copilot_insight: null, opportunities: [], category_demand: [] };
  }
  try {
    const res = await fetch(`${API_BASE}/seller/opportunities`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching seller opportunities:', err);
    return { copilot_insight: null, opportunities: [], category_demand: [] };
  }
}

export async function getCopilotInsight() {
  if (!getAuthToken()) {
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}/seller/copilot-insight`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching copilot insight:', err);
    return null;
  }
}

// Step 6: Explainable Dynamic Pricing APIs
export async function getPriceRecommendation(productId) {
  try {
    const res = await fetch(`${API_BASE}/products/${productId}/price-recommendation`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error fetching price recommendation for product ${productId}:`, err);
    throw err;
  }
}

export async function submitPriceDecision(productId, decision) {
  try {
    const res = await fetch(`${API_BASE}/products/${productId}/price-decision`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error submitting price decision for product ${productId}:`, err);
    throw err;
  }
}

// Step 7: Offline Batch Sync APIs
export async function getSyncStatus() {
  try {
    const res = await fetch(`${API_BASE}/sync/status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}

export async function syncBatch(batchData) {
  try {
    const res = await fetch(`${API_BASE}/sync/batch`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(batchData),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error during batch sync:', err);
    throw err;
  }
}

export async function replyToEnquiry(enquiryId, replyText) {
  try {
    const res = await fetch(`${API_BASE}/marketplace/enquiries/${enquiryId}/reply`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ artisan_reply: replyText }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Error replying to enquiry:', err);
    throw err;
  }
}

export async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/marketplace/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Error updating order status:', err);
    throw err;
  }
}

export async function getSellerDashboard() {
  if (!getAuthToken()) {
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}/seller/dashboard`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching seller dashboard metrics:', err);
    return null;
  }
}

