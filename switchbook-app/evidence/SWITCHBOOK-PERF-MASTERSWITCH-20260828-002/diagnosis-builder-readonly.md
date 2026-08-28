# Builder read-only diagnosis

Date: 2026-08-28
Assignment: `SWITCHBOOK-PERF-MASTERSWITCH-20260828-002`
Released SHA inspected: `a2f5442626d08ae8eda028f65389c81e65e957f2`
Target: `https://switchbook.app` and the released source at that SHA
Scope: read-only diagnosis only; no implementation, database, container, deployment, or production record was changed.

## Result

The attach failure is reproduced and its root cause is confirmed in the released proxy/server/source combination. The mutation guard compares browser `Origin: https://switchbook.app` with `request.nextUrl.origin`. The standalone production image fixes `HOSTNAME=0.0.0.0` and `PORT=3000`; Next 15.5.23 constructs its internal absolute request URL from that configured hostname and port. With nginx's forwarded HTTPS protocol, the server-computed origin is therefore `https://0.0.0.0:3000`, not the public origin. Every legitimate browser write fails the equality check before request-body validation.

The main performance defect is `/admin/force-curves`: the API materializes the entire 2,729-source queue, serializes 21,395,407 bytes of JSON, and has a warm p95 of 11.182 s. The page embeds substantially the same queue into its React Server Component response (about 1.109 MB compressed navigation transfer) and warm page load p95 is 11.271 s. `/admin/master-switches` has a separate client waterfall/repetition problem: initial auth state changes cause two session requests and two complete pairs of master-submission/edit requests before its spinner clears. Its warm user-visible p95 is 3.139 s although warm document load p95 is only 0.178 s. `/admin` itself is not a material bottleneck in this run (warm load p95 0.294 s).

## Safe authenticated attach reproduction

The existing managed `openclaw` browser profile already held a legitimate production admin session. A read-only session check returned HTTP 200 and role `ADMIN`. The probe deliberately used an invalid strict-schema body (`{}`), so a correctly accepted same-origin request would stop at HTTP 400 `Invalid link request` before any database function could run.

Observed request and response:

```text
Page URL:              https://switchbook.app/admin/force-curves
Browser document origin: https://switchbook.app
Method:                PUT
URL:                   https://switchbook.app/api/admin/force-curves/reviews
Credentials mode:      include (existing legitimate Auth.js session)
Content-Type:          application/json
Body:                  {}
Origin:                https://switchbook.app (browser-generated forbidden header)
External Host:         switchbook.app
Status:                403
Body:                  {"error":"Same-origin request required"}
Browser elapsed:       96.6 ms
```

The released nginx app location (`nginx/conf.d/default.conf:124-136`) proxies to `http://app:3000` and supplies:

```text
Host: switchbook.app
X-Forwarded-Host: switchbook.app
X-Forwarded-Proto: https
X-Forwarded-Port: 443
```

The released container fixes `HOSTNAME="0.0.0.0"` and `PORT=3000` (`Dockerfile:59-60`) and launches the standalone `server.js`. Next's released server code (`node_modules/next/dist/server/next-server.js:1310-1313`) builds `initURL` as `${protocol}://${fetchHostname}:${port}${req.url}` whenever configured hostname and port exist. Thus the exact server-computed `request.nextUrl.origin` is:

```text
https://0.0.0.0:3000
```

Released guard (`src/lib/admin-force-curves.ts:23-27`):

```ts
return new URL(origin).origin === request.nextUrl.origin
```

The mismatch is deterministic:

```text
https://switchbook.app !== https://0.0.0.0:3000
```

The guard runs after authenticated-admin verification but before `request.json()` and strict schema parsing (`src/app/api/admin/force-curves/reviews/route.ts:24-29, 40-47`). The observed 403 instead of the mutation-safe expected 400 proves the origin check is the failing branch. No link function or Prisma mutation was reached.

## Live route baseline

Method: managed Chromium, same authenticated admin profile, full document navigations. One unique-query first observation is reported as cold; eight subsequent canonical-URL observations form the warm sample. p95 uses nearest-rank over the eight warm samples. `user-visible` for Master Switches is `performance.now()` when its visible `.animate-spin` loading state disappeared. Server pages use Navigation Timing `loadEventEnd`; force-curves also reports `DOMContentLoaded`. Browser/tool orchestration overhead is excluded except from the explicitly spinner-based value.

| Route | First observed/cold | Warm samples (ms) | Warm p95 | Decomposition |
|---|---:|---|---:|---|
| `/admin/master-switches` | spinner clear 2,310.6 | 2,132.5, 2,135.5, 2,281.2, 2,096.3, 2,252.9, 2,600.6, 2,383.5, 3,139.4 | **3,139.4 ms** | warm document load p95 178.1 ms; duplicated client API work dominates |
| `/admin` | load 231.0 | 293.6, 227.6, 230.3, 218.2, 223.6, 202.3, 222.9, 202.0 | **293.6 ms** | server TTFB warm p95 105.3 ms; no material page bottleneck |
| `/admin/force-curves` | load 11,858.8 | 9,969.9, 10,001.2, 10,464.2, 9,586.3, 9,872.4, 9,843.0, 9,807.5, 11,270.5 | **11,270.5 ms** | warm TTFB p95 148.8 ms (stream starts quickly); warm DOMContentLoaded p95 11,254.3 ms; about 1.109 MB compressed navigation transfer |

The baseline misses the assignment target (`<1s` warm transition) on Master Switches and Force Curves. `/admin` meets it.

