# Builder implementation iteration 1

Date: 2026-08-28
Assignment: `SWITCHBOOK-PERF-MASTERSWITCH-20260828-002`
Base/released SHA: `a2f5442626d08ae8eda028f65389c81e65e957f2`
Scope: local implementation and verification only; no push, deployment, container lifecycle, or production mutation.

## Self-verdict

**PASS_LOCAL — ready for independent QA.** The confirmed standalone/proxy origin mismatch is repaired without relaxing authentication or cross-origin rejection. Force-curve queue responses are projected, ID-map enriched, server-filtered, paginated, and capped at 100 items while global count truth is still computed across all review sources. Successful mutations refresh only the current bounded page. Master Switches uses a single-shot per-filter load and both list APIs return projected, capped results. All required local gates pass.

Live post-change route/API p95 and a real persisted attach remain independent QA/ops work: deployment was not authorized, SSH credentials were unavailable, and `.env.local` points to an inactive local PostgreSQL endpoint. No production write was attempted.

## Root cause and durable changes

### 1. Same-origin attach validation

`isSameOriginMutation` no longer compares the public browser Origin to Next standalone's internal `request.nextUrl.origin` (`https://0.0.0.0:3000`). It now requires all of the following:

- authenticated `ADMIN` access remains the first route gate;
- a present, parseable browser `Origin`;
- a single trusted proxy host (`X-Forwarded-Host`, falling back to `Host`);
- a single exact `http` or `https` `X-Forwarded-Proto`;
- browser origin and proxy-derived origin both exactly equal the canonical `NEXTAUTH_URL` origin;
- no userinfo, path, query, fragment, comma-separated host, or proto chain.

Thus the legitimate production tuple `Origin=https://switchbook.app`, `X-Forwarded-Host=switchbook.app`, `X-Forwarded-Proto=https` is accepted even when Next's internal URL is `https://0.0.0.0:3000`. Missing/malformed Origin, cross-origin, forged host, forged protocol, userinfo, and path-bearing values fail closed. Anonymous and non-admin denial code is unchanged.

### 2. Force-curve bounded queue

Added `getForceCurveReviewQueuePage` as the shared page/API query service:

- review and catalog queries use explicit projections and omit feedback/unused catalog fields;
- candidate association uses a `Map<id,candidate>` instead of `reviews.map(candidates.filter(...))`;
- global `buildReviewQueue` still sees every projected review and candidate needed to preserve raw, unique, open/resolved, actionable, deferred, and bucket counts;
- query, bucket, and status filtering runs server-side;
- page size defaults to 50, is clamped to 1-100, and invalid/non-finite page inputs are normalized;
- only the requested page is serialized into RSC props or JSON;
- the UI removed its misleading client-only `visibleLimit`, exposes Previous/Next controls, debounces server search, and shows `page items / filtered total`;
- successful attach/approval/defer/no-match operations fetch only the current filtered page rather than the former unbounded 21.4 MB queue.

This deliberately avoids a schema/migration expansion in iteration 1. Queries still project all review identities to retain exact source-centric count truth; independent QA should measure PostgreSQL query cost separately on the production dataset.

### 3. Master Switches single-shot loading

The page records the loaded filter and ignores repeated auth/session effect execution for that same filter. A real filter change still triggers exactly one new paired load. Submission and edit APIs now use explicit displayed-field projections and cap results at 100 newest rows. Existing approve/reject refresh behavior remains scoped to its active list.

## Changed files

- `src/lib/admin-force-curves.ts` — canonical/proxy origin validation.
- `src/lib/admin-force-curve-queue.ts` — projected ID-map queue service, server filtering and pagination.
- `src/app/admin/force-curves/page.tsx` — bounded initial queue.
- `src/app/api/admin/force-curves/reviews/route.ts` — bounded GET query parameters; mutation behavior/access unchanged.
- `src/components/admin/ForceCurveReviewQueue.tsx` — server filters/pages and bounded current-page refresh.
- `src/app/admin/master-switches/page.tsx` — per-filter single-shot loading guard.
- `src/app/api/admin/master-switches/route.ts` — displayed-field projection and 100-row cap.
- `src/app/api/admin/master-switch-edits/route.ts` — displayed-field projection and 100-row cap.
- `tests/force-curves.test.ts` — canonical proxy-origin and bounded queue/count/payload regression coverage.
- `tests/admin-navigation.test.ts` — single-shot/bounded API and paginated UI regression coverage.
- `evidence/SWITCHBOOK-PERF-MASTERSWITCH-20260828-002/diagnosis-builder-readonly.md` — accepted read-only diagnosis.
- `evidence/SWITCHBOOK-PERF-MASTERSWITCH-20260828-002/builder-iteration-1.md` — this handoff.

