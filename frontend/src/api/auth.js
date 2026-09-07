import { 
  apiRequest, 
  getAuthToken, 
  setAuthToken, 
  clearAuthToken 
} from './client.js';

export { getAuthToken, setAuthToken, clearAuthToken };

export function isAuthenticated() {
  return !!getAuthToken();
}

export async function registerUser(userData) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  if (data && data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function loginUser(credentials) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  if (data && data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function changePassword(payload) {
  const data = await apiRequest('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data && data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function resetPassword(payload) {
  const data = await apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data && data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export function logoutUser() {
  clearAuthToken();
}
