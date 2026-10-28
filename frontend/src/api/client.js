/**
 * Centralized API Client for Artisan AI.
 * Handles base URL configuration, request timeouts, retries, headers, and error normalization.
 */

export function getApiBase() {
  // In the browser, always use relative '/api' so all requests are same-origin.
  // This utilizes Vercel's edge rewrites in production and Vite proxy in dev,
  // completely eliminating CORS errors, preflight OPTIONS issues, and cross-origin drops!
  if (typeof window !== 'undefined') {
    return '/api';
  }

  // Fallback for SSR or non-browser environments if VITE_API_BASE is provided
  if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE) {
    const raw = String(import.meta.env.VITE_API_BASE).trim().replace(/\/+$/, '');
    if (raw) {
      return raw.endsWith('/api') ? raw : `${raw}/api`;
    }
  }

  return '/api';
}

export const BUYER_TOKEN_KEY = 'artisan_ai_buyer_token';
export const STUDIO_TOKEN_KEY = 'artisan_ai_studio_token';
export const ADMIN_TOKEN_KEY = 'artisan_ai_admin_token';
export const AUTH_TOKEN_KEY = 'artisan_ai_auth_token'; // Legacy fallback

// --- Domain-specific token accessors ---
export function getBuyerToken() {
  try {
    return localStorage.getItem(BUYER_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setBuyerToken(token) {
  try {
    if (token) {
      localStorage.setItem(BUYER_TOKEN_KEY, token);
      localStorage.setItem(AUTH_TOKEN_KEY, token); // Keep legacy synced for unmigrated components
    } else {
      localStorage.removeItem(BUYER_TOKEN_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to write buyer token:', e);
  }
}

export function clearBuyerToken() {
  try {
    localStorage.removeItem(BUYER_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {
    console.error('Failed to clear buyer token:', e);
  }
}

export function getStudioToken() {
  try {
    return localStorage.getItem(STUDIO_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStudioToken(token) {
  try {
    if (token) {
      localStorage.setItem(STUDIO_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(STUDIO_TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to write studio token:', e);
  }
}

export function clearStudioToken() {
  try {
    localStorage.removeItem(STUDIO_TOKEN_KEY);
  } catch (e) {
    console.error('Failed to clear studio token:', e);
  }
}

export function getAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token) {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to write admin token:', e);
  }
}

export function clearAdminToken() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch (e) {
    console.error('Failed to clear admin token:', e);
  }
}

export function getAuthToken(domain = null) {
  if (domain === 'STUDIO' || domain === 'ARTISAN') return getStudioToken();
  if (domain === 'ADMIN') return getAdminToken();
  if (domain === 'MARKETPLACE' || domain === 'BUYER') return getBuyerToken();
  return getStudioToken() || getBuyerToken() || getAdminToken();
}

export function setAuthToken(token, domain = 'MARKETPLACE') {
  if (domain === 'STUDIO' || domain === 'ARTISAN') setStudioToken(token);
  else if (domain === 'ADMIN') setAdminToken(token);
  else setBuyerToken(token);
}

export function clearAuthToken(domain = null) {
  if (domain === 'STUDIO' || domain === 'ARTISAN') {
    clearStudioToken();
  } else if (domain === 'ADMIN') {
    clearAdminToken();
  } else if (domain === 'MARKETPLACE' || domain === 'BUYER') {
    clearBuyerToken();
  } else {
    // Clear all if no specific domain requested
    clearBuyerToken();
    clearStudioToken();
    clearAdminToken();
  }
}

export class ApiError extends Error {
  constructor(message, status = 500, code = 'API_ERROR', details = null, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

export function formatApiErrorMessage(errData, fallbackMsg = 'Request failed') {
  if (!errData) return fallbackMsg;
  if (typeof errData.detail === 'string') return errData.detail;
  if (Array.isArray(errData.detail)) {
    return errData.detail
      .map(d => {
        if (!d) return '';
        if (typeof d === 'string') return d;
        const field = d.loc && d.loc.length > 0 ? d.loc[d.loc.length - 1] : '';
        const msg = d.msg || JSON.stringify(d);
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join('; ');
  }
  if (typeof errData.message === 'string') return errData.message;
  return fallbackMsg;
}

const DEFAULT_TIMEOUT_MS = 30000;

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      const timeoutSec = Math.round(timeoutMs / 1000);
      throw new ApiError(`Request timed out after ${timeoutSec} seconds. Please check your connection and try again.`, 408, 'TIMEOUT', null, true);
    }
    if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
      throw new ApiError('Unable to connect to the server. Please check your network connection.', 0, 'NETWORK_ERROR', null, true);
    }
    throw err;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const apiBase = getApiBase();
  // Strip duplicate /api if endpoint already starts with /api
  const cleanEndpoint = endpoint.startsWith('/api/') 
    ? endpoint.slice(4) 
    : (endpoint === '/api' ? '' : (endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint));
  const path = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${path}`;
  
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Keep the domain and token together so a rejected request cannot clear an
  // unrelated session (including when an endpoint uses an admin fallback).
  let token = null;
  let tokenDomain = null;
  if (options.auth !== false && !headers.has('Authorization')) {
    let domains;
    if (options.domain) {
      const aliases = { BUYER: 'MARKETPLACE', ARTISAN: 'STUDIO' };
      domains = [aliases[options.domain] || options.domain];
    } else if (cleanEndpoint.includes('/admin')) {
      domains = ['ADMIN', 'MARKETPLACE', 'STUDIO'];
    } else if (
      cleanEndpoint.includes('role_view=seller') ||
      cleanEndpoint.includes('/reply') ||
      (cleanEndpoint.includes('/orders/') && cleanEndpoint.includes('/status')) ||
      ['/studio', '/artisan', '/seller', '/ai', '/sync', '/pricing'].some(prefix => cleanEndpoint.startsWith(prefix))
    ) {
      domains = ['STUDIO', 'ADMIN'];
    } else if (cleanEndpoint.startsWith('/marketplace') || cleanEndpoint.startsWith('/buyer')) {
      domains = ['MARKETPLACE', 'ADMIN'];
    } else {
      domains = ['STUDIO', 'MARKETPLACE', 'ADMIN'];
    }
    for (const domain of domains) {
      const candidate = getAuthToken(domain);
      if (candidate) {
        token = candidate;
        tokenDomain = domain;
        break;
      }
    }
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const retries = options.retries ?? (options.method && options.method !== 'GET' ? 0 : 2);
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const response = await fetchWithTimeout(url, { ...options, headers }, options.timeoutMs);
      
      if (!response.ok) {
        let errData = null;
        try {
          errData = await response.json();
        } catch {
          errData = null;
        }
        
        const message = formatApiErrorMessage(errData, `HTTP error ${response.status}`);
        const isRetryable = response.status === 429 || response.status >= 500;
        
        if (isRetryable && attempt < retries) {
          attempt++;
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        
        const isAuthEndpoint = cleanEndpoint.includes('/auth/') || cleanEndpoint.includes('/register');

        if (
          response.status === 401 && !isAuthEndpoint && token && tokenDomain &&
          getAuthToken(tokenDomain) === token
        ) {
          // A late response must not invalidate a login completed since this
          // request started. Public/custom-auth requests own no stored session.
          clearAuthToken(tokenDomain);

          // Auto-logout: notify the app so it redirects to login immediately
          // without the user having to manually logout → login
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('artisan:session-expired', {
              detail: { domain: tokenDomain, message: 'Your session expired. Please log in again.' }
            }));
          }
        }

        throw new ApiError(message, response.status, 'HTTP_ERROR', errData, isRetryable);
      }

      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.retryable && attempt < retries) {
          attempt++;
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw err;
      }
      throw new ApiError(err.message || 'An unexpected error occurred', 500, 'UNEXPECTED_ERROR');
    }
  }
}

export function marketplaceRequest(endpoint, options = {}) {
  return apiRequest(endpoint, { ...options, domain: 'MARKETPLACE' });
}

export function studioRequest(endpoint, options = {}) {
  return apiRequest(endpoint, { ...options, domain: 'STUDIO' });
}

export function adminRequest(endpoint, options = {}) {
  return apiRequest(endpoint, { ...options, domain: 'ADMIN' });
}

export function publicRequest(endpoint, options = {}) {
  return apiRequest(endpoint, { ...options, auth: false });
}
