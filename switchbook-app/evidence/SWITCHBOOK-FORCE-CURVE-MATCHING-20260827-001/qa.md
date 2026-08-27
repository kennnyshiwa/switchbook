# Independent QA verdict: FAIL

Assignment: `SWITCHBOOK-FORCE-CURVE-MATCHING-20260827-001`  
Date: 2026-08-27  
Scope: local implementation only; no deploy, push, commit, or production mutation.

## Verdict

The implementation compiles and the additive schema validates, but it does not meet the accepted architecture or its safety gates. The focused tests are two URL-helper assertions and do not exercise matching, approved-only reads, migration behavior, synchronization, idempotency, manual precedence, review resolution, feedback, or the Peach Blossom database result. Independent acceptance therefore fails.

## Blocking findings

1. **Manufacturer/technology compatibility is not enforced from real source data.** `fetchThereminGoatCatalog()` emits only `path` and `sha`; every catalog row therefore has `manufacturer=null` and `technology=null`. The automatic predicate treats absent metadata as compatible (`!c.manufacturer`, `!c.technology`), bypassing two mandatory fail-closed gates. Evidence: `src/lib/force-curves.ts` (`fetchThereminGoatCatalog`, candidate filter).
2. **Changed approved curves remain approved.** A content-hash change increments `changedCount`, but existing approved mappings are neither made stale nor queued for review. The later matcher can upsert the same row back to `AUTO_APPROVED`. This violates persistence/invalidation acceptance criteria. Evidence: `src/lib/force-curves.ts`, catalog upsert and missing-only stale block.
3. **Manual precedence and no-match uniqueness are not safely constrained.** PostgreSQL unique `(masterSwitchId,catalogEntryId)` permits multiple rows when `catalogEntryId IS NULL`; concurrent/repeated no-match decisions can coexist. `decidedById` has no FK/relation. A single `REJECTED` mapping also suppresses automation for every other curve for the switch, undermining multiple-curve support, while an auto-approved sibling may remain visible after a later no-match decision. Evidence: `prisma/schema.prisma`, migration SQL, sync `manual` query, approved read query.
4. **Admin review cannot resolve the cases it creates.** Ambiguous/unmatched sync cases store candidate IDs only in JSON and have `catalogEntryId=null`; the UI shows no candidates and offers no approval control. The POST API accepts an arbitrary catalog ID without verifying it exists, belongs to the review candidates, is extant, or passes manufacturer/technology constraints. Feedback cases have the same issue. A review with `masterSwitchId=null` reaches `review.masterSwitchId!` and can fail at runtime. Evidence: `ForceCurveReviewQueue.tsx`, admin reviews route, sync review creation.
5. **Feedback does not reliably affect matching.** Only `incorrect_match` with both trusted IDs demotes an `AUTO_APPROVED` row. `no_match_found` and ID-less feedback leave approved eligibility unchanged; supplied switch/catalog IDs are not checked for relationship or existence. Review and feedback writes are not atomic. Evidence: `src/app/api/force-curve-feedback/route.ts`.
6. **Legacy unsafe matching remains active outside the explicit rollback read.** Batch/check/cache APIs and partner catalog still use display-name cache/matching (`findAllForceCurveMatches`, `ForceCurveCache`). This can continue reporting unsafe force-curve availability and violates the canonical-only read requirement. Evidence: `src/utils/forceCurveCache.ts`, `/api/force-curve-{batch-check,check,cache}`, `src/lib/partner-api/catalog.ts`.
7. **Sync is not genuinely resumable.** `cursor` is never written, work is not chunked/transactionally checkpointed, and a failed retry restarts all work. Error arrays are overwritten rather than accumulated. The biweekly shell integration also runs host-side `npm` after container operations without establishing the production app environment/database context. Evidence: `src/lib/force-curves.ts`, `update-switchesdb.sh`.
8. **Peach Blossom regression is not meaningfully tested.** The test only proves that `catalogUrl('KTT Peach Blossom')` itself does not contain the literal string `TG.csv`; it neither calls canonical reads nor syncs the required master ID. The runtime guard swallows creation errors, so a missing master or DB issue can silently leave no durable guard. Evidence: `tests/force-curves.test.ts`, `src/lib/force-curves.ts` regression guard.
9. **Source identity is weakened.** The upstream identity discovered is the `TG.csv` blob, but its repository path is truncated to the containing directory before persistence. The hash is the file blob hash, while the persisted path identifies a directory. This is not the requested exact source + repository-relative curve path. Evidence: `fetchThereminGoatCatalog()` path replacement.
10. **No DB-backed or browser evidence exists.** There are no fixtures for conflicts/multiple curves/manual precedence/change/deletion/resume, no disposable migration result, no sync-before/after sampled audit, and no local public/admin browser evidence or screenshots.

## Commands and results

