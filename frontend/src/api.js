const API_BASE = '/api';

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
    const res = await fetch(`${API_BASE}/me`);
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
  try {
    const res = await fetch(`${API_BASE}/seller/opportunities`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching seller opportunities:', err);
    return { copilot_insight: null, opportunities: [], category_demand: [] };
  }
}

export async function getCopilotInsight() {
  try {
    const res = await fetch(`${API_BASE}/seller/copilot-insight`);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error submitting price decision for product ${productId}:`, err);
    throw err;
  }
}
