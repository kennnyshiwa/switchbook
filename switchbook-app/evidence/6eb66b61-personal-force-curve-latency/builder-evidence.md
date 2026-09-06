# Builder evidence — Personal Collections force-curve initial render

Workboard: `6eb66b61-5c81-47bb-9f1e-4a39588cbae9`

Base: `ac015fb0c33ecdaa9af40ce60f59f7a6d2c0b56e`

## Root cause

Personal Collections started with an empty client cache. After hydration it fetched `/api/force-curve-cache`, then POSTed `/api/force-curve-batch-check` for misses. Every visible `ForceCurvesButton` separately fetched `/api/force-curves/:masterSwitchId` before becoming visible. The exact resolver's cold metadata request has a 5,000 ms timeout. Master Database already includes availability in its initial payload, so it had no equivalent waterfall.

## Change

- Dashboard loads all linked masters' canonical approved mappings in one query.
- The existing exact SwitchesDB inventory and projection remain authoritative; tied, missing, unsafe, colliding, or unavailable identities still fail closed.
- Exact curve arrays, including explicit empty arrays, are serialized with the initial dashboard response.
- Grid and table cards initialize `ForceCurvesButton` from those records. The Personal Collections mount performs no availability or detail fetch.
- Other surfaces retain the existing GET fallback. No mutation route, schema, admin workflow, preference, one/multi behavior, provenance, or overlay behavior changed.

## Timing and request evidence

- Live SwitchesDB metadata fetch during diagnosis: `152 ms`, HTTP 200, 158,079 bytes.
- Mobile browser (`390×844`): preloaded trigger available in a test lasting `225.5 ms`, while every legacy API route was deliberately delayed 5,000 ms; zero legacy requests occurred.
- Desktop browser (`1440×900`): preloaded trigger test lasted `203.8 ms`; zero force-curve API requests occurred.
- Batched loader test: duplicate/multiple master IDs produce exactly one `forceCurveMapping.findMany` call and preserve explicit empty results.
- Initial client request count changed from `2 + N` force-curve requests to `0`; server cost is one bounded mapping query plus the existing cached inventory read/fetch in parallel.
- Browser overlay remained exact and GET-only; no POST/PUT/PATCH/DELETE requests were observed.

## Verification

- `npx tsx --test tests/collection-force-curves.test.ts`: 3/3 PASS
- `npx tsx --test tests/force-curve-surfaces.browser.ts`: 4/4 PASS
- `npm test`: 120/120 PASS
- `npx tsc --noEmit`: PASS
- `npm run lint`: PASS with pre-existing warnings only
- `npm run build`: PASS with pre-existing Edge/image warnings only
- `git diff --check`: PASS

## Rollback

Revert this scoped commit. The existing force-curve API routes remain available, so rollback restores the prior client waterfall without a data or schema migration.

No production data, deployment, push, or primary/partner worktree mutation occurred.
