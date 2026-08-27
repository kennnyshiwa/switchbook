# Builder handoff

Local implementation only; no commit, push, migration application, or deploy performed.

## Implemented

- Additive Prisma catalog, mapping, review-case, sync-run models/enums and feedback identity links; migration retains all legacy cache/preference/feedback tables.
- Exact catalog identity `(source, repositoryPath)` with revision and blob hash; canonical mappings keyed by `MasterSwitch.id`, nullable entries for manual no-match, multiple exact entries supported.
- Incremental GitHub `TG.csv` catalog sync integrated into `update-switchesdb.sh`; identical successful revision returns its existing run, upserts paths, marks disappeared paths/mappings stale, preserves manual states, records counts/errors.
- Conservative automatic gate: unique normalized manufacturer+switch exact name, compatible catalog manufacturer/technology metadata, confidence 1.0; manual approval/rejection/no-match blocks automation. KTT Peach Blossom is explicitly guarded as `NO_MATCH`.
- Approved-only server read API and all rendered force-curve button call sites pass `masterSwitchId`. Legacy preferences are retained but ignored. Old display matcher is callable only when `FORCE_CURVE_LEGACY_ROLLBACK=true`; canonical empty/error paths never silently invoke it.
- Feedback creates an auditable review case and demotes an auto-approved exact mapping to review-required.
- Admin review list/resolve API and `/admin/force-curves` UI; resolutions record actor/time/provenance.

## Validation

- `DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma validate`: PASS.
- `DATABASE_URL=... npx prisma generate`: PASS.
- `npx tsc --noEmit`: PASS.
- `npm test`: PASS, 51/51 (includes exact-path URL and Peach Blossom TG.csv regression assertions).
- `npm run lint`: PASS with pre-existing warnings only.
- `DATABASE_URL=... npm run build`: PASS; routes include canonical read, admin sync/reviews, and admin UI.
- `git diff --check`: PASS.

## Not run / follow-up evidence required

- No local PostgreSQL service/fixture URL was authorized or available, so the additive migration was not applied and DB-backed idempotency/sample-count/runtime browser flows were not executed. Independent QA should run the migration against a disposable production-shaped snapshot, run the sync twice, audit run counts/mapping states, and exercise the public Peach Blossom page plus admin review UI.
- Rollback: leave additive tables and legacy data in place, set `FORCE_CURVE_LEGACY_ROLLBACK=true` only for an explicit rollback. Removing/unsetting it restores fail-closed canonical reads. Migration downgrade is intentionally not recommended during rollout.

## Files

`prisma/schema.prisma`, `prisma/migrations/20260827190000_add_canonical_force_curves/migration.sql`, `src/lib/force-curves.ts`, `scripts/sync-force-curves.ts`, `update-switchesdb.sh`, canonical/admin APIs and UI under `src/app/api/{force-curves,admin/force-curves}` and `src/app/admin/force-curves`, `ForceCurvesButton` plus master-ID call sites, feedback route, canonical share serializer, and focused tests.

The unrelated pre-existing modification to `scripts/rehost-master-switch-images.ts` was not touched.

## Iteration 2 after QA failure

All nine static implementation blockers were corrected:

- Catalog identity now preserves the exact `.../TG.csv` blob path and hash. Upstream entries with absent trusted manufacturer/technology metadata cannot auto-approve; they queue for review. Matching was extracted into `selectAutomaticCandidates` and tested for exact, ambiguity, missing, manufacturer/technology conflict, and null metadata.
- Changed hashes stale automated approvals in the same checkpoint transaction; deleted paths stale all visible approvals. Sync runs in checkpointed chunks, persists numeric cursor and cumulative counters, resumes failed/running revisions from cursor, accumulates errors, and returns completed identical revisions unchanged.
- `noMatchKey @unique` enforces one no-match per master; `decidedById` now has a User FK. Approved reads give NO_MATCH exclusive precedence. Admin no-match stales all conflicting approvals; candidate approvals remove no-match. A rejection only suppresses its exact catalog candidate.
- Review GET/UI resolves JSON candidate IDs to visible exact paths and supports selection. POST rejects missing masters, arbitrary/nonexistent/deleted/non-member candidates, and candidates that fail exact manufacturer/technology/path compatibility. Decisions retain actor/time and resolved review history.
- Every feedback type atomically creates feedback+review and demotes applicable automated eligibility; supplied IDs are validated and absent IDs are resolved conservatively where possible.
- Default check, batch, cache-availability, collection, button, and partner reads now use canonical MasterSwitch-ID mappings. Legacy display matching remains only inside `/api/force-curves/[masterSwitchId]` when `FORCE_CURVE_LEGACY_ROLLBACK=true`. Legacy preferences are never opened by canonical UI.
- Biweekly integration now executes the sync inside the running `switchbook-app` container, where the app database environment exists, and fails the update if that container is unavailable.
- Focused tests now exercise fail-closed matching, ambiguity, conflicts, exact file identity, multiple approved curves, stale/deleted exclusion, and behavior-level NO_MATCH precedence proving Peach returns zero curve records/URLs even with a conflicting auto approval fixture.

Iteration-two validation: Prisma validate/generate PASS; `npx tsc --noEmit` PASS; `npm test` PASS 55/55; `npm run lint` PASS with only pre-existing warnings; `npm run build` PASS; `git diff --check` PASS.

The environment still has no disposable PostgreSQL service, so applying the migration, DB-backed interruption/idempotency execution, sampled record counts, and browser screenshots remain explicitly assigned to independent QA. No production or local persistent database was mutated.

## Iteration 3 (final builder loop)

QA's PostgreSQL 17 path was located at `/opt/homebrew/opt/postgresql@17/bin` and used for full disposable verification.

