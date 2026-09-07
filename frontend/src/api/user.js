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

export async function updateUserMode(mode) {
  return await apiRequest('/me/mode', {
    method: 'PATCH',
    body: JSON.stringify({ mode }),
  });
}
