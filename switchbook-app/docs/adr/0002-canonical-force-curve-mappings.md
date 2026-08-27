# ADR 0002: Canonical force-curve catalog and mappings

Status: Accepted for local implementation (2026-08-27)  
Assignment: `SWITCHBOOK-FORCE-CURVE-MATCHING-20260827-001`

## Context

SwitchBook currently discovers top-level folders in `ThereminGoat/force-curves` at request time and compares display names using exact and substring checks. The public KTT Peach Blossom record (`MasterSwitch.id=cmqo21sm103vknu3vh0tjs75x`, `shareableId=gWtSnezYCI`) has no verified curve, but display-name matching can associate it with unrelated “Blossom” data and generate an unsafe link. Feedback is stored by display name and only clears a cache; it does not suppress or review a candidate.

## Decision

Persist source catalog identity as `(source, repository-relative path)` plus upstream revision/blob hash. Persist a many-curve canonical mapping keyed by `MasterSwitch.id`. Mapping states are `AUTO_APPROVED`, `REVIEW_REQUIRED`, `MANUALLY_APPROVED`, `REJECTED`, `NO_MATCH`, and `STALE`; manual decisions outrank automated proposals.

The only default read path is an approved canonical mapping whose catalog record still exists. A temporary environment flag may re-enable the old matcher for rollback, but no error or empty canonical result silently falls back to it.

The biweekly SwitchesDB sync incrementally catalogs new/changed/deleted upstream paths, preserves reviewed mappings, marks invalidated approved mappings stale, proposes only high-confidence compatible mappings, and records resumable/idempotent sync-run counters and errors. Ambiguous, unmatched, stale, and feedback-derived cases enter an auditable admin review queue.

## Automatic approval gate

A candidate may be auto-approved only when all of these are true:

1. the exact source/path exists in the latest successful catalog snapshot;
2. the candidate is unique after normalization;
3. normalized manufacturer is an exact match or a verified alias;
4. switch technology is compatible and known on both sides when the source supplies it;
5. confidence is at least `0.98`, with no competing candidate within `0.05`;
6. no manual rejection, manual no-match, unresolved feedback, or manual approval conflicts.

Everything else fails closed into review/no-match. Multiple exact curves for one master switch are allowed when each mapping independently passes approval.

## Acceptance criteria

- Prisma migration is additive and safe for an existing production database; rollback notes identify legacy tables retained during rollout.
- Catalog identity is unique by source and repository-relative path and stores revision/hash metadata where available.
- Canonical mappings use `MasterSwitch.id`, support multiple curves, preserve provenance/audit data, and enforce manual-over-automatic precedence.
- Sync is idempotent and resumable; repeated identical fixtures produce no duplicate catalog/mapping records and stable counts.
- Sync-run records expose before/after/new/changed/stale/unmatched/review/error counts and terminal status.
- Missing paths, ambiguous candidates, manufacturer conflicts, and technology conflicts never appear on the approved read path.
- KTT Peach Blossom `cmqo21sm103vknu3vh0tjs75x` returns no approved curve and never generates a `TG.csv` or display-name-derived URL.
- Existing reviewed/manual mappings persist across unchanged and changed catalog syncs unless their exact path disappears/changes incompatibly, in which case they become stale/review-required rather than silently rematched.
- Feedback creates or updates a review case tied to canonical switch/catalog identities where resolvable and affects automated eligibility.
- Admin API/UI can list and resolve ambiguous, unmatched, stale, and feedback cases; decisions are attributable and timestamped.
- Old matching is available only behind an explicit rollback flag and is never an implicit fallback.
- Focused tests, migration validation, fixture/idempotency tests, existing tests, `npx tsc --noEmit`, lint, build, local runtime/browser flow, and sampled audit counts pass.

## Rollout and repair

1. Apply additive schema and catalog/sync machinery with canonical reads enabled and legacy matcher disabled.
2. Catalog the current upstream revision, generate review proposals, and explicitly seed KTT Peach Blossom as `NO_MATCH` until verified evidence exists.
3. Import only existing preferences that resolve to an extant exact source/path into review; do not auto-approve user-selected legacy URLs.
4. Review high-confidence proposals in batches, sample each manufacturer/technology cohort, then expand canonical coverage.
5. Keep legacy cache/preferences for rollback during the transition. Rollback is the explicit flag only; remove it after the repair/backfill audit and an agreed observation window.

