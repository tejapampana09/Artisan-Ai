/**
 * Centralized API Client for Artisan AI.
 * Handles base URL configuration, request timeouts, retries, headers, and error normalization.
 */

export function getApiBase() {
  // 1. Explicit Vite env variable
  if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }

  // 2. Default relative route (proxied by Vite to http://127.0.0.1:8000)
  return '/api';
}

export const AUTH_TOKEN_KEY = 'artisan_ai_auth_token';

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

const DEFAULT_TIMEOUT_MS = 15000;

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
      throw new ApiError('Request timed out after 15 seconds. Please check your connection and try again.', 408, 'TIMEOUT', null, true);
    }
    if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
      throw new ApiError('Unable to connect to the server. Please check your network connection.', 0, 'NETWORK_ERROR', null, true);
    }
    throw err;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const apiBase = getApiBase();
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const headers = {
    'Bypass-Tunnel-Remainder': 'true',
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAuthToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
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
