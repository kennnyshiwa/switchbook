# Owner diagnosis

Date: 2026-08-27
Baseline: `06b9b8b69b4553cad352feba12c96e1c16363f96`

## Reproduction

- Production evidence from assignment 001 reports 2,729 open source-centric force-curve reviews and zero with a `masterSwitchId`.
- `POST /api/admin/force-curves/reviews` requires an open review with a linked `MasterSwitch`; an unlinked review fails closed with HTTP 409.
- `PATCH /api/admin/force-curves/reviews` likewise requires `review.masterSwitchId` before metadata verification.
- `/admin/force-curves` lists the source review queue but exposes no search/select/link control for a canonical `MasterSwitch`.
- The current sync intentionally creates one source-centric review group per measurement identity and remains idempotent; changing sync to guess canonical identities would reintroduce unsafe fuzzy matching.

## Root cause

The production workflow has audited decision primitives but no authorized identity-binding primitive. Source catalog reviews are created without a canonical switch by design, while every later decision requires one. Thus even a legitimate ADMIN cannot complete a manual decision without bypassing the product through direct database writes.

## Smallest safe correction

Add an ADMIN-only, CSRF-protected exact MasterSwitch search/select and link operation for an OPEN unlinked source review. The server must validate exact row identities and approved status, reject already-linked conflicts, reject incompatible or ambiguous source/master combinations, persist actor/time/source/master attribution, and leave approval/reject/no-match to the existing audited decision endpoint. Do not add fuzzy auto-linking or alter account/session/role state.

## Acceptance evidence required

- Focused authorization, CSRF, validation, compatibility, ambiguity, idempotency, conflict, audit, and duplicate tests.
- Full tests, TypeScript, lint, build, runtime and migration-safety evidence.
- Fresh independent QA `PASS_VERIFIED` before release.
- Exact-SHA green CI, Compose-only production release, health/log/migration/rollback evidence, then independent production QA of the four researched Gateron approvals and Peach Blossom regression.
