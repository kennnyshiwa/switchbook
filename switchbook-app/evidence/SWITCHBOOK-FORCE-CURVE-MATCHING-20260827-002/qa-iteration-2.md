# Independent QA iteration 2

Date: 2026-08-27
Baseline: `06b9b8b69b4553cad352feba12c96e1c16363f96`
Verdict: **FAIL_REWORK**

## Summary

The iteration-1 production-name defect is fixed: all four exact researched Gateron identities now complete link, metadata verification, manual approval, audit persistence, and public curve lookup against fresh PostgreSQL 17.

Release remains blocked because concurrent link requests for two distinct source review rows can both claim the same exact MasterSwitch/catalog pair. This produces duplicate open linked reviews and violates the explicit no-duplicate/conflict/concurrency acceptance condition.

## Blocking concurrency defect

`linkSourceReview()` locks only the requested review row (`src/lib/admin-force-curves.ts:41` in the iteration-2 tree) and then performs an application-level `findFirst` conflict check before updating that row. There is no database uniqueness constraint covering an open `(masterSwitchId, catalogEntryId)` review claim and no shared master/catalog/advisory lock.

Fresh real-database reproduction:

1. Create one approved `Gateron Race` master and one exact canonical catalog row.
2. Create two separate OPEN `SOURCE_UNVERIFIED` reviews with the same candidate.
3. Invoke `linkSourceReview()` for both reviews concurrently with `Promise.allSettled`.

Observed result:

```json
{
  "settled": ["fulfilled", "fulfilled"],
  "linked": 2
}
```

Both transactions check for a conflicting linked review before either update is visible, then both commit. A sequential pre-existing conflict is correctly rejected with `CONFLICTING_OPEN_REVIEW`, but the concurrent case is not serialized. Current tests exercise two concurrent calls against the *same* review row, which does not cover this cross-review race.

Required rework: enforce one durable open claim for the same master/catalog identity under concurrency, using a database-enforced invariant or a correctly scoped shared lock/serializable retry strategy. Add a regression test with two distinct review IDs racing for the same pair, asserting one success, one conflict, and exactly one linked open review. Preserve legitimate idempotent relinking of the same review.

## Exact production sample verification

Against disposable database `sb_fc_assignment002_qa2`, QA independently seeded the exact production IDs, names, catalog IDs, revision, paths, hashes, manufacturer, and technology from the research packet. Each used real Prisma transactions through `linkSourceReview()`, `verifyReviewMetadata()`, `resolveForceCurveReview()`, and `getApprovedCurves()`.

- Gateron Oil King: `MANUALLY_APPROVED`, one exact public path.
- Gateron Smoothie: `MANUALLY_APPROVED`, one exact public path.
- Gateron Magnetic Jade: `MANUALLY_APPROVED`, one exact public path.
- Gateron G Pro 3.0 Yellow: `MANUALLY_APPROVED`, one exact public path.

For every row, QA verified:

- link audit actor/time/source/path/revision/hash/master/catalog fields;
- metadata verifier actor/time and exact manufacturer/technology;
- decision actor/time/source/master/catalog attribution;
- exactly one review row and one mapping for the non-racing normal flow;
- repeated same-review concurrent linking is idempotent;
- public lookup returns only the researched exact path.

Three near variants (suffix variant, wrong folder, and manufacturer mismatch) failed closed. Sequential already-linked conflict failed closed. Independent REJECTED and NO_MATCH flows persisted actor, time, source, reason, and master attribution. NO_MATCH returned zero curves.

## Security and input review

- Mutation routes authenticate first and require an ADMIN actor.
- PUT/PATCH/POST require an exact same-origin `Origin`; missing, malformed, and cross-origin inputs fail the helper boundary.
- Strict Zod request schemas use CUID validation, bounded text, enumerated technology/resolution, and reject extra fields.
- Anonymous production runtime:
  - `/admin/force-curves`: 307 to login.
  - master search API: 401.
  - review PUT with a same-origin header: 401.
- No fabricated browser session or account/role change was used.

## Fresh validation results

- PostgreSQL 17 migration deploy: PASS, all 33 migrations.
- Force-curve DB suite: PASS at current assertions; 8 runs, 5,365 catalog rows, 2,744 reviews, Peach approved URLs `[]`.
- Full tests: PASS, 62/62.
- TypeScript (`npx tsc --noEmit`): PASS.
- Lint: PASS with pre-existing warnings only.
- Production build: PASS, 83 pages; admin page and both new API surfaces emitted.
- `git diff --check`: PASS.
- Sync repeat/resume/concurrent-owner idempotency: PASS in DB suite.
- Production-shaped sync cardinality: 5,351 source entries and 2,729 open review groups; repeat sync did not duplicate groups or decisions.
- Peach Blossom remains `NO_MATCH` with zero approved URLs.

## Scope and cleanup

No implementation file, production database, session, account, role, commit, push, or deployment was changed by QA. Unrelated dirty worktree changes were preserved. The disposable database was removed after evidence capture.