- `git diff --check` — PASS.
- `DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma validate` — PASS.
- same placeholder URL, `npx prisma generate` — PASS.
- `npm test` — PASS, 51/51; only 2 new force-curve tests, both shallow helper assertions.
- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with existing warnings.
- placeholder URL, `npm run build` — PASS; canonical/admin routes emitted.
- Disposable PostgreSQL attempt — BLOCKED: no `psql`, `initdb`, or `pg_isready`; Docker CLI exists but daemon calls did not return and were terminated. No `DATABASE_URL` was available in the QA shell.
- Runtime/browser flow — BLOCKED by absence of an applied local PostgreSQL database and fixtures. Static route/build evidence cannot compensate for the functional failures above.

## Required builder corrections

1. Persist the exact curve file path (for example `.../TG.csv`) and derive/store trustworthy manufacturer and technology metadata; fail closed when required compatibility data is absent rather than treating null as compatible.
2. Extract matching into testable logic with fixtures covering exact unique, ambiguous, missing, manufacturer conflict, technology conflict, multiple curves, close competitors/confidence, manual precedence, changed/deleted paths, feedback suppression, and Peach Blossom.
3. On hash/path/compatibility changes, make affected automated approvals stale/review-required; preserve manual decisions with explicit review semantics. Add DB constraints/transactional invariants preventing duplicate null no-match rows and conflicting visible states; relate `decidedById` to `User`.
4. Make sync chunked/checkpointed or explicitly remove the resumable claim; persist cursor/progress/errors transactionally, ensure retry idempotency, and test interrupted/resumed and repeated revisions with stable counts.
5. Build a usable review flow: return candidate records, allow exact candidate selection, validate candidate membership/existence/compatibility server-side, handle cases without a master safely, expose audit history, and prevent arbitrary IDs.
6. Make every feedback type create an atomic auditable case and block/demote the applicable automated eligibility until resolution; validate canonical identities.
7. Replace all live cache/batch/partner availability reads with canonical MasterSwitch-ID approved mappings. Keep display-name matching reachable only under the one explicit rollback flag.
8. Replace the Peach Blossom helper assertion with DB-backed sync/read/API/UI regression proving zero approved curves and no generated `TG.csv` URL for `cmqo21sm103vknu3vh0tjs75x`.
9. Add and run disposable PostgreSQL migration/fixture/idempotency tests, audit before/after/error counts and sampled records, then capture local public share and admin queue browser evidence.

## Migration/rollback assessment

The migration is additive and retains legacy tables, which is a sound rollout property. Rollback can leave the new tables in place and disable canonical consumers. However, the lack of constraints and DB-backed application testing prevents acceptance as migration-safe. Do not enable the legacy flag casually: current legacy matching is the original unsafe behavior and must be a deliberate emergency rollback only.

## Residual risk

None of the blockers is merely environmental; the static implementation itself violates core fail-closed, provenance, review, feedback, and resumability requirements. This iteration must return to builder.

---

# Iteration 2 independent QA verdict: FAIL

Date: 2026-08-27

Iteration 2 fixes several iteration 1 issues: exact `TG.csv` paths are retained; null metadata fails closed; canonical check/batch/cache/partner consumers replace the legacy matcher; feedback writes are transactional; review candidate membership is validated; the mapping decider has a user FK; and a unique no-match key exists. However, independent DB/runtime testing found four release-blocking defects.

## Iteration 2 blocking findings

1. **A changed curve is immediately re-approved in the same sync.** In a disposable PostgreSQL fixture, revision A created one approved curve. Revision B changed its blob hash. The run reported `changedCount=1` and `staleCount=1`, but the matching phase then upserted the same mapping to `AUTO_APPROVED`; `getApprovedCurves()` still returned one curve. The surviving mapping had `state=AUTO_APPROVED`, stale reason `Curve content hash changed`, and new sync provenance. This violates the accepted stale/review-required behavior and makes the stale counter misleading. Code path: `src/lib/force-curves.ts`, content-change transaction followed by unconditional exact-candidate upsert.
2. **The real catalog cannot enter the implemented admin approval path.** `fetchThereminGoatCatalog()` intentionally supplies no manufacturer or technology metadata. Such entries produce zero `candidateIds`, so their unmatched review UI has no selectable curve. Even if a catalog ID were attached, admin `MANUALLY_APPROVED` calls `selectAutomaticCandidates()`, which rejects null source metadata. There is no UI/API to verify or populate catalog metadata or search/select a catalog entry. Therefore the first real sync produces unmatched cases that cannot be manually approved; the review queue is not operationally usable.
3. **The canonical public read is unauthorized for logged-out users.** Local runtime request `GET /api/force-curves/cmqo21sm103vknu3vh0tjs75x` returned HTTP 401. `src/middleware.ts` permits `/api/share` but not `/api/force-curves`. The public share component fetches the blocked endpoint as an unauthenticated user, so no approved force-curve button can render on public shares. This is a runtime regression not covered by the 55 tests.
4. **Fresh migration chain does not produce the current Prisma schema.** All 32 migrations, including `20260827190000_add_canonical_force_curves`, applied successfully to disposable PostgreSQL 17. The first normal Prisma user create then failed `P2022`: column `User.emailMarketing` does not exist. A local share runtime subsequently logged `P2022`: column `MasterSwitch.imageUrl` does not exist and rendered the 404 fallback. The complete migration history is missing unrelated-but-required current-schema columns, so mandatory fresh migration/runtime verification fails. This must be repaired with an additive schema-catchup migration; modifying old applied migrations is unsafe.

