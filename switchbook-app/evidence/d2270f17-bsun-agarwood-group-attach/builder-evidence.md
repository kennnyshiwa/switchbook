# Builder evidence — BSUN Agarwood grouped attachment

- Base candidate: `30bbadf3fa07676c418c74db636457322a5b5e01`; its approved + null-technology attachment and persistent card feedback remain intact.
- Root cause corrected: a complete homogeneous group may contain `AMBIGUOUS` evidence only when at least one ordinary source-review row is present. `MANUFACTURER_CONFLICT` retains the same group-only constraint; unrelated kinds remain rejected.
- Completeness now includes eligible ambiguity rows, so all three OPEN rows in each BSUN measurement group resolve atomically with no orphan.
- Compatibility adds one bounded exception: canonical folder `BSUN Agarwood`, exact approved Bsun master `BSUN Agarwood`, and only a numbered or `<count> Actuations` display suffix. Other suffixes, makers, master names, technology mismatches, and identities still fail the ordinary compatibility gate.
- `REVIEW_CANDIDATE_REQUIRED` no longer claims concurrency. Genuine `INCOMPLETE_SOURCE_GROUP` failures receive accurate card-local feedback and an inline `Refresh group and retry` action. The selected master, compatibility acknowledgement/reason, staged action, and card location are not cleared. Skip/defer behavior is unchanged.
- Fresh PostgreSQL 17 regression covers six source shapes (`1`, `2`, `3`, `4`, `10k Actuations`, `100k Actuations`), each with two source rows plus one ambiguity row. All 18 rows resolve, six intended high-resolution mappings are written, raw/wrong-target/unrelated siblings are untouched, and replay is immutable.
- The DB regression also proves partial membership, missing/changed catalog evidence, and an unrelated review kind fail closed and roll back without mapping/review/queueWorkflow mutation.
- The existing null-technology override fixture passes, preserving explicit compatibility acknowledgement and exact override reason/actor audit for genuinely incompatible identities.

## Verification

- Focused admin/feedback/compatibility tests: PASS, 18/18.
- BSUN Agarwood PostgreSQL 17 fixture: PASS, 18/18 review rows across six atomic groups.
- Existing null-technology compatibility-override PostgreSQL fixture: PASS.
- Full unit suite: PASS, 112/112.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with pre-existing unrelated warnings only.
- `npm run build`: PASS.
- `git diff --check`: PASS.

The isolated PostgreSQL instance was stopped and moved to Trash. No production database, deploy, or remote was touched.
