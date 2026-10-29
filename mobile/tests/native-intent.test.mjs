import test from 'node:test';
import assert from 'node:assert/strict';
import { redirectSystemPath } from '../app/+native-intent.ts';

for (const initial of [true, false]) {
  test(`preserves Google OAuth callback normalization (initial=${initial})`, () => {
    for (const path of ['artisanai://oauth2redirect?code=abc%2F123&state=test',
      'artisanai:/oauth2redirect?code=abc%2F123&state=test']) {
      assert.equal(redirectSystemPath({ path, initial }), '/oauth2redirect?code=abc%2F123&state=test');
    }
  });
  test(`preserves valid encoded links (initial=${initial})`, () => {
    for (const path of ['artisanai://product/42?name=Blue%20Pottery', '/buyer-home',
      'artisanai://product/42?next=%2Forders&label=%E0%B0%95']) {
      assert.equal(redirectSystemPath({ path, initial }), path);
    }
  });
  test(`rejects malformed percent encoding before router parsing (initial=${initial})`, () => {
    for (const path of ['artisanai://product?name=%FF', '/product?q=%',
      '/product?q=%E0%A4', `/product?q=${'%FF'.repeat(2000)}`]) {
      assert.equal(redirectSystemPath({ path, initial }), '/');
    }
  });
}
test('rejects oversized external URLs', () => {
  assert.equal(redirectSystemPath({ path: `/product?q=${'x'.repeat(8192)}`, initial: true }), '/');
});
