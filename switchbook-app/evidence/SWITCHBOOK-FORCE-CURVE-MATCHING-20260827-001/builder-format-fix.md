# Builder iteration 2: upstream format and queue reconciliation fix

Date: 2026-08-27
Scope: local implementation and verification only. No commit, push, deploy, production database write, or container lifecycle action occurred.

## Implementation

- Replaced the obsolete `TG.csv` discovery filter with deterministic catalog discovery for the exact case-sensitive ` Raw Data CSV.csv` and `_HighResolutionRaw.csv` formats at upstream revision `66cc5aa36208bb33997d3a037137ff60885f5861`.
- Added an exact 13-path review-only allowlist for audited legacy/nonstandard switch CSVs. Arbitrary CSVs and the two known spring-tester files are excluded.
- Preserved immutable identity as source plus exact repository-relative path, with upstream tree blob SHA in `contentHash` and the unsuffixed Git revision in `revision`.
- Grouped ordinary/high-resolution representations by parent directory plus a normalized measurement stem. High-resolution is deterministically first in review payloads; distinct sample/color/actuation stems remain separate groups and multiple catalog rows remain available for manual approval.
- Required `metadataVerifiedAt`, manufacturer equality, technology equality, and exact normalized identity before any auto-approval. Upstream rows contain no trusted metadata, so the initial production result is deliberately review-only.
- Changed the runner idempotency key to `<git revision>:formats-v2`, while catalog rows retain the exact Git revision. This permits correction of the already-completed zero-catalog production run without editing Prisma history.
- Replaced per-master empty-match queue generation with source-centric grouped reviews. Pre-existing open `UNMATCHED` noise is retained as audited `RESOLVED/NO_MATCH` history rather than deleted. Repeated revisions update/reuse open source reviews instead of duplicating them.
- Preserved verified catalog metadata and manual mapping decisions. Changed/disappeared approved blobs become stale and require re-review.
- Retained the KTT Peach Blossom durable no-match guard.

## Verification

- `npx tsc --noEmit`: PASS.
- `npm test`: PASS, 58/58 (expanded from 55), including modern pair, single standard format, exact path/hash, arbitrary CSV exclusion, nonstandard review, distinct multi-curve measurements, missing metadata fail-closed, and KTT Peach negative fixtures.
- Fresh PostgreSQL 17 database `sb_fc_format_fix`: all 33 migrations applied with `npx prisma migrate deploy`: PASS.
- `DATABASE_URL=postgresql://kennnyshiwa@localhost/sb_fc_format_fix npm run test:force-curves-db`: PASS. Output after fixture reset: 7 runs, 10 catalog rows, 11 review records, `peachApprovedUrls=[]`. Fixtures cover a prior completed zero-catalog run, source-centric reconciliation, exact hashes/revisions, pairing, nonstandard review, new-revision incremental behavior, and same-revision idempotency.
- `npm run lint`: PASS with only pre-existing warnings.
- `npm run build`: PASS, all 82 static pages generated.
- `npm run build:force-curves-sync`: PASS; packaged runner bundle is 13.2 KB and has no `tsx` runtime dependency.
- Packaged runner against the audited live upstream tree and disposable PostgreSQL fixture: PASS. First corrected run: `cursor=5420`, `afterCount=5420`, `errorCount=0`, `reviewCount=2795`; the two excluded spring CSVs explain 5,420 versus 5,422 total upstream CSVs. A second invocation returned the identical run ID/counts and made no new run or reviews.
- `git diff --check`: PASS after normalizing trailing whitespace in the feature-owned ops evidence file.

## Production expectations and operations

The safe initial corrected sync will catalog 5,420 artifacts at revision `66cc5aa...`: 5,407 standard-format artifacts plus 13 audited review-only legacy artifacts. Because the source provides no authoritative manufacturer or technology metadata, expected auto-approved mappings are zero until an admin verifies metadata and approves mappings. Approximately 2,795 grouped source reviews are expected, rather than 2,756 duplicate per-master unmatched reviews. Existing open per-master `UNMATCHED` cases transition to resolved audit history during the corrected run.

Rollback remains `FORCE_CURVE_LEGACY_ROLLBACK=true` plus the authorized Compose-only app redeploy. Additive catalog/review data can remain intact. The `:formats-v2` sync run is revision-idempotent and requires no manual SQL cleanup.

## Files owned by this iteration

- `src/lib/force-curves.ts`
- `scripts/sync-force-curves.ts`
- `tests/force-curves.test.ts`
- `tests/force-curves.db.ts`
- this evidence file

Unrelated dirty files were not modified. The production ops evidence file was already being updated by ops; only its trailing whitespace was mechanically normalized so `git diff --check` could pass.
