# Builder correction — preserve distinct automatic measurements

Workboard: `3d5b14f9-0b0b-41c1-b964-0a496ef9aedd`
Date: 2026-08-30

## Root cause

`linkSourceReviewGroup` loaded every other `AUTO_APPROVED` mapping for the selected MasterSwitch and marked all of them `STALE`, regardless of measurement identity. A manual decision for one measurement therefore destroyed otherwise compatible, independently measured automatic siblings.

## Correction

Automatic supersession is now source-measurement scoped:

- derive the selected source identity through the existing `sourceIdentity` group invariant;
- derive an automatic mapping identity from its sync provenance `measurementKey`;
- use catalog-folder identity only for legacy mappings that lack structured provenance;
- stale another automatic mapping only when its identity exactly equals the selected source identity;
- preserve distinct or unknown-identity automatic siblings (fail closed against data loss);
- retain the existing selected mapping upsert, no-match deletion, row locks, source-group completeness, compatibility checks, conflict checks, replay behavior, audit payload, and transaction atomicity unchanged.

## DB-backed evidence

`tests/force-curves-override.db.ts` now creates:

- one pre-existing automatic sibling with a distinct measurement key, which remains `AUTO_APPROVED` after six manual assignments;
- one automatic candidate with the exact first manual group measurement key, which becomes `STALE` with the existing supersession reason;
- six distinct manually approved measurement groups, all retained alongside the automatic sibling (seven approved curves total);
- replay/audit immutability checks for the first assignment;
- wrong-target replay rejection;
- mixed-source rejection with before/after review and mapping snapshots proving group atomicity.

Both DB fixtures ran against a fresh temporary PostgreSQL 17 database with all migrations applied; the instance was stopped and removed after the run. No production database was accessed.

## Verification

- `npx tsx tests/force-curves-override.db.ts` — PASS on isolated PostgreSQL 17.
- `npm run test:force-curves-db` — PASS on isolated PostgreSQL 17; `runs=14`, `catalog=5388`, `reviews=5504`, `peachApprovedUrls=[]`.
- `npm test` — PASS, 107/107.
- `npx tsc --noEmit` — PASS.
- `npm run build` — PASS; compile and typecheck successful, 84 pages generated.
- `git diff --check` — PASS.

## Rollback and risk

Rollback reverts the two code/test files. There is no schema or data migration. The narrow risk is legacy automatic mappings whose plain-text provenance and catalog folder do not prove same-measurement identity: they are deliberately preserved rather than staled. This favors retaining a potentially duplicate visible curve over silently deleting a legitimate distinct measurement; a later reviewed choice can resolve it with explicit evidence.

No production mutation, push, or deploy was performed.