No unrelated dirty file was edited, staged, reverted, or included.

## Performance evidence

### Released live before baseline

| Surface | Cold | Warm p95 | API/payload |
|---|---:|---:|---:|
| `/admin/force-curves` | 11.859 s | 11.271 s | reviews GET p95 11.182 s; 21,395,407 bytes |
| `/admin/master-switches` | 2.311 s spinner clear | 3.139 s | duplicated request pairs; relevant API p95 828.8 ms |
| `/admin` | 231 ms | 293.6 ms | healthy/reference |

### Production-shaped local algorithm/payload benchmark

Fixture: 2,729 unique open source reviews and 2,729 referenced candidates, matching the diagnosed production source count. In-memory query adapters isolate enrichment/build/serialization behavior from unavailable database/network infrastructure. Eight bounded iterations; nearest-rank p95.

```text
old O(review × candidate) enrichment + full queue:
  construction: 69.94 ms
  serialized:   2,019,956 bytes
  items:        2,729

new projected ID-map + page 1 size 50:
  samples ms:   6.19, 3.96, 3.60, 2.66, 4.54, 5.09, 2.87, 2.53
  p95:          6.19 ms
  serialized:   37,380 bytes
  items:        50
  count truth:  uniqueSourceCount=2,729; filteredSourceCount=2,729
```

Fixture serialization fell **98.1%** and algorithm p95 is well below the `<750ms` server target. The fixture payload is intentionally smaller than production's evidence JSON, so byte counts are not presented as a live-after claim. The enforced 50/100-item response bound makes production response size proportional to the requested page rather than all 2,729 sources.

No honest live-after cold/warm measurement is possible until QA runs this revision against a production-shaped database or Ops releases an accepted SHA. Required acceptance remains: warm visible p95 `<1s`, API/server p95 `<750ms`, attach persistence and same-page update, and unchanged access/cross-origin denial.

## Validation commands and results

- `git diff --check` — PASS.
- `npx tsc --noEmit` — PASS.
- `npx tsx --test tests/force-curves.test.ts tests/admin-navigation.test.ts` — PASS, 27/27.
- `npm test` — PASS, 76/76.
- `npm run lint` — PASS; existing warnings only. The scoped Master Switch file retains its pre-existing `<img>` warning; no new lint error/warning was introduced by the changed logic.
- `npm run build` — PASS; optimized Next 15.5.23 production build compiled, typechecked, and generated all 83 static pages. `/admin/force-curves` remained dynamic; `/admin/master-switches` built successfully.
- 2,729-row benchmark command — PASS; results recorded above.

## Independent QA requirements

1. Use a disposable production-shaped database and legitimate ADMIN browser session.
2. Assert the legitimate HTTPS proxy tuple accepts an invalid-body request as 400, not 403, without mutation; assert missing/malformed/cross-origin/forged-host/forged-proto requests remain 403 and anonymous/non-admin remain denied.
3. Attach a dedicated reversible review fixture to the intended MasterSwitch, verify persistence/audit identity, verify the current page updates without document reload, then clean up/reconcile the fixture.
4. Verify global queue counts/buckets against direct read-only database counts and traverse pages/filters/search on desktop/mobile.
5. Record cold plus at least eight warm samples for the three routes and relevant APIs, response byte counts, server/query breakdown, and nearest-rank p95.
6. Verify Master Switch navigation makes one session resolution and one submissions/edit pair per filter, with no hidden stale/loading state.

## Rollback and risks

Rollback is code-only: revert the scoped commit. No migration, data backfill, configuration change, or external resource was added.

Remaining risks for QA:

- Count correctness intentionally requires projected reads across all review rows; if PostgreSQL query time alone exceeds the target, a later schema-backed source projection/materialized count design may be needed.
- Master Switch APIs cap at 100 newest rows and do not yet expose pagination controls. This bounds cost but operators with more than 100 records in one status need a follow-up paged UI to reach older history.
- Canonical validation depends on production `NEXTAUTH_URL` remaining the authoritative public application origin and nginx continuing to overwrite the forwarded host/protocol headers as currently configured.
- iOS parity is N/A because these are authenticated admin-only web surfaces; responsive mobile-web QA remains required.
