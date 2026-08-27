# Corrective independent QA: Prisma P2028

## Verdict

PASS_VERIFIED for commit `48ec8bb52d3c2c6ee54a420c7d31d9e273267e35`.

The assignment named `48ec8bb919e20dba5f49989736faf385a1ad004e`,
which is not an object in this repository. The verified commit is the repository
commit resolving short SHA `48ec8bb`, with subject `Chunk force curve
reconciliation safely`.

## Independent review

- Diff reviewed against production predecessor
  `382d66142cb1002062947219c21c5203bb215837`.
- Catalog ingestion and reconciliation use bounded `chunkSize` interactive
  transactions. Masters and manufacturers are loaded outside the transaction.
- There is no `timeout` or `maxWait` increase.
- Exact matches are staged as `REVIEW_REQUIRED` with run-specific provenance.
  Approved reads include only `AUTO_APPROVED` and `MANUALLY_APPROVED`, so staged
  rows cannot publish.
- The final publish is a short transaction consisting of staged-row discovery,
  set-based mapping promotion, related source-review resolution, the Peach
  Blossom guard, audit counts, and run completion. All approval publication and
  completion occur atomically.
- Staging reuse requires exact provenance equality including `syncRunId`; a
  pre-existing manual, rejected, stale, or unrelated review-required decision is
  immutable to the sync.
- A completed run returns through `reconcileCompletedSyncRun`, which can repair
  derived `reviewCount` only and does not mutate decisions or queue rows.

## Disposable PostgreSQL evidence

Database: dedicated local PostgreSQL 17 database
`switchbook_forcecurve_qa_20260827` (not an application database).

Commands:

```text
DATABASE_URL=postgresql://kennnyshiwa@localhost:5432/switchbook_forcecurve_qa_20260827?schema=public npx prisma migrate deploy
DATABASE_URL=postgresql://kennnyshiwa@localhost:5432/switchbook_forcecurve_qa_20260827?schema=public npm run test:force-curves-db
```

Results:

- All 33 migrations applied successfully.
- DB fixture passed.
- Injected failure after the first reconciliation chunk left the exact mapping
  in `REVIEW_REQUIRED`, returned zero rows from `getApprovedCurves`, and marked
  the run `FAILED`.
- Retry resumed the same run, promoted exactly one mapping to `AUTO_APPROVED`,
  and returned exactly one approved curve.
- Unique exact match, ambiguity, wrong-manufacturer, wrong-technology,
  insufficient-evidence, manual-decision, rejected-decision, rerun-idempotency,
  and completed-algorithm-run cases passed.
- Peach Blossom retained `NO_MATCH`; summary output reported
  `peachApprovedUrls: []`.
- Fixture summary: 12 runs, 5,375 catalog entries, 5,486 review cases.

## Repository gates

- `npx tsc --noEmit`: pass.
- `npm test`: 64/64 pass.
- `npm run lint`: pass with pre-existing warnings only.
- `npm run build`: pass; 83 static pages generated.

## Release note

QA authorizes the verified actual SHA above for the subsequent release gate.
The non-existent long SHA from the assignment must not be used as an image or
deployment identifier.
