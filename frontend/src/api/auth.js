import { 
  apiRequest, 
  getAuthToken, 
  setAuthToken, 
  clearAuthToken,
  getBuyerToken,
  setBuyerToken,
  clearBuyerToken,
  getStudioToken,
  setStudioToken,
  clearStudioToken,
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  marketplaceRequest,
  studioRequest,
  adminRequest
} from './client.js';
import { setStoredUser, clearUserOfflineCache } from '../services/offlineSync.js';

export { 
  getAuthToken, 
  setAuthToken, 
  clearAuthToken,
  getBuyerToken,
  setBuyerToken,
  clearBuyerToken,
  getStudioToken,
  setStudioToken,
  clearStudioToken,
  getAdminToken,
  setAdminToken,
  clearAdminToken
};

export function isAuthenticated(domain = null) {
  return !!getAuthToken(domain);
}

// A browser has one active Artisan AI identity at a time. Keeping stale domain
// tokens would let a reload silently restore a different role's workspace.
function activateSingleRoleSession(domain, token) {
  clearAuthToken();
  setAuthToken(token, domain);
}

// 1. Marketplace Buyer Auth
export async function registerBuyer(userData) {
  const data = await marketplaceRequest('/marketplace/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  if (data && data.access_token) {
    activateSingleRoleSession('BUYER', data.access_token);
  }
  if (data && data.user) {
    setStoredUser(data.user, 'BUYER');
  }
  return data;
}

export async function loginBuyer(credentials) {
  const data = await marketplaceRequest('/marketplace/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  if (data && data.access_token) {
    activateSingleRoleSession('BUYER', data.access_token);
  }
  if (data && data.user) {
    setStoredUser(data.user, 'BUYER');
  }
  return data;
}

export async function googleAuthBuyer(googleData) {
  const data = await marketplaceRequest('/marketplace/auth/google', {
    method: 'POST',
    body: JSON.stringify(googleData),
  });
  if (data && data.access_token) {
    activateSingleRoleSession('BUYER', data.access_token);
  }
  if (data && data.user) {
    setStoredUser(data.user, 'BUYER');
  }
  return data;
}

// 2. Artisan Studio Auth
export async function loginArtisan(credentials) {
  const data = await studioRequest('/studio/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  if (data && data.access_token) {
    activateSingleRoleSession('STUDIO', data.access_token);
  }
  if (data && data.user) {
    setStoredUser(data.user, 'STUDIO');
  }
  return data;
}

// 3. Admin Console Auth
export async function loginAdmin(credentials) {
  const data = await adminRequest('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  if (data && data.access_token) {
    activateSingleRoleSession('ADMIN', data.access_token);
  }
  if (data && data.user) {
    setStoredUser(data.user, 'ADMIN');
  }
  return data;
}

// Standard exported helpers
export const registerUser = registerBuyer;
export const googleAuth = googleAuthBuyer;

export async function loginUser(credentials) {
  if (credentials.portal === 'STUDIO' || credentials.portal === 'ARTISAN') {
    return await loginArtisan(credentials);
  }
  if (credentials.portal === 'ADMIN') {
    return await loginAdmin(credentials);
  }
  try {
    return await loginBuyer(credentials);
  } catch (err) {
    if (err.message && err.message.includes('ARTISAN')) {
      return await loginArtisan(credentials);
    }
    if (err.message && err.message.includes('ADMIN')) {
      return await loginAdmin(credentials);
    }
    throw err;
  }
}

export async function changePassword(payload, domain = 'MARKETPLACE') {
  const endpoint = domain === 'STUDIO' 
    ? '/studio/auth/change-password'
    : domain === 'ADMIN'
    ? '/admin/auth/change-password'
    : '/marketplace/auth/change-password';
  const data = await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    domain: domain
  });
  if (data && data.access_token) {
    activateSingleRoleSession(domain, data.access_token);
  }
  return data;
}

// --- Domain-scoped logout helpers ---
export function logoutBuyer() {
  clearBuyerToken();
  try {
    localStorage.removeItem('artisan_ai_buyer_user');
  } catch {}
}

export function logoutArtisan() {
  clearStudioToken();
  try {
    localStorage.removeItem('artisan_ai_studio_user');
  } catch {}
}

export function logoutAdmin() {
  clearAdminToken();
  try {
    localStorage.removeItem('artisan_ai_admin_user');
  } catch {}
}

export function logoutUser(portal = null) {
  if (portal === 'STUDIO' || portal === 'ARTISAN') {
    logoutArtisan();
  } else if (portal === 'ADMIN') {
    logoutAdmin();
  } else if (portal === 'MARKETPLACE' || portal === 'BUYER') {
    logoutBuyer();
  } else {
    // Default fallback: clear active user offline cache & tokens
    clearUserOfflineCache();
    clearAuthToken();
  }
}

/**
 * V3: Public password reset is not available.
 * Passwords are changed via the authenticated change-password endpoints.
 * This stub is kept for import compatibility.
 */
export async function resetPassword(_payload) {
  throw new Error(
    'Public password reset is not available in this version. ' +
    'Use the authenticated change-password flow from your account settings.'
  );
}
