# Builder evidence

Date: 2026-08-27
Baseline: `06b9b8b69b4553cad352feba12c96e1c16363f96`
Scope: local implementation and verification only; no commit, push, deploy, production mutation, account/role/session change, or direct SQL decision was performed.

## Implementation

- Added ADMIN-only approved `MasterSwitch` search by exact ID or bounded text query at `GET /api/admin/force-curves/master-switches`.
- Added `PUT /api/admin/force-curves/reviews` to bind an OPEN source-centric review to an exact selected master and exact member catalog entry.
- Link validation fails closed unless the master is APPROVED with manufacturer/technology, the catalog identity is extant and from the canonical source, every review member has the exact normalized `manufacturer + name` display/folder identity, and no conflicting open review exists.
- No fuzzy or automatic linking was added. Link, metadata verification, and resolution transactions lock the review row to serialize concurrent mutations.
- Link audit is stored in review payload with actor, timestamp, source, path, revision, blob hash, master ID, and catalog ID. Mapping provenance now contains workflow/review/actor/time/source/path/master/catalog attribution; existing relational actor/time fields remain populated.
- All unsafe review mutations require an authenticated ADMIN and an exact same-origin `Origin`; strict Zod schemas reject malformed, extra, missing, or oversized input.
- The admin queue now exposes exact catalog selection, approved master search/selection with canonical IDs, explicit audited linking, metadata verification, and the existing approve/reject/no-match decisions.
- Existing sync/catalog schema and migrations were not changed. Mapping/review uniqueness and the Peach Blossom `NO_MATCH` regression remain intact.

## Verification

- Fresh PostgreSQL 17 database `sb_fc_assignment002_builder`: `DATABASE_URL=... npx prisma migrate deploy` PASS, all 33 migrations.
- `DATABASE_URL=... npm run test:force-curves-db`: PASS. Actual DB assertions cover link audit, exact mapping, idempotent re-link, one review/mapping, metadata attribution, decision attribution, public approved read, double-resolution denial, sync idempotency/concurrency, and Peach zero curves. Final fixture counts: runs 8, catalog 5,362, reviews 2,741, `peachApprovedUrls=[]`.
- `npm test`: PASS, 61/61. New focused assertions cover anonymous/non-admin denial, missing/cross-origin CSRF denial, same-origin acceptance, exact Gateron identity acceptance, and fuzzy/incompatible Peach identities failing closed.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with only pre-existing warnings.
- `DATABASE_URL=... npm run build`: PASS, 83 pages; new admin master-search and review routes emitted.
- Local production runtime on port 3021: anonymous admin UI returned 307 to login; anonymous master search and review PUT returned 401 `Unauthorized`. Server stopped afterward.
- `git diff --check`: PASS.

## Changed files

- `src/lib/admin-force-curves.ts` (new)
- `src/app/api/admin/force-curves/master-switches/route.ts` (new)
- `src/app/api/admin/force-curves/reviews/route.ts`
- `src/app/admin/force-curves/page.tsx`
- `src/components/admin/ForceCurveReviewQueue.tsx`
- `tests/force-curves.test.ts`
- `tests/force-curves.db.ts`
- `evidence/SWITCHBOOK-FORCE-CURVE-MATCHING-20260827-002/builder.md` (new)

Unrelated dirty files, including `evidence/SWITCHBOOK-FORCE-CURVE-MATCHING-20260827-001/ops-production-release.md`, `scripts/rehost-master-switch-images.ts`, and other untracked evidence, were not touched.

## QA handoff

Fresh independent QA should exercise the real admin browser flow against a disposable production-shaped database, including exact four-sample IDs/paths, non-admin and anonymous HTTP behavior, forged/missing Origin, invalid CUIDs, incompatible identities, conflict/concurrency, audit attribution, duplicates, Peach `NO_MATCH`, sync repeat, runtime UI/API, and migration drift. Production approvals, release, and production QA remain owner/ops responsibilities after `PASS_VERIFIED`.

## Iteration 2 after QA FAIL_REWORK

Independent QA correctly found that production stores all four target master names with `Gateron` already prefixed. Both the link predicate and the existing final approval selector had unconditionally constructed `manufacturer + name`, producing `Gateron Gateron ...` and blocking legitimate exact identities.

Correction:

- Normalize manufacturer and name independently.
- If the normalized master name is exactly the manufacturer or begins with the exact normalized manufacturer token plus a space, use the master name unchanged.
- Otherwise construct exact `manufacturer + name`.
- Continue requiring full normalized equality for catalog display name and parent folder. No substring/fuzzy acceptance was introduced; verified manufacturer and technology remain mandatory for approval/automatic eligibility.

Regression coverage now uses the exact production IDs, names, technologies, catalog IDs, and paths for Gateron Oil King, Smoothie, Magnetic Jade, and G Pro 3.0 Yellow. A real PostgreSQL transaction performs link, idempotent re-link, metadata verification, approval, attributable mapping, and approved public read for all four. Unit negatives reject V2, wrong-manufacturer, deceptive `GateronX` prefix, and Peach/Cherry mismatches.

Iteration-2 verification:

- Fresh PostgreSQL 17 database `sb_fc_assignment002_builder2`: all 33 migrations PASS.
- `DATABASE_URL=... npm run test:force-curves-db`: PASS. Final fixture counts: runs 8, catalog 5,365, reviews 2,744, `peachApprovedUrls=[]`.
- `npm test`: PASS, 62/62.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with pre-existing warnings only.
- `DATABASE_URL=... npm run build`: PASS, 83 pages.
- `git diff --check`: PASS.

Additional changed file in iteration 2: `src/lib/force-curves.ts`. No schema/migration, production, authentication, account, role, commit, push, or deploy mutation was performed.

## Iteration 3 after QA FAIL_REWORK

QA found that locking only the requested review row did not serialize two distinct review rows racing to claim the same master/catalog pair. Both could pass the conflict query before either linked update became visible.

Correction:

- `linkSourceReview()` now locks the exact selected `MasterSwitch` row with `FOR UPDATE` after validating/locking its review and before loading identity data or checking for an existing linked OPEN review.
- The master row is the shared serialization point for all link attempts targeting that master. The second distinct-review transaction waits, then observes the committed winner and fails `CONFLICTING_OPEN_REVIEW`.
- Same-review retries remain idempotent because the review row lock still serializes them. No schema or migration change was required.

Deterministic PostgreSQL regression:

- Seeded one approved `Gateron Race` master, one exact catalog entry, and two distinct OPEN source reviews sharing that candidate.
- Ran both `linkSourceReview()` calls via `Promise.allSettled`.
- Asserted exactly one fulfilled result, exactly one rejection with `CONFLICTING_OPEN_REVIEW`, and exactly one linked OPEN `(master, catalog)` row.
- Re-linked the winning review and asserted stable review identity and still exactly one linked row.

Iteration-3 verification:

- Fresh PostgreSQL 17 database `sb_fc_assignment002_builder3`: all 33 migrations PASS.
- `DATABASE_URL=... npm run test:force-curves-db`: PASS. Final fixture counts: runs 8, catalog 5,366, reviews 2,746, `peachApprovedUrls=[]`.
- `npm test`: PASS, 62/62.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with pre-existing warnings only.
- `DATABASE_URL=... npm run build`: PASS, 83 pages.
- `git diff --check`: PASS.

No production, authentication, account, role, commit, push, deploy, schema, or migration mutation was performed. Unrelated dirty files remain untouched.