## Disposable database evidence

Database: local PostgreSQL 17 disposable database `qa_switchbook_fc_20260827_i2` (removed after QA).

- `createdb ... qa_switchbook_fc_20260827_i2` — PASS.
- `DATABASE_URL=... npx prisma migrate deploy` — PASS, all 32 migrations applied.
- Normal `prisma.user.create()` — FAIL `P2022`, missing `User.emailMarketing`.
- Raw minimal fixture plus `syncForceCurveCatalog('rev-a', ...)` twice — idempotent run identity PASS; run A counts: before 0, after 1, new 1, changed 0, stale 0, completed, cursor 1.
- Revision B with the same exact path and changed hash — counts: before 1, after 1, new 0, changed 1, stale 1, completed, cursor 1; **functional result FAIL**: approved curves after change = 1 and mapping state = `AUTO_APPROVED`.
- Sample exact catalog identity: `KTT Peach/TG.csv`, revision/hash fixture retained; count audit above confirms one extant record.
- Local Next dev server on port 3019 — started successfully.
- Anonymous canonical endpoint — FAIL, HTTP 401 `{"error":"Unauthorized"}`.
- Public Peach share route — HTTP 200 shell but page data fell back to 404; server log shows missing `MasterSwitch.imageUrl` from migration/schema drift.
- Admin browser flow could not be meaningfully completed because the fresh migrated database cannot run the current application schema. Static inspection independently proves the real null-metadata queue has no approvable candidates.

## Standard gates rerun

- `git diff --check` — PASS.
- placeholder URL, `npx prisma validate` — PASS.
- placeholder URL, `npx prisma generate` — PASS.
- `npm test` — PASS, 55/55.
- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with pre-existing warnings.
- placeholder URL, `npm run build` — PASS; 81 pages generated and new routes emitted.

The passing focused tests remain insufficient: none exercises DB sync transitions, middleware/public endpoint access, admin resolution against real null-metadata catalog entries, feedback persistence, interrupted resume, or fresh migration/runtime behavior.

## Required iteration 3 corrections

1. Prevent changed hashes from being auto-approved during that sync. Keep affected automated mappings `STALE`/review-required until an explicit later validated decision; add a DB-backed regression asserting approved read count becomes zero after hash change.
2. Make the real review queue usable: catalog unmatched entries must be searchable/selectable and reviewers need an auditable way to verify/set manufacturer and technology metadata. Manual approval must validate reviewer-confirmed metadata without requiring unavailable automatic-source metadata. Add API/UI and DB-backed tests.
3. Add anonymous GET access for `/api/force-curves/:masterSwitchId` (and only the intended safe read methods) in middleware. Add a logged-out route test and local public-share browser assertion.
4. Add a new additive catch-up migration that makes a fresh migrated database conform to current `schema.prisma`. Prove with `prisma migrate diff --from-url <fresh-db> --to-schema-datamodel prisma/schema.prisma` producing no drift, then seed and load the public and admin flows.
5. Add DB-backed tests for no-match uniqueness/precedence, multiple approved curves, missing/conflicting candidates, feedback demotion/review audit, review candidate membership, interrupted resume/error accumulation, stable same-revision counts, and Peach Blossom zero approved URLs.

## Iteration 2 conclusion

Mandatory migration, runtime/browser, stale-transition, and usable human-review gates fail. `RESOLVED_VERIFIED` is not supportable; return to builder for iteration 3.

---

# Iteration 3 final independent QA verdict: FAIL (production migration blocker)

Date: 2026-08-27

## Verdict

The force-curve implementation now passes its functional database and local runtime gates. It still cannot be accepted as `RESOLVED_VERIFIED` because the new schema catch-up migration is not safe for the existing production database shape it is intended to repair. This is a concrete rollout blocker, not a speculative residual risk.

## Blocking evidence: catch-up migration is not production-safe/additive

`prisma/migrations/20260827230000_schema_catchup/migration.sql` was generated against the incomplete historical migration chain and assumes every drifted object is absent. It unconditionally:

