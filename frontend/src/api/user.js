import { apiRequest, getAuthToken } from './client.js';

export async function getCurrentUser() {
  if (!getAuthToken()) return null;
  try {
    return await apiRequest('/me');
  } catch (err) {
    console.error('Error fetching user:', err);
    return null;
  }
}
