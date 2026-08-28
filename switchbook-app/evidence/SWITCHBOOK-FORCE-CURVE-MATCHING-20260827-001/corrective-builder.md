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

## Second corrective iteration

Production evidence from release `4c014d4` localized the remaining P2028 to a
nominal 50-group transaction that still executed multiple sequential queries for
every group. It expired at 5,002 ms and leaked 18 `REVIEW_REQUIRED` mappings and
230 new open outcome reviews before rollback.

The replacement introduces `ForceCurveSyncStage`, a private run-owned table.
Reconciliation is now pure in-memory classification followed by bounded
`createMany(..., skipDuplicates)` stage writes. Neither mappings nor the open
review queue changes before publish. The final transaction uses four set-based
SQL statements to insert mappings, adopt legacy partial staging from the failed
release, insert only missing open reviews, and resolve source reviews for exact
matches. Indexed anti-joins safely reuse the already-partial production queue.
Run completion, audit counts, and Peach Blossom's durable `NO_MATCH` remain in
the same atomic transaction. No timeout was increased.

The production-shaped DB fixture now injects failure after three chunks of the
5,351-blob/2,729-group input, asserts mappings and open reviews are byte-for-byte
unchanged, verifies 300 private staged outputs, resumes, and verifies a repeated
rerun is idempotent. The smaller exact-match fixture makes the same visibility
assertion. Independent QA must run this DB suite against disposable PostgreSQL,
including migration application and transaction timing.

## Legacy staging recovery correction

Independent QA found that a `REVIEW_REQUIRED` mapping left by the first failed
corrective release was promoted, but its source review remained open: the legacy
mapping suppressed a new mapping-stage row, while source-review resolution joins
only mapping-stage catalog IDs. Reconciliation now parses provenance as JSON and
emits a mapping-stage marker only when the existing row is `REVIEW_REQUIRED` and
its exact `syncRunId` belongs to the current run. Unrelated manual or malformed
provenance remains immutable. The final set-based resolution therefore includes
the adopted catalog ID without broadening its update predicate.

The DB regression constructs this precise leftover state and asserts one mapping
becomes `AUTO_APPROVED`, its existing source review becomes `RESOLVED`, no review
is duplicated, and the completed run records `reviewCount=0`.
