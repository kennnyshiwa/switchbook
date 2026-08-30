# Builder evidence — exact Retro Orange identity alias

Assignment: `SWITCHBOOK-FORCE-CURVE-IDENTITY-MATCH-20260830-001`

## Change

- Added one exact, product-scoped canonical identity alias in `src/lib/admin-force-curves.ts`:
  - source/catalog: `80Retros Retro Orange`
  - approved master: `80Retros GAME1989 Orange`
  - required manufacturer: `KTT`
- The same canonical identity is now consumed by:
  - synchronous compatibility annotation and every downstream write gate;
  - bounded authoritative unique resolution;
  - source-name search expansion in the admin MasterSwitch search route.
- Generic ordered-token matching and manufacturer/technology/variant protections were not loosened.
- Search expansion occurs only for the exact source query (or `Retro Orange`) on the exact catalog identity. An unrelated query such as `HMX` is not expanded.

## Regression evidence

- Focused force-curve suite: `29/29` passed.
- Full repository suite: `87/87` passed.
- TypeScript: `npx tsc --noEmit` passed.
- Lint: passed with only pre-existing warnings in unrelated files.
- Exact positive assertions cover search discovery, compatibility annotation, unique authoritative resolution, and canonical target selection.
- Negative assertions cover HMX with the otherwise identical name, Red/White variants, and an added `V2` qualifier. All remain incompatible.
- Unrelated `Gateron Oil King` remains compatible under the existing manufacturer-aware rule.
- A production-shaped database regression was added at `tests/force-curves-retro-orange.db.ts`. It models the immutable high-resolution/raw hashes and revision, the three high-only/raw+high/raw-only review rows, wrong-candidate rejection, and successful three-row attachment to the high-resolution entry.

## Database execution status

The database regression was not executed in this builder environment: `DATABASE_URL` is unset, no PostgreSQL client is present, and Docker did not expose a running isolated container. No live or production database was touched. Independent QA should run `tests/force-curves-retro-orange.db.ts` against its fresh PostgreSQL 17 fixture before PASS_VERIFIED.

## Scope

Changed implementation/test files only:

- `src/lib/admin-force-curves.ts`
- `src/app/api/admin/force-curves/master-switches/route.ts`
- `tests/force-curves.test.ts`
- `tests/force-curves-retro-orange.db.ts`

No commit, push, deploy, or production mutation was performed. Unrelated dirty worktree files were preserved.

## Corrective iteration 1

QA identified database-fixture coverage gaps; implementation behavior was unchanged. `tests/force-curves-retro-orange.db.ts` now proves through the transactional write path that:

- HMX Orange and KTT Red, White, Blue, and Orange V2 are each rejected with `INCOMPATIBLE_IDENTITY`;
- every rejected attempt leaves all three exact-source reviews OPEN/unattached and creates zero mapping rows;
- an unrelated valid Gateron Oil King resolves uniquely, is compatible/enabled, attaches successfully, resolves its review, and creates its approved mapping;
- the exact Retro Orange three-row attachment can be safely repeated and returns the stable replay result without duplicate mapping state;
- the original high-only/raw+high/raw-only production shape, captured hashes, and revision remain intact.

Corrective static verification: focused `29/29`, full `87/87`, TypeScript pass, and targeted diff-check pass. The DB script remains queued for fresh PostgreSQL 17 execution by independent QA because this builder environment has no database endpoint.
