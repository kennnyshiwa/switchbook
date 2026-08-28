# Builder production-performance corrective

Date: 2026-08-28
Verdict: `PASS_LOCAL`

Scoped implementation commit: `7935ff32f8bbc3143d4e47ef45d35e82c498ec6b`

No push, deployment, production query, or production mutation occurred. The production rollback evidence SHA-256 was independently confirmed as `28c7ec76b056b9637299efd0a8412ae49741344a19e03233981151d3685d88ae`. All unrelated dirty and untracked work was preserved.

## Reproduction and confirmed root cause

A dedicated local PostgreSQL 17 database received all 34 real migrations and an exact-cardinality fixture:

- 10,512 review rows
- 5,484 distinct source identities
- 2,725 open source identities
- 5,484 extant catalog candidates
- realistic repeated evidence and padded JSON payloads
- one isolated credentials-authenticated ADMIN

Direct SQL confirmed `10512 / 5484 / 2725` before the application benchmark. The pre-correction service was measured five times with the exact default production query shape. It returned correct truth and 50/55 pagination, but rebuilt the entire source-centric queue every time:

- cold: 240.2 ms
- warm: 146.2, 141.5, 136.8, 134.7 ms
- review query: 39–50 ms
- candidate query: 6–10 ms
- response: 117,066 bytes in this fixture

Loopback PostgreSQL makes those absolute figures much lower than production, but instrumentation confirmed the production-amplified work boundary: every request transferred/deserialized all 10,512 review payloads, enriched every referenced candidate, grouped/classified/sorted all 5,484 sources, retained fields the browser never consumes, and only then selected 50 items. Production repeated that full operation at 1.5–2.0 seconds.

## Narrow correction

`src/lib/admin-force-curve-queue.ts` now caches the fully classified source queue per Prisma client. Every request first computes a lightweight version fingerprint from review, catalog, and MasterSwitch row counts/max update times. A changed fingerprint rebuilds; an unchanged fingerprint filters and deterministically pages the existing classified truth. Successful review/catalog mutation routes explicitly invalidate the cache as an additional same-process guarantee.

The response projection now emits only fields consumed by `ForceCurveReviewQueue`; internal review payload/workflow data and candidate `exists` flags remain available during classification but are not serialized to the browser.

This preserves:

- exact raw, unique-source, open/resolved, bucket, deferred, filtered, search, and pagination truth;
- the existing actionable/conflict/identity classification and deterministic sort;
- attach, approval, defer, no-match, metadata verification, and same-page refresh behavior;
- strict ADMIN and same-origin mutation gates;
- existing themed/mobile admin UI.

## Instrumented larger-fixture result

Cold server construction after correction:

- fingerprint: 42.21 ms
- review query/deserialization: 109.62 ms (database execution event 46 ms)
- candidate query/deserialization: 35.75 ms (database execution event 13 ms)
- grouping/enrichment/sort: 23.01 ms
- filter/page projection: 0.26 ms
- total: 213.44 ms
- JSON serialization: 0.06 ms
- response: 50,686 bytes

Eight warm server samples were `7.26, 4.23, 4.21, 3.04, 3.47, 3.29, 3.81, 3.24 ms`; nearest-rank p95 was **7.26 ms**, below 750 ms. Every sample returned exact `10512 / 5484 / 2725 / 2725 / 50 / 55` truth. Fingerprint queries were 0–6 ms each; filter/projection was 0.06–0.15 ms. The 50,686-byte response is 70.0% smaller than the observed 169,104-byte production candidate response.

The regression also verifies resolved+bucket+search truth, a single full load across warm requests, and a forced version change causing a full rebuild rather than stale reuse.

## Real optimized-build Chromium

`tests/admin-force-curve-performance.browser.ts` authenticated as the isolated ADMIN against the production build, performed one cold and eight warm full `/admin/force-curves` navigations, then one cold and eight warm authenticated no-store reviews API requests.

- warm route samples: 14.7, 15.8, 20.7, 20.7, 19.9, 12.4, 29.3, 19.9 ms
- warm route p95: **29.3 ms** (`<1 s`)
- warm API samples: 10.2, 10.9, 10.2, 9.7, 9.5, 9.3, 10.1, 7.7 ms
- warm API p95: **10.9 ms** (`<750 ms`)
- every route rendered 50 review articles
- every API response returned exact larger-fixture truth and 50,686 bytes

The separate production-build Master Switch browser regression also passed all nine full navigations at exactly `1 session / 1 submissions / 1 edits`, with the genuine filter change at `0 / 1 / 1`.

## Files changed

- `src/lib/admin-force-curve-queue.ts`
- `src/app/api/admin/force-curves/reviews/route.ts`
- `tests/force-curves.test.ts`
- `tests/admin-force-curve-performance.browser.ts`
- `package.json`

No Master Switch loader, auth provider, origin policy, force-curve mutation implementation, UI component, or database schema was changed.

## Gates

- `npx tsc --noEmit`: PASS.
- Focused force-curve/admin/master loading tests: PASS, 30/30.
- `npm test`: PASS, 79/79.
- `npm run lint`: PASS with established repository warnings only.
- `npm run build`: PASS, optimized Next 15.5.23, 83/83 pages.
- `npm run test:admin-force-curve-browser`: PASS with larger fixture and p95 assertions.
- `npm run test:admin-browser`: PASS with exact request-cardinality assertions.
- `git diff --check` and scoped cached diff check: PASS.

## Cleanup, rollback, and remaining risk

The production-build server was stopped. The dedicated `switchbook_perf_builder_corrective` database was dropped and confirmed absent. No shared or production data was touched.

Rollback is the scoped implementation commit above. In a multi-process deployment each process maintains its own version-validated cache, so each process has an independent cold construction; correctness is retained through the database fingerprint, while warm performance depends on each process receiving at least one request. The current production Compose topology documented in the release evidence is a single app container. Fresh independent QA and controlled production release measurements remain mandatory; no production-after claim is made here.
