# Builder iteration 3: non-switch artifact exclusion

Date: 2026-08-27  
Scope: local implementation and verification only. No commit, push, deploy, production write, or production container action occurred.

## Corrections

- Added a deterministic exclusion gate before standard-suffix and legacy-allowlist classification. CSV paths are excluded when the path identifies a spring tester/test combination (`spring...test` or `test...spring` within a path segment), or when the filename contains the word `construction`.
- Removed `Keyfirst Bling Green/Keyfirst Bling Green Data Construction.csv` from the audited legacy allowlist.
- Kept the rule narrow: a valid switch containing only `Spring` or only `Tester` remains eligible. Generic CSV discovery remains forbidden.
- Added exact negative fixtures for the Keyfirst construction path, 68 standard-suffix SwitchOddities spring-tester artifacts, a generic spring-tester high-resolution path, and positive controls named `Valid Spring Switch` and `Tester Switch`.
- Replaced the construction row in the PostgreSQL format fixture with the valid audited nonstandard `BSUN Avocado Panda V2.csv` row. Prior zero-catalog reconciliation, revision idempotency, exact hash/revision persistence, and Peach Blossom no-match assertions remain exercised.

## Exact upstream reconciliation

The exact audited tree remained `66cc5aa36208bb33997d3a037137ff60885f5861` (`truncated=false`, 15,029 tree objects). Direct classification and the packaged runner agreed on:

- 5,351 catalog candidates: 2,689 `RAW_DATA`, 2,650 `HIGH_RESOLUTION_RAW`, 12 `NONSTANDARD_REVIEW`.
- 2,729 measurement groups/source reviews.
- Zero admitted spring-tester paths and zero admitted construction paths.

Independent QA iteration 2 observed 5,420 candidates and 2,798 reviews. The exact delta is 69 candidates and 69 groups: 68 standard-suffix objects under `SwitchOddities Spring Testers` plus the single Keyfirst construction artifact. All were standalone measurement groups. The prior builder expectation of 2,795 reviews was superseded by QA's independently reproduced 2,798 baseline; subtracting the 69 invalid groups yields the observed 2,729.

The bundled `dist/sync-force-curves.cjs` was executed twice against a fresh disposable PostgreSQL 17 database while GitHub `main` resolved to the exact audited SHA. First execution completed with `cursor=afterCount=newCount=5351`, `reviewCount=2729`, `errorCount=0`, approved mappings `0`. The second returned the identical sync-run ID and identical counts. Database audit: one run, 5,351 extant catalog rows, 2,729 open reviews, zero approved mappings, zero spring-tester rows, zero construction rows.

## Gates

- `npm test`: PASS, 59/59.
- Fresh PostgreSQL 17 database, `npx prisma migrate deploy`: PASS, all 33 migrations.
- `DATABASE_URL=postgresql://kennnyshiwa@localhost/sb_fc_format_fix3_fixture npm run test:force-curves-db`: PASS (`runs=7`, `catalog=10`, `reviews=11`, `peachApprovedUrls=[]`).
- Repeated `npx prisma migrate deploy`: PASS/no pending migrations; `prisma migrate status`: schema up to date.
- Exact-revision packaged runner twice: PASS/idempotent with the counts above.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with pre-existing warnings only.
- `npm run build`: PASS, 82 pages.
- `npm run build:force-curves-sync`: PASS, 13.5 KB CommonJS bundle.
- `git diff --check`: PASS.

## Files changed in this iteration

- `src/lib/force-curves.ts`
- `tests/force-curves.test.ts`
- `tests/force-curves.db.ts`
- this evidence file

Unrelated dirty worktree files were not modified. Disposable local databases only were created for verification.
