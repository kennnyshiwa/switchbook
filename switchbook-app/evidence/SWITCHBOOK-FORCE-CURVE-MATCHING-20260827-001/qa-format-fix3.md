# Independent QA iteration 3: non-switch artifact exclusion

Date: 2026-08-27  
Verdict: **PASS_VERIFIED**

No commit, push, deploy, production write, or production container action occurred. QA used two disposable local PostgreSQL 17 databases and the public immutable upstream Git tree.

## Exact upstream classifier audit

At exact revision `66cc5aa36208bb33997d3a037137ff60885f5861`, GitHub returned the same SHA, `truncated=false`, and 15,029 tree objects. Independent direct classification produced exactly:

- 5,351 candidates: 2,689 `RAW_DATA`, 2,650 `HIGH_RESOLUTION_RAW`, 12 `NONSTANDARD_REVIEW`.
- Zero admitted paths under `SwitchOddities Spring Testers`.
- Zero admitted construction CSVs.
- Delta from independently reproduced iteration-2 baseline: `5,420 - 5,351 = 69`, exactly the 68 spring-tester artifacts plus one Keyfirst construction artifact.
- The upstream result retains 13 valid candidates whose names contain `Spring` without `Test` (samples include Kailh Box Spring and Kailh Choc Spring). The regression fixture also proves a switch containing only `Tester` remains admitted; only combined spring/test semantics are excluded.

The exclusion is evaluated before suffix/allowlist admission. Generic CSV matching was not broadened, and the construction export is absent from the review-only allowlist.

## Packaged sync, idempotency, and persisted audit

On fresh disposable PostgreSQL database `sb_fc_qa_fix3_live_20260827`, all 33 migrations applied successfully. `dist/sync-force-curves.cjs` was rebuilt, then executed twice while upstream `main` resolved to the exact audited SHA.

First execution:

- One `COMPLETED` run, cursor/after/new `5351`, before `0`, changed/stale `0`, reviews `2729`, errors `0`.
- 5,351 extant catalog rows with the exact 2,689/2,650/12 format breakdown.
- 2,729 open source reviews: 2,717 `SOURCE_UNVERIFIED`, 12 `SOURCE_NONSTANDARD`.
- Zero verified-metadata catalog entries and zero mappings of any state, therefore zero automatic approvals without verified metadata.
- Zero duplicate source/path identities, zero duplicate review IDs, zero spring-tester rows, and zero construction rows.

Second execution returned the identical run ID, timestamps, cursor, and counts. The database retained one sync run, 5,351 catalog rows, and 2,729 reviews: no duplicate explosion and no errors. Repeated `prisma migrate deploy` reported no pending migrations; `prisma migrate status` reported the schema up to date.

## PostgreSQL functional and reconciliation fixture

On separate fresh database `sb_fc_qa_fix3_fixture_20260827`:

- All 33 migrations applied from scratch.
- `npm run test:force-curves-db`: PASS (`runs=7`, `catalog=10`, `reviews=11`, `peachApprovedUrls=[]`).
- The fixture independently exercises interrupted-run resume, same-revision no-op, incremental revision reuse, exact path/hash/revision persistence, high-resolution-first grouped reviews, nonstandard review, feedback transition, manual-decision precedence, and source-centric reconciliation.
- All three fixture `UNMATCHED` cases were retained as audit history and resolved to `NO_MATCH`; zero remained open.
- KTT Peach Blossom `cmqo21sm103vknu3vh0tjs75x` had zero approved mappings and retained its durable `NO_MATCH` row.
- Repeated migration deploy was a no-op and migration status was current.

## Project gates

- `npm test`: PASS, 59/59.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with pre-existing warnings only.
- `npm run build`: PASS, 82 pages.
- `npm run build:force-curves-sync`: PASS, 13.5 KB CommonJS bundle.
- `git diff --check`: PASS.

## Verdict

**PASS_VERIFIED.** The iteration-2 release blocker is corrected. Exact immutable-source classification, both packaged sync executions, PostgreSQL migration/fixture gates, reconciliation, fail-closed approval behavior, Peach Blossom regression, and all project gates pass independently. This verdict authorizes the owner to proceed to the separately controlled release workflow; it does not itself authorize or perform commit, push, or deployment.
