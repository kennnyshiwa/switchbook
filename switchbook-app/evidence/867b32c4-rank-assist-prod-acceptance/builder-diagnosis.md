# Rank-assist production acceptance diagnosis

Workboard: `867b32c4-c817-4104-b5e7-cd0673b65883`  
Date: 2026-08-30  
Scope: authenticated read-only production reproduction and local source diagnosis; separate from multi-curves work

## Verdict

**Reproduced: the feature is enabled and functional, but the default production route deterministically presents as if it has no suggestions. The acceptance failure is a discoverability/client-projection defect, not a disabled runtime flag or a broken suggestion API.**

On the exact authenticated route `https://switchbook.app/admin/force-curves?qaRankAssist=867b32c4`, rank-assist instructions and deterministic queue-class labels render, proving the server page passed `rankAssistEnabled=true` through SSR/hydration. The page shows 50 open source groups but zero suggestion panels. Its lazy client effect queries only the active card and one lookahead card; both alphabetically first groups have no unique exact/boundary match, so both endpoint calls return a valid null result. The UI renders no loading, enabled, scanned/no-match, exclusion, or “find next” state. A reviewer therefore sees no suggestion surface even though deterministic suggestions exist later on the same page.

Filtering the unchanged production page to `AEBoards Naevy EC` produced five source-group cards and two visible `rank-v1` suggestion panels, proving the API, auth session, client component, ranking code, and flag-on path work when a reviewer already knows a covered identity to search for.

No production mutation request was issued. Counts before and after read-only filtering remained based on the same queue projection; no review decision, mapping, flag, container, account, configuration, or database row was changed.

## Production evidence

Authenticated role and route:

- `/api/auth/session` returned HTTP 200 and role `ADMIN` (no PII retained).
- Route: `/admin/force-curves?qaRankAssist=867b32c4`.
- SSR/hydrated page copy: `Rank assist is advisory: j/k moves, a/d/n stages an action, Enter confirms, and Escape clears. No shortcut writes immediately.`
- Card labels use `deterministic queue class ...`, which is rendered only when the page prop is enabled.

Unfiltered/default view:

- Unique sources: 5,484.
- Open sources: 2,717.
- Resolved sources: 2,767.
- Actionable: 0.
- Deferred: 0.
- Rendered page: 50 of 2,717 open groups.
- Rendered suggestion panels: **0**.
- First groups: `91 Corn V2`, `91 Popcorn V2`, `A Switch With No Good Name`, then AEBoards groups.
- The only initial suggestion calls targeted the first two groups. Both returned HTTP 200 with `{ suggestion: null, exclusion: "NO_UNIQUE_EXACT_OR_BOUNDARY_MATCH" }`.

Covered-identity control:

- Read-only search `AEBoards Naevy EC` returned 5 of 5 groups.
- Two suggestion panels became visible without navigation or mutation.
- Both displayed `Ranked suggestion: Tecsee AEboards Naevy EC`, `Algorithm rank-v1`, and the explicit non-probability copy.

Owner's independent authenticated reproduction corroborated the same failure at mobile width 390×844: the first source card did not begin until y=792 and no suggestion node was present above it. A read-only pass over all 50 page-one candidate endpoints found 16 deterministic suggestions, but none in the first three groups. This confirms that coverage exists on the loaded page while active+one-lookahead and non-suggestion-ranked ordering make it undiscoverable. The visible `Actionable: 0` is the pre-existing queue classifier, not a rank-assist coverage count.

Runtime container flag:

- Direct container inspection could not be repeated from this builder session because the production SSH host rejected the available key (`Permission denied (publickey)`).
- Runtime semantics are nevertheless evidenced end-to-end: `src/app/admin/force-curves/page.tsx` passes true only for the exact string `FORCE_CURVE_RANK_ASSIST_ENABLED === 'true'`, and the production SSR/hydrated output renders the enabled-only instructions, focusable-card behavior, and deterministic label. The endpoint also requires the same exact flag and returned 200 rather than its flag-off 404. These two independent runtime consumers agree the flag is exactly enabled in the running app.

## Exact implementation path

1. `src/app/admin/force-curves/page.tsx` is an authenticated dynamic server page (`auth()` plus Prisma queue load). It passes `process.env.FORCE_CURVE_RANK_ASSIST_ENABLED === 'true'` to the client component. This is runtime server evaluation, not a `NEXT_PUBLIC_` build-time client substitution.
2. `src/components/admin/ForceCurveReviewQueue.tsx` defaults the prop false, but production receives true. The enabled effect selects only `queue.items.slice(activeIndex, activeIndex + 2)`.
3. For each of those two items, the client chooses the primary evidence row and its selected/first catalog candidate, then performs one suggestion GET.
4. `src/app/api/admin/force-curves/suggestions/route.ts` independently checks the exact same server flag, authenticates ADMIN, loads one existing ThereminGoat catalog entry, performs a bounded approved-master query (101 rows), and returns one unique deterministic result or null/exclusion.
5. `src/lib/admin-force-curve-suggestions.ts` fails closed on overflow, ties, or no unique exact/full-boundary identity. That behavior is correct.
6. The component renders a panel only when `suggestion` is truthy. Null, loading, request failure, flag-off, and not-yet-scanned are visually indistinguishable.

## Root causes

