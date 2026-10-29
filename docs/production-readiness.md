# Production release review

This branch hardens the application for a COD-only release. It is not a live deployment certification.

## Implemented

- API authorization failures expire only the stored token used by that request; delayed failures cannot remove a newer login.
- Production CORS uses the explicit configured origins. Exception responses follow the same policy.
- Production startup fails if the database migration revision cannot be verified.
- Fresh databases have a frozen baseline migration. Existing tracked databases retain their revision chain. Baseline downgrade is blocked to prevent accidental data loss.
- Deployment has backend, frontend, mobile typecheck and fresh PostgreSQL migration gates. Pull requests run validation without production secrets. Migration/deploy steps fail when required secrets are absent; readiness failures no longer report success.
- Render Blueprint disables automatic deploys that bypass the workflow and checks `/api/ready`.
- Payment idempotency keys cannot expose another order's payment. Cancelled orders cannot be revived by payment verification. Production rejects incomplete Razorpay order creation and buyer-side COD payment verification.
- Production orders are confirmed as COD with `UNPAID` status. Cash collection must be handled operationally; no automated collection settlement is claimed.
- Checkout returns the actual order ID separately from the analytics event ID. Web/mobile use it and remove successful items from the cart as each order completes. UI delivery charges match the server (zero); online payment is unavailable.
- Cancellation requires the order owner or seller/admin, uses row locking, restores inventory atomically and blocks reopening completed/cancelled orders.
- Service worker caching excludes APIs, authenticated and third-party requests and preserves unrelated caches.
- Heavy web views load on demand. The bundled ML model runtime is pinned to scikit-learn 1.9.1; incompatible artifacts fall back safely instead of being used with a warning.

## Required before enabling production traffic

1. Rotate the exposed Neon database credential immediately. It was present in the old deployment workflow and remains in Git history. Update `DATABASE_URL` (or `NEON_DATABASE_URL`) in GitHub and Render. Removing the text does not revoke the credential. Review provider access logs. Do not reuse that password.
2. Configure `RENDER_DEPLOY_HOOK_URL`, the database URL, a new strong `JWT_SECRET_KEY`, `GEMINI_API_KEY`, exact `CORS_ORIGINS`, and Google OAuth configuration for the intended domains. Confirm `ENVIRONMENT=production`, `DEMO_MODE=false`. These settings have not been inspected or changed in the hosting accounts.
3. Let PR validation complete, including the PostgreSQL migration gate. The PR PostgreSQL 16 fresh-migration gate passed on commit `19da993`; local migration verification also used a fresh SQLite database. Run migrations against a staging PostgreSQL copy and verify backups/restore before production. The historical migration chain modifies existing tables and needs representative data validation.
4. Build and sign Android/iOS releases, install on physical devices, and smoke-test login, listing, stock, multi-item COD checkout, cancellation, offline recovery, notifications and updates. Typechecking does not replace native runtime tests.
5. Verify AI, OAuth, email/push, storage persistence, TLS, backups and observability in staging with real provider credentials. API readiness checks the database, not every external provider or release identity.
6. Keep Razorpay unavailable until real provider order creation, captured-payment verification, webhooks, refunds and reconciliation are implemented and tested. Remove any external marketing promises of online payment until then.
7. Configure an edge/WAF or shared-store rate limit for multiple workers/instances. The current application limiter is per process. Load/concurrency and penetration tests remain release work.
8. Check Vercel and Render dashboard deploy settings: repository configuration alone does not prove existing hosting settings have changed. The deploy hook does not guarantee that an immediately healthy response belongs to the new revision; verify the deployed revision in Render.

## Remaining non-blocking development findings

Frontend lint still reports existing unused-symbol and hook dependency warnings. They were not silenced globally. The test runtime reports a Starlette/httpx deprecation warning. Review hook warnings with component-level browser tests before broader refactors.

## Validation commands

```sh
python -m pip install -r requirements.txt
python -m pytest backend/tests -q
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix mobile ci --ignore-scripts
cd mobile && npx tsc --noEmit
```

Use staging database credentials, never the retired credential, for `python -m alembic upgrade head`. Take a backup before changing an existing database. Do not run a destructive downgrade as a rollback strategy.


## Dependency follow-up (29 October 2026)

- Frontend: upgraded the lockfile and Vite minimum to 8.3.5. `npm audit` reports zero known vulnerabilities.
- Mobile: applied compatible package updates and aligned the Metro 0.83 family at 0.83.8 (removes its vulnerable image-size dependency). PostCSS is overridden to 8.5.32 because Expo 54 pins an older affected release. Android bundle export and TypeScript verification passed with these overrides. Keep the Metro family aligned when updating Expo; remove overrides once upstream pins patched dependencies.
- Mobile audit now reports **0 critical, 0 high, 3 moderate and 11 low** findings (14 affected dependency entries). The remaining root advisories are `decode-uri-component` (moderate, inherited through query-string/Expo Router) and `deepmerge` (low, inherited through Expo configuration). These findings have NOT been suppressed or declared resolved. A forced audit fix proposes incompatible Expo SDK changes, so it was not used.
- Added a native-intent guard which rejects malformed UTF-8/percent encoding and oversized external URLs before Expo Router's legacy query decoder runs. Seven regression tests cover cold/warm links, Google OAuth callback normalization and valid encoded path preservation. This mitigates external native-link input; it does not establish that every internal decoder call is safe or remove the upstream advisory.
- CI now checks the web dependency audit, fails mobile audits at high/critical severity, runs native-link tests and exports the Android bundle. Low/moderate mobile findings remain visible in the audit output and require upstream remediation or an explicit release risk decision.
- A Metro export is a JavaScript/Hermes bundle check, not a signed APK, native compilation or physical-device test.
