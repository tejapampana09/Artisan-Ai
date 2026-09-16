import { apiRequest, getAuthToken, getApiBase } from './client.js';

export async function recordEvent(eventData) {
  try {
    return await apiRequest('/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  } catch {
    return null;
  }
}

export async function getEvents(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/events?${query}` : '/events';
  return await apiRequest(endpoint);
}

export async function getMarketDemand() {
  return await apiRequest('/market/demand');
}

export async function getSellerOpportunities() {
  if (!getAuthToken('STUDIO')) {
    return { copilot_insight: null, opportunities: [], category_demand: [] };
  }
  return await apiRequest('/seller/opportunities', { domain: 'STUDIO' });
}

export async function getCopilotInsight() {
  if (!getAuthToken('STUDIO')) {
    return null;
  }
  return await apiRequest('/seller/copilot-insight', { domain: 'STUDIO' });
}

export async function getSellerDashboard() {
  if (!getAuthToken('STUDIO')) {
    return null;
  }
  return await apiRequest('/seller/dashboard', { domain: 'STUDIO' });
}

export async function getSellerReadiness() {
  if (!getAuthToken('STUDIO')) {
    return { score: 0, strengths: [], improvements: [], next_best_action: "" };
  }
  return await apiRequest('/seller/readiness', { domain: 'STUDIO' });
}

export async function getSalesChannels() {
  if (!getAuthToken('STUDIO')) return [];
  return await apiRequest('/channels/list', { domain: 'STUDIO' });
}

export async function publishToChannel(productId, channelName) {
  return await apiRequest('/channels/publish', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, channel_name: channelName })
  });
}

export async function adminCreateSeller(data) {
  try {
    return await apiRequest('/admin/artisans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    return await apiRequest('/artisan/admin/create-seller', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export async function adminListSellers() {
  try {
    return await apiRequest('/admin/artisans');
  } catch (err) {
    return await apiRequest('/artisan/admin/sellers');
  }
}

export async function downloadAnalyticsCSV() {
  const token = getAuthToken('STUDIO');
  if (!token) throw new Error('Authentication required');

  const apiBase = getApiBase();
  const url = `${apiBase}/seller/analytics/export`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Bypass-Tunnel-Remainder': 'true',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to export analytics (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `Artisan_Analytics_Report.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
