import test from 'node:test';
import assert from 'node:assert/strict';

function resolveRouteMode(hashOrPath) {
  const route = (hashOrPath || '').toLowerCase().replace('#', '');
  if (route.includes('privacy')) return 'PRIVACY';
  if (route.includes('terms')) return 'TERMS';
  if (route.includes('refund') || route.includes('cancellation')) return 'REFUND';
  if (route.includes('contact') || route.includes('support')) return 'CONTACT';
  if (route.includes('become-artisan') || route.includes('seller-onboarding') || route.includes('artisan-guide')) return 'BECOME_ARTISAN';
  if (route.includes('story')) return 'STORY';
  if (route.includes('artisans')) return 'ARTISANS';
  if (route.includes('collections')) return 'COLLECTIONS';
  return 'HOME';
}

test('resolveRouteMode maps legal and support hash routes accurately', () => {
  assert.equal(resolveRouteMode('#terms'), 'TERMS');
  assert.equal(resolveRouteMode('#privacy'), 'PRIVACY');
  assert.equal(resolveRouteMode('#refund-cancellation'), 'REFUND');
  assert.equal(resolveRouteMode('#contact'), 'CONTACT');
  assert.equal(resolveRouteMode('#support'), 'CONTACT');
});

test('resolveRouteMode maps seller onboarding route accurately', () => {
  assert.equal(resolveRouteMode('#become-artisan'), 'BECOME_ARTISAN');
  assert.equal(resolveRouteMode('/seller-onboarding'), 'BECOME_ARTISAN');
  assert.equal(resolveRouteMode('#artisan-guide'), 'BECOME_ARTISAN');
});

test('resolveRouteMode defaults gracefully to HOME for unknown routes', () => {
  assert.equal(resolveRouteMode(''), 'HOME');
  assert.equal(resolveRouteMode('#unknown-path'), 'HOME');
});