- Changed-hash mappings now remain `STALE`; the matching phase detects stale history and queues explicit re-verification instead of re-approving. DB regression: revision A approved one curve; revision B changed the hash, recorded changed/stale counts, left mapping `STALE`, and `getApprovedCurves()` returned zero.
- Real null-metadata catalog entries are searchable through the admin catalog API/UI. Reviewers select an exact path, verify manufacturer and technology, and attach it to the review. Verification stores `metadataVerifiedAt`, verifier User FK, and an audit object in review payload. Manual approval still validates exact path/manufacturer/technology after reviewer verification and candidate membership.
- Middleware permits anonymous `GET|HEAD|OPTIONS` only for `/api/force-curves/:masterSwitchId`; anonymous POST remains unauthorized. Runtime evidence on port 3019: Peach GET 200 `{"curves":[],"source":"canonical"}`, POST 401, public share 200, rendered HTML contained the switch name and no `TG.csv`.
- New additive migration `20260827230000_schema_catchup` repairs all historic migration/schema drift and adds metadata-verification fields/FK. A from-zero PG17 database applied all 33 migrations, then `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --exit-code` reported `No difference detected`.
- `tests/force-curves.db.ts` now proves with actual PostgreSQL: same-revision idempotency/stable run identity; changed hash stale/zero read; checkpointed injected failure, persisted cursor/error and resume; exact source paths; multiple manual approvals; exclusive no-match precedence and DB uniqueness; feedback demotion plus feedback/review audit; attributable metadata verification; Peach no-match and zero URLs. Sample audit output: 4 sync runs, 5 catalog rows, 6 review rows, `peachApprovedUrls=[]`.
- Feedback persistence/demotion was extracted into `src/lib/force-curve-feedback.ts` so API and DB tests exercise the same transaction.

Verification commands/results:

- Fresh PG17 `prisma migrate deploy`: PASS, 33/33.
- Fresh PG17 migrate diff: PASS, zero drift.
- `DATABASE_URL=... npm run test:force-curves-db`: PASS.
- Runtime anonymous canonical GET/public share/unsafe POST checks: PASS (200/200/401 respectively, zero curve URLs).
- `npx prisma validate`, `npx tsc --noEmit`, `npm test` (55/55), `npm run lint` (pre-existing warnings only), `npm run build`, `git diff --check`: PASS.
- Both disposable databases `sb_fc_i3_base` and `sb_fc_i3_verify` were dropped after verification.

No screenshots were captured because no browser automation connector was available in this builder session; equivalent local HTTP response and rendered-HTML evidence is recorded above. No commit, push, deployment, or persistent/production DB mutation occurred. The unrelated dirty `scripts/rehost-master-switch-images.ts` remains untouched.

## Migration repair loop 1 (production-safe guarded reconciliation)

Replaced the unconditional contents of `20260827230000_schema_catchup` with guarded reconciliation SQL. The migration now:

- creates `ClickType` only when absent in the current schema;
- adds drifted columns with `ADD COLUMN IF NOT EXISTS`;
- creates drifted tables/indexes only when absent;
- drops `PartnerSubmissionPhoto.sourceUrl` NOT NULL only when catalog inspection proves it is still NOT NULL (a data-preserving transition);
- adds missing foreign keys only after `pg_constraint` checks;
- leaves the already-correct production `SwitchImage_switchId_fkey` untouched and replaces it only when its catalog `confdeltype` is not `SET NULL` (the clean historical chain has the incorrect `CASCADE` form).

No already-applied historical migration was modified. No unconditional drop/recreate of a correct constraint remains.

### PostgreSQL 17 migration matrix

Local PostgreSQL `17.8`, disposable database `sb_fc_repair_clean`:

1. **Clean historical chain:** `DATABASE_URL=postgresql://kennnyshiwa@localhost/sb_fc_repair_clean npx prisma migrate deploy` applied all 33 migrations successfully. `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --exit-code` returned `No difference detected`.
2. **Audited-production-shaped/current objects with catch-up unrecorded:** deleted only the catch-up row from the disposable `_prisma_migrations` while retaining the current objects, then reran `prisma migrate deploy`. PASS; the catch-up was recorded successfully, no failed row was created, and migrate diff returned `No difference detected`. This exercises the audited production facts: `ClickType`, current columns/tables/indexes and correct `SwitchImage` FK already exist while the migration is not recorded.
3. **Direct repeat/idempotency:** applied the guarded SQL again with `psql -v ON_ERROR_STOP=1 -f .../migration.sql`. PASS; only expected already-exists notices, no error. Unfinished/unrolled-back migration row count was `0`; final migrate diff again returned `No difference detected`.

### Functional/static/runtime regression

- `DATABASE_URL=... npm run test:force-curves-db`: PASS. Sample output: `runs=4`, `catalog=5`, `reviews=6`, `peachApprovedUrls=[]`.
- `npx prisma validate` and `npx prisma generate`: PASS.
- `npm test`: PASS, 55/55.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with pre-existing warnings only.
- `npm run build`: PASS, 82 pages; canonical/admin force-curve routes emitted.
- `git diff --check`: PASS.
- Local runtime on port 3019 against the disposable fixture: anonymous canonical Peach GET returned 200 `{"curves":[],"source":"canonical"}`; anonymous POST returned 401; public share returned 200, contained `Peach Blossom`, and contained zero `TG.csv`; anonymous admin returned 307 to login. The fixture's shareable ID was set locally after the DB suite so the exact public URL could be rendered.

The dev server was stopped and disposable database dropped after evidence capture. No commit, push, deploy, production access, or persistent database mutation occurred. Unrelated dirty work remains untouched.