- `CREATE TYPE "ClickType"`;
- adds many columns without `IF NOT EXISTS`;
- creates existing current-schema tables and indexes without guards;
- drops and recreates `SwitchImage_switchId_fkey`;
- changes `PartnerSubmissionPhoto.sourceUrl` nullability.

This is neither strictly additive nor safe on an existing database that already obtained any of these current-schema objects through a prior `db push` or manual schema operation. That existing-drift shape is precisely the likely production state: the application schema referenced these objects before any migration created them.

Independent reproduction on the disposable database:

1. Applied all 33 migrations and confirmed zero schema drift.
2. Removed only the catch-up row from `_prisma_migrations`, leaving the current-schema objects in place. This simulates an existing current-schema database on which the new migration has not been recorded.
3. Ran `npx prisma migrate deploy`.
4. Result: **P3018**, PostgreSQL `42710`, `ERROR: type "ClickType" already exists`. Prisma recorded a failed migration and refused further migrations until manual recovery.

Therefore deploying this migration without first auditing the exact production schema can break the release and leave migration state requiring `prisma migrate resolve`. The accepted criteria explicitly require an additive migration safe for an existing production database, so final QA must fail.

Required resolution: audit production schema/migration state read-only, then replace the catch-up with a production-safe reconciliation strategy (guarded `DO` blocks/catalog checks or a baseline/resolve runbook tailored to verified state). Avoid unconditional drop/recreate operations. Validate against both (a) a clean historical-chain database and (b) a production-shaped drift database, with zero final drift and no failed migration record.

## Functional DB verification: PASS

Disposable PostgreSQL 17 database: `qa_switchbook_fc_20260827_i3` (removed after QA).

- Fresh `createdb` — PASS.
- `npx prisma migrate deploy` — PASS, 33/33 migrations.
- `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --exit-code` — PASS, `No difference detected`.
- `npm run test:force-curves-db` — PASS.
- Same-revision idempotency and stable run identity — PASS.
- Changed-hash transition remains `STALE` and approved read becomes zero — PASS.
- Injected interruption persisted `FAILED`, cursor `1`, error count `1`; retry resumed to cursor `2` and `COMPLETED` — PASS.
- Exact source and `TG.csv` paths — PASS.
- Multiple manually approved curves — PASS.
- Exclusive no-match precedence and database uniqueness — PASS.
- Feedback demotion and linked feedback/review audit — PASS.
- Attributable metadata verification — PASS.
- Peach Blossom durable no-match and zero URLs — PASS.
- Sample audit: 4 sync runs, 5 catalog rows, 6 review rows, `peachApprovedUrls=[]`.

## Local runtime verification: PASS

Next dev server on port 3019 against the disposable database:

- Anonymous `GET /api/force-curves/cmqo21sm103vknu3vh0tjs75x` — HTTP 200, `{"curves":[],"source":"canonical"}`.
- Anonymous `POST` to the same route — HTTP 401, `{"error":"Unauthorized"}`.
- Public `/share/switch/gWtSnezYCI` — HTTP 200; rendered HTML contained `Peach Blossom` and contained zero `TG.csv` strings.
- Anonymous `/admin/force-curves` — HTTP 307 to `/auth/login`, as expected.
- Admin API/UI static inspection — catalog search, candidate attachment, metadata verification, attributable audit, exact candidate validation, and resolution controls are present. Full authenticated browser clicking was not possible without creating an Auth.js browser session, but the same persistence transitions passed through DB fixtures and the application compiled those routes.

No screenshot was captured; HTTP bodies/statuses and server logs are the reproducible runtime evidence.

## Standard gates: PASS

- `git diff --check` — PASS.
- placeholder URL, `npx prisma validate` — PASS.
- placeholder URL, `npx prisma generate` — PASS.
- `npm test` — PASS, 55/55.
- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with pre-existing warnings only.
- placeholder URL, `npm run build` — PASS; 82 pages generated, including force-curve admin/catalog routes.
- Git status shows no tracked modification to older migration files; the catch-up is a new migration. Unrelated dirty work remains present and untouched.

## Acceptance summary

All feature behavior criteria are now supported by independent local evidence: approved-only MasterSwitch-ID reads, exact source/path/hash identity, fail-closed matching, multiple curves, manual precedence, stale handling, feedback influence, review workflow/auditability, resumable/idempotent sync counters, explicit-only legacy rollback, and the Peach Blossom regression.

The mandatory existing-production migration safety criterion fails. No deploy, push, commit, or persistent database mutation was performed.

## Residual risks after migration repair

- The admin UI was verified by compile/static inspection plus its underlying DB transitions, not a fully authenticated browser click-through.
- The biweekly Docker script was inspected but not run against the production container topology.
- Production backfill counts and sampled production records necessarily remain an ops/release-stage check after deployment authorization.
