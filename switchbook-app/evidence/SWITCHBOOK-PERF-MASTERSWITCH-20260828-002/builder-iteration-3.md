# Builder iteration 3 — 2026-08-28

Verdict: `PASS_LOCAL`

Scoped implementation commit: `4b89cb4f9059c1a60ec0c4ffef787afc1a71051f`

No push, deployment, production request, or production mutation occurred. All unrelated dirty work was preserved.

## Confirmed root cause

The root layout mounted `SessionProvider` without an initial session. Auth.js therefore fetched `/api/auth/session` on mount and broadcast the result. During a full Chromium navigation, the outgoing document's provider could still receive that broadcast and issue another session refresh while the incoming provider was mounting. The default visibility lifecycle provided another non-deterministic revalidation path. Removing the page-level `useSession` consumer in iteration 2 did not address this root provider lifecycle.

The root layout now resolves the authoritative session with server-side `auth()` and passes it into `SessionProvider`. The provider disables focus revalidation and performs one explicit, non-broadcast client session revalidation. Auth.js storage/sign-in synchronization remains present, while a normal full navigation now has exactly one browser session resource and cannot trigger the outgoing-document broadcast loop.

Middleware authentication/ADMIN redirects and the ADMIN checks in the submissions/edits APIs were not changed.

## Changed files

- `src/app/layout.tsx`: server-resolve and hydrate the root session.
- `src/components/Providers.tsx`: hydrate `SessionProvider`, disable focus refetch, and perform one non-broadcast revalidation.
- `tests/admin-master-switch-cardinality.browser.ts`: production-build Playwright/Chromium request-cardinality and auth-route regression.
- `tests/admin-navigation.test.ts`: focused provider-configuration regression.
- `package.json`, `package-lock.json`: add the browser-test command and `playwright-core` test dependency.

Force-curve, origin-validation, queue, and Master Switch data-loader implementation files were not changed.

## Exact production-browser request trace

Isolated PostgreSQL 17 fixture database, legitimate credentials-authenticated ADMIN, optimized Next production build, local port 3013, headless Chromium.

Before the final fix, the reproduced first full navigation was:

- `/api/auth/session`: 2
- `/api/admin/master-switches?status=pending`: 1
- `/api/admin/master-switch-edits?status=pending`: 1

Server hydration alone confirmed the provider cause by changing the same trace to `0 / 1 / 1`. The final server-hydrated plus non-broadcast revalidation implementation produced the required trace on the cold navigation and every one of eight warm full navigations:

- navigation 1: `1 session / 1 submissions / 1 edits`
- navigation 2: `1 / 1 / 1`
- navigation 3: `1 / 1 / 1`
- navigation 4: `1 / 1 / 1`
- navigation 5: `1 / 1 / 1`
- navigation 6: `1 / 1 / 1`
- navigation 7: `1 / 1 / 1`
- navigation 8: `1 / 1 / 1`
- navigation 9: `1 / 1 / 1`

A genuine `Pending -> Approved` filter change in the same document produced:

- `/api/auth/session`: 0
- approved submissions: 1
- approved edits: 1

The browser regression also confirmed anonymous public `/` HTTP 200, anonymous `/admin` redirect to `/auth/login`, credentials login to `/dashboard`, and authenticated ADMIN API HTTP 200.

## Gates

- `npm run test:admin-browser`: PASS, real production-build Chromium; 9/9 navigation traces exact and filter trace exact.
- `npx tsc --noEmit`: PASS.
- `npx tsx --test tests/admin-navigation.test.ts tests/admin-master-switch-loading.test.ts`: PASS, 5/5.
- `npm test`: PASS, 78/78.
- `npm run lint`: PASS with the repository's pre-existing warnings only.
- `npm run build`: PASS, optimized Next 15.5.23 production build, 83/83 pages.
- `git diff --check` and cached diff check: PASS.

## Cleanup, rollback, and remaining risk

The local production server was stopped. The dedicated `switchbook_perf_builder_i3` fixture database was dropped and confirmed absent. No shared data was touched.

Rollback is the scoped commit above. It would restore the unhydrated root provider and its duplicate/non-deterministic navigation requests. Remaining risk is limited to independent QA against the exact evidence head; local coverage exercised public, anonymous-protected, authenticated page, and ADMIN API paths, but no production behavior is claimed.
