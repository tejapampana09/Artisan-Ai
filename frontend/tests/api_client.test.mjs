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
  setBuyerToken,
  setStudioToken,
  setAdminToken,
  apiRequest,
  ApiError, 
  formatApiErrorMessage 
} from '../src/api/client.js';

test('getApiBase returns relative /api by default', () => {
  const base = getApiBase();
  assert.equal(typeof base, 'string');
  assert.ok(base.length > 0);
});

test('401 cleanup follows the token actually sent and preserves other sessions', async (t) => {
  const cases = [
    ['/sync/status', {}, 'STUDIO'],
    ['/marketplace/orders', {}, 'MARKETPLACE'],
    ['/artisan/admin/sellers', {}, 'ADMIN'],
    ['/orders', { domain: 'BUYER' }, 'MARKETPLACE'],
  ];
  for (const [endpoint, options, rejectedDomain] of cases) {
    await t.test(endpoint, async (t) => {
      clearAuthToken();
      setBuyerToken('buyer');
      setStudioToken('studio');
      setAdminToken('admin');
      t.after(() => clearAuthToken());
      t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 401 }));
      await assert.rejects(apiRequest(endpoint, { ...options, retries: 0 }), { status: 401 });
      for (const [domain, token] of [['MARKETPLACE', 'buyer'], ['STUDIO', 'studio'], ['ADMIN', 'admin']]) {
        assert.equal(getAuthToken(domain), domain === rejectedDomain ? null : token);
      }
    });
  }
});

test('401 from an admin fallback clears the admin token actually sent', async (t) => {
  clearAuthToken();
  setAdminToken('admin');
  t.after(() => clearAuthToken());
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 401 }));
  await assert.rejects(apiRequest('/marketplace/orders', { retries: 0 }), { status: 401 });
  assert.equal(getAuthToken('ADMIN'), null);
});

test('public and caller-authorized 401 responses do not clear stored sessions', async (t) => {
  clearAuthToken();
  setBuyerToken('buyer');
  t.after(() => clearAuthToken());
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.notEqual(new Headers(options.headers).get('Authorization'), 'Bearer buyer');
    return new Response('{}', { status: 401 });
  });
  for (const options of [
    { auth: false },
    { headers: { Authorization: 'Bearer external' } },
    { headers: { authorization: 'Bearer external' } },
    { headers: new Headers({ Authorization: 'Bearer external' }) },
  ]) {
    await assert.rejects(apiRequest('/marketplace/orders', { ...options, retries: 0 }), { status: 401 });
    assert.equal(getAuthToken('BUYER'), 'buyer');
  }
});

test('late 401 does not clear a newly signed-in session', async (t) => {
  clearAuthToken();
  setBuyerToken('old-token');
  t.after(() => clearAuthToken());
  let finishRequest;
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finishRequest = resolve; }));
  const pending = apiRequest('/marketplace/orders', { retries: 0 });
  setBuyerToken('new-token');
  finishRequest(new Response('{}', { status: 401 }));
  await assert.rejects(pending, { status: 401 });
  assert.equal(getAuthToken('BUYER'), 'new-token');
});

test('getAuthToken, setAuthToken, clearAuthToken function correctly', () => {
  clearAuthToken();
  assert.equal(getAuthToken(), null);

  setAuthToken('test_jwt_token_123');
  assert.equal(getAuthToken(), 'test_jwt_token_123');

  clearAuthToken();
  assert.equal(getAuthToken(), null);
});

test('studio token takes precedence over buyer token for default auth lookups', () => {
  clearAuthToken();
  setBuyerToken('buyer-token');
  setStudioToken('studio-token');

  assert.equal(getAuthToken(), 'studio-token');
  assert.equal(getAuthToken('BUYER'), 'buyer-token');
  assert.equal(getAuthToken('STUDIO'), 'studio-token');

  clearAuthToken();
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