## Live API/server decomposition

### Force-curve reviews

Eight authenticated, read-only `GET /api/admin/force-curves/reviews` calls with `cache: no-store` returned HTTP 200 and exactly 21,395,407 response bytes each.

```text
response-header/TTFB approximation ms:
10769.3, 9294.1, 9029.6, 9329.7, 8832.0, 9049.5, 9376.8, 9641.6

complete body ms:
11182.4, 9619.2, 9307.8, 9850.1, 9079.8, 9384.5, 9612.2, 10061.2
```

Nearest-rank warm p95 is **11,182.4 ms complete** (and 10,769.3 ms to response resolution), far over the `<750ms` API target. Network body consumption adds roughly 0.25-0.52 s; the approximately 8.8-10.8 s before response resolution is server query/materialization/CPU/serialization time.

Released query/CPU shape explains it:

1. Both page and API select **all** review cases, ordered oldest-first, with related master/catalog (the API also includes feedback); there is no status filter, pagination, projection to visible fields, or `take` (`src/app/admin/force-curves/page.tsx:12-15`, `src/app/api/admin/force-curves/reviews/route.ts:34`).
2. Both then select all extant candidate rows referenced by payload IDs (`page.tsx:16-17`, `reviews/route.ts:35-36`).
3. Both enrich every review using `reviews.map(... candidates.filter(...))`, an O(review rows × candidate rows) scan (`page.tsx:18-22`, `reviews/route.ts:37`).
4. `buildReviewQueue` groups and sorts all sources, and the complete result is serialized into either initial RSC props or API JSON even though the client renders only `items.slice(0, visibleLimit)` with `visibleLimit=100` (`src/components/admin/ForceCurveReviewQueue.tsx:20, 121`). UI-only limiting therefore saves DOM nodes but not database, server CPU, serialization, network, JSON parse, or initial hydration work.
5. Every successful mutation calls `refreshQueue()` and re-downloads/rebuilds the same entire 21.4 MB API representation before updating UI (`ForceCurveReviewQueue.tsx:25-30, 32-47, 82-99`). This will make even a repaired attach feel stalled after persistence.

Direct production/query instrumentation was not available in this read-only builder shell: SSH keys were unavailable and `.env.local` points to an inactive local port `localhost:55432`. The live TTFB/body split plus released query shape is sufficient to locate the dominant server path, but exact PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` numbers remain an ops/fixture follow-up rather than fabricated evidence.

### Master Switches

Each observed navigation made two `/api/auth/session` calls and two calls apiece to:

```text
/api/admin/master-switches?status=pending
/api/admin/master-switch-edits?status=pending
```

The second warm pairs completed as late as 828.8 ms and 821.9 ms respectively; relevant observed API p95 is **828.8 ms**, slightly over the `<750ms` target. Responses were small (roughly 2.0 KB transfer for submissions and 1.3 KB for edits), so response size is not the cause.

Released source cause: `useSession()` begins in loading state, then the effect runs when auth resolves; its dependency set includes the session/status plus both fetch callbacks (`src/app/admin/master-switches/page.tsx:46, 82-93`). The production trace proves two complete fetch sequences occur. The page holds the full-screen spinner until `Promise.all` for the active sequence finishes. The API routes also fetch complete records (`include` plus all scalar/JSON columns) without pagination or `take`, but the pending result is currently small; the duplicated auth/API lifecycle is the immediate measured bottleneck.

### Admin dashboard

The server executes six independent reads in parallel, then a seventh top-collectors aggregation sequentially (`src/app/admin/page.tsx:14-52`). Live warm navigation remained 0.202-0.294 s and is below both targets. It is not the priority optimization surface from this evidence.

## Smallest durable implementation direction for owner handoff

No implementation change was made. The evidence supports the following bounded repair direction:

1. Origin correctness: compare the parsed browser Origin against a trusted public origin reconstructed from validated proxy `X-Forwarded-Host`/`Host` plus `X-Forwarded-Proto`, or against a canonical configured application origin. Preserve exact scheme/host/port comparison, reject missing/malformed Origin, and explicitly test legitimate proxy headers plus forged host/proto, missing Origin, cross-origin, and anonymous/non-admin cases. Comparing against `request.nextUrl.origin` is invalid in this standalone deployment.
2. Force-curves performance: server-side paginate/filter the source-centric queue, return only fields needed for the visible page, replace per-review candidate filtering with an ID map, and have attach return/update the affected item (or fetch a small page) instead of downloading the entire queue. Measure DB queries independently on a production-shaped fixture and retain deterministic queue counts separately from page payload.
3. Master Switches performance: make auth gating and data loading single-shot, remove the duplicate request sequence, select only displayed fields, and add pagination/limits before pending history grows.

## Safety, preservation, and remaining risk

- The only state-changing-method probe used an invalid body and was rejected by the origin guard before parsing or Prisma calls.
- All other live requests were GET/navigation requests.
- No production control was clicked, no database or deployment command ran, and no production record changed.
- Existing dirty work listed in `intake-git-status.txt` was preserved. The only assignment output is this diagnosis file.
- iOS parity is **N/A**: these are authenticated admin-only web routes; mobile web timing/behavior should still be covered by independent QA after implementation.
- Remaining evidence gap: per-query PostgreSQL timing/plan on a production-shaped read-only fixture. It is required to decide indexes versus payload/algorithm work, though the current 21.4 MB response and O(R×C) enrichment are already independently actionable.
