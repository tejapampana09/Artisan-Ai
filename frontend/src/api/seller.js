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
  if (!getAuthToken()) {
    return { copilot_insight: null, opportunities: [], category_demand: [] };
  }
  return await apiRequest('/seller/opportunities');
}

export async function getCopilotInsight() {
  if (!getAuthToken()) {
    return null;
  }
  return await apiRequest('/seller/copilot-insight');
}

export async function getSellerDashboard() {
  if (!getAuthToken()) {
    return null;
  }
  return await apiRequest('/seller/dashboard');
}

export async function downloadAnalyticsCSV() {
  const token = getAuthToken();
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
