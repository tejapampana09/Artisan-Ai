import { apiRequest } from './client.js';

export async function fetchCraftClusters() {
  try {
    return await apiRequest('/artisan/map/clusters');
  } catch (err) {
    console.error('Failed to fetch craft clusters:', err);
    return [];
  }
}

export async function fetchArtisanMapPins(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.cluster_id) query.append('cluster_id', params.cluster_id);
    if (params.state) query.append('state', params.state);
    if (params.craft) query.append('craft', params.craft);
    const qs = query.toString();
    const endpoint = qs ? `/artisan/map/pins?${qs}` : '/artisan/map/pins';
    return await apiRequest(endpoint);
  } catch (err) {
    console.error('Failed to fetch artisan map pins:', err);
    return [];
  }
}

export async function updateArtisanStudioLocation(locationData) {
  return await apiRequest('/artisan/location', {
    method: 'PUT',
    domain: 'STUDIO',
    body: JSON.stringify(locationData),
  });
}
