import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker(extra = {}) {
  const handlers = {};
  const self = { location: { origin: 'https://shop.example' },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    clients: { claim: async () => {} } };
  vm.runInNewContext(source, { self, URL, Response, ...extra });
  return handlers;
}

test('service worker never intercepts API, authenticated or third-party requests', () => {
  const handlers = worker();
  for (const [url, headers] of [
    ['https://shop.example/api/orders', {}],
    ['https://shop.example/api', {}],
    ['https://third-party.example/assets/file.js', {}],
    ['https://shop.example/assets/file.js', { Authorization: 'Bearer private' }],
  ]) {
    handlers.fetch({ request: new Request(url, { headers }),
      respondWith: () => assert.fail('Private or external request intercepted') });
  }
});

test('activation preserves other applications caches and the current cache', async () => {
  const deleted = [];
  const handlers = worker({ caches: {
    keys: async () => ['other-app-cache', 'artisan-ai-cache-v6', 'artisan-ai-cache-v7'],
    delete: async key => { deleted.push(key); },
  } });
  let pending;
  handlers.activate({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.deepEqual(deleted, ['artisan-ai-cache-v6']);
});
