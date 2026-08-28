# Builder rework iteration 2

Date: 2026-08-28
Assignment: `SWITCHBOOK-PERF-MASTERSWITCH-20260828-002`
QA failure SHA: `05f426090c4b09bf022aa441c6898bf9eea64768`
Scoped implementation commit: `a4aacaf5ceac29add59660e239ee6769f74be248`

## Self-verdict

**PASS_LOCAL — deterministic QA failure repaired; ready for independent browser recheck.** The page-level `useSession()` consumer was redundant with the root `SessionProvider`, producing the second `/api/auth/session` request on every full navigation. It was removed. Existing middleware remains the authoritative pre-render route gate and still redirects anonymous users to login and non-ADMIN users to `/dashboard`. Initial data loading and genuine filter changes each execute exactly one submissions/edit request pair.

No force-curve, origin, queue, persistence, schema, proxy, or production code outside this exact Master Switch load path was changed. No push, deployment, fixture creation, or production mutation occurred.

## Confirmed root cause

The application root wraps every route in `SessionProvider`, which resolves the browser session once. `/admin/master-switches` additionally called `useSession()` and waited for that client status before its data effect. QA's production-build resource trace conclusively recorded the combined result as two session API calls, while the iteration-1 per-filter guard correctly held each data endpoint to one call.

The narrow repair removes `useSession()` and `useRouter()` from the page. ADMIN authorization is not weakened:

- middleware runs on `/admin/master-switches` before the page;
- no session redirects to `/auth/login`;
- a session whose role is not `ADMIN` redirects to `/dashboard`;
- both data APIs independently call `auth()` and return 401 unless the user is ADMIN.

The page now begins one bounded data pair after mount. `loadedFilter` still suppresses duplicate effect execution for the same filter. A real filter change changes the key and produces one new pair.

## Exact request cardinality

### Before: QA production-build browser trace

Nine independent full navigations (one cold and eight warm) each produced:

```text
GET /api/auth/session                                  × 2  FAIL
GET /api/admin/master-switches?status=pending         × 1
GET /api/admin/master-switch-edits?status=pending     × 1
```

### After: executable fetch-integration trace

The new functional request-cardinality test invokes the exact loader used by the page through an injected Fetch implementation and records ordered URLs. Initial page-load contract, including the one root-provider request outside the loader:

```text
GET /api/auth/session                                  × 1
GET /api/admin/master-switches?status=pending         × 1
GET /api/admin/master-switch-edits?status=pending     × 1
```

Genuine `pending -> approved` filter change contract:

```text
GET /api/admin/master-switches?status=pending         × 1
GET /api/admin/master-switch-edits?status=pending     × 1
GET /api/admin/master-switches?status=approved        × 1
GET /api/admin/master-switch-edits?status=approved    × 1
GET /api/auth/session                                  × 0  during filter changes
```

These are runtime functional assertions over the loader/fetch boundary, not source-text-only assertions. The structural test additionally fails if `useSession` returns to the page. Independent QA must repeat its real production-build Chromium resource trace because this builder iteration has no active disposable database/browser server and is not authorized to deploy.

## Changed files

- `src/app/admin/master-switches/page.tsx` — removes the redundant client session consumer/router redirect and calls the single-shot loader.
- `src/lib/admin-master-switch-loading.ts` — fetch-injectable, parallel one-pair loader for the active filter.
- `tests/admin-master-switch-loading.test.ts` — executable initial-load and genuine-filter-change request cardinality traces.
- `tests/admin-navigation.test.ts` — guards against restoring `useSession` and requires the functional loader call site.
- `tests/run-tests.ts` — registers the functional regression tests.
- `evidence/SWITCHBOOK-PERF-MASTERSWITCH-20260828-002/builder-iteration-2.md` — this handoff.

## Gates

- `git diff --check` — PASS.
- `npx tsc --noEmit` — PASS.
- `npx tsx --test tests/admin-master-switch-loading.test.ts tests/admin-navigation.test.ts` — PASS, 5/5.
- `npm test` — PASS, 78/78.
- `npm run lint` — PASS with existing warnings only; the pre-existing Master Switch `<img>` warning remains.
- `npm run build` — PASS; optimized Next 15.5.23 build compiled, typechecked, and generated 83/83 pages.

## QA acceptance request

Run the same disposable production build/browser procedure used for iteration 1 and assert across one cold plus eight warm full navigations:

1. exactly one `GET /api/auth/session`;
2. exactly one submissions GET and one edits GET;
3. each genuine filter click adds one new data pair and no session request;
4. anonymous redirect, authenticated USER redirect, and ADMIN access remain unchanged;
5. accepted force-curve attach/origin/queue/performance behavior remains green.

Rollback is code-only: revert implementation commit `a4aacaf5ceac29add59660e239ee6769f74be248` and the evidence commit. No migration, configuration, or data rollback is required.
