# Corrective builder evidence: Prisma P2028

## Diagnosis

`syncForceCurveCatalog` reconciled every measurement group, including multiple
queries per group, inside one default-timeout interactive transaction. The
production-shaped input contains 2,729 groups, so this transaction exceeded
Prisma's default five-second interactive transaction lifetime and raised P2028.

## Correction

- Reconciliation is split into bounded `chunkSize` interactive transactions.
- Exact matches are written as private `REVIEW_REQUIRED` staging mappings tagged
  with the sync run ID. Approved reads exclude these rows.
- One short final transaction promotes only that run's staging rows, resolves
  their source reviews, preserves the Peach Blossom `NO_MATCH`, computes audit
  counts, and marks the run completed.
- A failed run retains resumable staging state but cannot expose a partial set of
  auto-approved mappings. Retry recognizes only its own exact staging provenance.
- No transaction timeout was increased.

## Verification

- `npx tsc --noEmit`: pass
- `npm test`: 64/64 pass
- `npm run lint`: pass, pre-existing warnings only
- `npm run build`: pass
- Added DB fixture injects failure after a reconciliation chunk, verifies the
  staged mapping is invisible through `getApprovedCurves`, resumes the same run,
  and verifies exactly one final auto-approval.
- The DB fixture was not executed in this shell because no disposable
  `DATABASE_URL` was available; direct invocation failed closed before mutation.
  Independent QA must run it against its disposable PostgreSQL fixture.

## Rollback

Revert the corrective commit and rebuild/deploy the prior exact SHA. No schema or
migration changes are introduced. Failed runs may leave `REVIEW_REQUIRED` rows
whose provenance contains their `syncRunId`; these are invisible to public
approved reads and can be retained for retry or removed only after an audited
rollback decision.