### Primary: covered results are undiscoverable from the default ordering

The queue sorts actionable/confidence first and then alphabetically by derived `sourceKey`. Production currently has zero actionable groups, so alphabetical order dominates. Rank-assist coverage is not part of queue ordering. The client probes only two groups. If those two validly return null, it stops. The first known covered AEBoards group is fourth in the default page, outside the initial two-item window, and no UI tells the reviewer that covered suggestions exist later.

This is deterministic, not timing-related: the same default data/order and two-item window produce zero panels on every fresh visit.

### Secondary: null/loading/error/not-scanned collapse into one invisible state

`suggestions` stores `Suggestion | null`; the UI checks only `rankAssistEnabled && suggestion`. There is no explicit request state or exclusion rendering. A 200 null, 404 flag-off, 403 auth error, network failure, and a group never queried all look identical at card level. This made production acceptance diagnose a functioning feature as absent.

### Secondary: client cache identity is incomplete and failures are sticky

The in-memory suggestion cache is keyed only by `sourceKey`, while a request is determined by the chosen `catalogEntryId`. If a queue refresh changes a group's primary catalog candidate but preserves `sourceKey`, the old suggestion/null remains. Errors are also converted to null and never retried during the mounted session. This was not required to reproduce the current failure, but it is a real cache/session correctness defect adjacent to acceptance.

### Group-level claim is narrower than the implementation

The endpoint ranks a single chosen catalog entry, not the complete source-group projection. The source-group write gate still revalidates completeness and compatibility, so safety is preserved, but the assist UI can neither explain sibling-evidence exclusions nor proactively identify which groups are covered. The current production label “rank assist” is therefore accurate only as candidate assist, not a page-level ranked queue.

## Minimal correction proposed

Keep the ranking algorithm, API, write paths, grouping, and fail-closed gates unchanged. Correct only client discoverability and cache semantics:

1. Represent request state explicitly per `sourceKey + catalogEntryId`: `idle | loading | match | none | error`, preserving the API exclusion string.
2. Add an above-fold rank-assist status strip when enabled: `Rank assist enabled`, current page scan count, match count, and a `Find next suggestion` control.
3. `Find next suggestion` scans forward from the active card with bounded concurrency (two) and a hard current-page limit, stopping/focusing on the first match. It issues GETs only and never stages or writes.
4. Show compact active-card states (`Checking…`, `No deterministic suggestion`, or retryable error) so flag/API failures cannot masquerade as no coverage.
5. Key cached results by both source and catalog identity; allow explicit retry after errors. Preserve lazy initial active+lookahead behavior and the existing 101-row server cap.

This is smaller and safer than server-side ranking all 50 groups, changing global queue order, or increasing unconditional fanout. No schema, Prisma, mutation route, ranking threshold, probability, or production-data change is needed.

## Tests required before handoff

- Default enabled view visibly identifies rank assist even when the first two results are null.
- Null and error are distinguishable; error can retry.
- Find-next scans only GET endpoints, stops at first match, focuses that group, and respects the page bound/concurrency limit.
- Cache key includes catalog ID; changing the primary catalog causes a new request.
- Flag-off preserves the original queue and makes no suggestion request.
- Existing keyboard staging remains zero-write until deliberate confirmation.
- Existing ranker/route fail-closed tests remain green.
- Production-cardinality browser test asserts no unbounded fanout.

## Data preservation / rollback

The proposed correction is client-only and read-only until the existing explicit confirmation flow. Rollback is the existing feature flag off or reverting the client change. No data rollback is needed. Production queue counts recorded above are the preservation baseline for later QA.

## Local correction prepared after diagnosis

The deterministic diagnosis above was persisted before product editing. A minimal uncommitted local correction was then prepared in exactly two product/test files:

- `src/components/admin/ForceCurveReviewQueue.tsx`
  - explicit `loading | match | none | error` state;
  - cache identity includes the selected catalog entry ID;
  - above-fold `Rank assist enabled` status with checked/match counts;
  - bounded current-page `Find next suggestion` scan that uses only the existing GET endpoint and focuses the first match;
  - visible active-card loading/no-match/error states and an explicit retry;
  - confirmed attach additionally rejects a cached suggestion whose catalog identity is stale.
- `tests/admin-force-curve-suggestions.test.ts`
  - enabled/no-initial-match discoverability contract;
  - bounded loaded-page scan contract;
  - catalog-aware cache contract;
  - GET-only find-next/no mutation-method contract;
  - error retry contract.

No API, ranking algorithm, server feature flag, mutation function, schema, migration, or production file/state was changed.

Verification:

- `npx tsx --test tests/admin-force-curve-suggestions.test.ts` — PASS, 11/11, including first-eligible-later, no-suggestion, focus, and responsive-layout contracts.
- `npx tsc --noEmit` — PASS.
- `npm test` — PASS, 107/107.
- `npm run lint` — PASS with pre-existing unrelated warnings only.
- `npm run build` — PASS; compiled/typechecked and emitted the dynamic admin page and suggestion route.
- `git diff --check` — PASS.

Repository status: base/working HEAD remains `1912367222e0b9a565591db29e4905c7f6a2aeb4`; correction is intentionally **uncommitted**. No commit SHA was created, no push or deploy occurred, and unrelated dirty-worktree changes were not touched.
