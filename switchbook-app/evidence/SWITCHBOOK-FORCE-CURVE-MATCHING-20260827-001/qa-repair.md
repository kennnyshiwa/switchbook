# Independent QA — migration repair loop 1

Date: 2026-08-27  
Verdict: **PASS**  
Scope: local-only acceptance; no commit, push, deploy, or production mutation.

## Hard gate: PostgreSQL 17 migration matrix

Tested with local PostgreSQL 17 on disposable databases. Both disposable database shapes applied `20260827230000_schema_catchup` successfully, ended with no unfinished/failed migration rows, and produced `No difference detected` from Prisma migrate diff.

### Clean historical chain

- Created `qa_fc_repair_clean_ind` from empty.
- `DATABASE_URL=postgresql://kennnyshiwa@localhost/qa_fc_repair_clean_ind npx prisma migrate deploy` — PASS, all 33 migrations.
- `npx prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --exit-code` — PASS, zero drift.
- Unfinished/non-rolled-back migration rows: `0`.
- Final `SwitchImage_switchId_fkey.confdeltype`: `n` (`SET NULL`).
- Final `PartnerSubmissionPhoto.sourceUrl`: nullable, matching `schema.prisma`.

### Audited-production-shaped/current objects, catch-up unrecorded

Created `qa_fc_repair_prodshape_ind` with all current objects present, removed only the catch-up migration record, and restored the production-audited `PartnerSubmissionPhoto.sourceUrl NOT NULL` starting condition. Preflight assertions:

- `ClickType` exists: true.
- `User.emailMarketing` exists: true.
- `MasterSwitch.imageUrl` exists: true.
- `SwitchImage_switchId_fkey.confdeltype = n`: true; already-correct constraint.
- `PartnerSubmissionPhoto.sourceUrl` nullable: `NO`.
- Unfinished migration rows: `0`.

`npx prisma migrate deploy` — PASS. Postflight:

- catch-up completed row count: `1`;
- unfinished/failed rows: `0`;
- `ClickType` and audited columns remained present;
- the already-correct `SwitchImage` FK remained `SET NULL` (no unnecessary drop/recreate path was taken);
- `PartnerSubmissionPhoto.sourceUrl` became nullable, the one necessary data-preserving nullability reconciliation required by the checked-in Prisma model;
- migrate diff — PASS, zero drift.

The guarded SQL was then executed directly a second time with `psql -v ON_ERROR_STOP=1`. It completed with only expected already-exists notices. Final drift remained zero, the FK remained `SET NULL`, and unfinished migration rows remained zero.

Inspection confirms the repair uses catalog guards/`IF NOT EXISTS`, does not alter an already-correct `SwitchImage` constraint, and does not tighten/drop data-bearing columns. No historical applied migration file is tracked as modified; the two force-curve migrations are new untracked directories.

## Functional database acceptance

Disposable database `qa_fc_repair_functional_ind`, cloned from the clean migrated database:

- `DATABASE_URL=... npm run test:force-curves-db` — PASS.
- Sample audit: `runs=4`, `catalog=5`, `reviews=6`, `peachApprovedUrls=[]`.
- Suite covers stable same-revision identity/counts, hash-change stale behavior, interruption/cursor/error persistence and resume, exact paths, multiple curves, no-match precedence/uniqueness, feedback audit/demotion, attributable metadata verification, and Peach Blossom zero approved URLs.

## Local runtime acceptance

Next dev server on port 3027 using the disposable fixture:

- Anonymous `GET /api/force-curves/cmqo21sm103vknu3vh0tjs75x` — HTTP 200, `{"curves":[],"source":"canonical"}`.
- Anonymous `POST` to the same URL — HTTP 401, `{"error":"Unauthorized"}`.
- Fixture-only assignment of shareable ID `gWtSnezYCI`, then `GET /share/switch/gWtSnezYCI` — HTTP 200; rendered HTML contained `Peach Blossom` and zero `TG.csv` occurrences.
- Anonymous `GET /admin/force-curves` — HTTP 307 to login, confirming the admin surface remains protected.
- Server stopped after verification. No screenshot was captured; HTTP status/body and rendered-HTML assertions are the local browser-equivalent evidence.

## Standard gates

- `npx prisma validate` — PASS.
- `npx prisma generate` — PASS.
- `npm test` — PASS, 55/55.
- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS with pre-existing warnings only.
- `npm run build` — PASS; 82-page build including canonical/admin force-curve routes.
- `git diff --check` — PASS.

## Worktree boundary and disposition

- `scripts/rehost-master-switch-images.ts` remains a pre-existing unrelated tracked modification, as documented in the builder handoff; it was not touched by QA.
- Other unrelated evidence directories and parent `.gitignore` remain dirty/untracked and were not altered.
- No old applied migration is modified. New migration files are only `20260827190000_add_canonical_force_curves/migration.sql` and `20260827230000_schema_catchup/migration.sql`.
- No commit, push, deploy, production write, or persistent application-database mutation occurred.
- All three QA disposable databases were dropped after evidence capture; a catalog query confirmed none remained.

## Independent conclusion

The iteration-3 production migration blocker is resolved. The guarded catch-up is safe on both required database shapes, repeat-safe, drift-free, and leaves no failed migration state. Feature DB behavior, Peach regression, anonymous read/write authorization, public rendering, admin protection, and all static/build gates pass. **Independent QA accepts this local implementation.**
