import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

// Import client functions
import { 
  getApiBase, 
  getAuthToken, 
  setAuthToken, 
  clearAuthToken, 
  ApiError, 
  formatApiErrorMessage 
} from '../src/api/client.js';

test('getApiBase returns relative /api by default', () => {
  const base = getApiBase();
  assert.equal(typeof base, 'string');
  assert.ok(base.length > 0);
});

test('getAuthToken, setAuthToken, clearAuthToken function correctly', () => {
  clearAuthToken();
  assert.equal(getAuthToken(), null);

  setAuthToken('test_jwt_token_123');
  assert.equal(getAuthToken(), 'test_jwt_token_123');

  clearAuthToken();
  assert.equal(getAuthToken(), null);
});

test('ApiError encapsulates status, code, details and message', () => {
  const err = new ApiError('Unauthorized access', 401, 'UNAUTHORIZED', { field: 'token' }, false);
  assert.equal(err.message, 'Unauthorized access');
  assert.equal(err.status, 401);
  assert.equal(err.code, 'UNAUTHORIZED');
  assert.equal(err.retryable, false);
});

test('formatApiErrorMessage formats string and array errors properly', () => {
  assert.equal(formatApiErrorMessage({ detail: 'Invalid credentials' }), 'Invalid credentials');
  assert.equal(
    formatApiErrorMessage({ detail: [{ loc: ['body', 'email'], msg: 'field required' }] }),
    'email: field required'
  );
  assert.equal(formatApiErrorMessage(null, 'Fallback'), 'Fallback');
});
