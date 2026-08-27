# Independent QA iteration 3 — final acceptance

Date: 2026-08-27
Baseline: `06b9b8b69b4553cad352feba12c96e1c16363f96`
Verdict: **PASS_VERIFIED**

## Patch review

The iteration-2 race is fixed by locking the selected `MasterSwitch` row inside the same transaction after the requested review-row lock and before the conflict recheck. Distinct review rows targeting the same master now share a serialization point. Lock ordering is consistent for this workflow, same-review calls remain idempotent, and no schema/migration change was introduced.

The exact-identity correction remains fail closed: it accepts either a master name already prefixed by its normalized manufacturer or a name requiring that exact prefix, while still requiring exact normalized catalog display identity and exact parent-folder identity. No fuzzy automatic linking was added.

## Independent concurrency verification

Fresh PostgreSQL 17 service-level verification covered both required modes:

- Distinct-review race: 10 independently created master/catalog pairs, each with two different OPEN source review IDs raced concurrently. Every iteration produced exactly one fulfilled link, one `CONFLICTING_OPEN_REVIEW`, and one linked OPEN review.
- Same-review idempotency: five concurrent link calls against one review all returned the same review ID and left exactly one row.
- The production-shaped DB suite independently reproduced one distinct-review race with the same one-success/one-conflict result and a repeat link of the winning review.

No duplicate mapping was created after repeated resolution; a resolved review cannot be resolved twice.

## Exact four-sample workflow

The DB acceptance suite used the exact researched production master IDs, stored names, catalog IDs, paths, manufacturer, and technology. Each sample completed the real transactional workflow: source-review link, metadata verification, manual approval, mapping audit, and immediate public lookup.

- `cmcj8nlk20001ju04hkhn73i4` / `cmtbuybf90197uq2ni7cm18gf` — `Gateron Oil King/Gateron_Oil_King_HighResolutionRaw.csv`
- `cmgwp60xy04jwpk2om25iv882` / `cmtbuybn801aluq2njayzle8l` — `Gateron Smoothie/Gateron_Smoothie_HighResolutionRaw.csv`
- `cmgwnyflm04blpk2ow1uibj03` / `cmtbuyb5e017kuq2nqlgwl087` — `Gateron Magnetic Jade/Gateron_Magnetic_Jade_HighResolutionRaw.csv`
- `cmgloohl501vfpk2os8do5jwo` / `cmtbuyaip0140uq2n2z0pe3ws` — `Gateron G Pro 3.0 Yellow/Gateron_G_Pro_3.0_Yellow_HighResolutionRaw.csv`

For each, QA verified one review, one mapping, one correct public curve at decision time, link audit actor/time/source/path/revision/hash/master/catalog, metadata verifier attribution, and decision actor/time/source/master/catalog attribution.

The later synthetic full-catalog fixture intentionally omits these four paths and therefore stales them as missing; this validates stale-on-disappearance behavior and is separate from the exact approval workflow assertions above. The real researched production catalog contains all four paths.

## Fail-closed and decision coverage

- Exact suffix variant, wrong parent folder, manufacturer mismatch, and near-prefix identity: denied.
- Mixed/incompatible review identities and ambiguous candidates: denied.
- Sequential conflicting open review and concurrent distinct-review conflict: denied.
- Invalid/missing/extra CUID payloads are rejected by strict Zod schemas.
- Manufacturer length, reason length, technology, and resolution are bounded/enumerated.
- REJECTED and NO_MATCH service flows retain actor/time/source/master attribution; NO_MATCH suppresses approved output.
- Peach Blossom remains durable `NO_MATCH` with `peachApprovedUrls: []`.

## Authorization, CSRF, and runtime

- ADMIN actor extraction rejects anonymous and non-admin sessions.
- Mutation helper rejects missing, malformed, and cross-origin `Origin`, accepting only exact same-origin.
- Production runtime on port 3024:
  - anonymous `/admin/force-curves`: 307 to login;
  - anonymous master search: 401;
  - anonymous review PUT with missing, cross-origin, or same-origin header: 401 before mutation.
- No fabricated session, account change, or role change was used.

## Fresh validation

- Disposable database: `sb_fc_assignment002_qa3`.
- PostgreSQL 17 migration deploy: PASS, all 33 migrations.
- Force-curve DB suite: PASS; 8 sync runs, 5,366 catalog rows, 2,746 reviews, Peach URLs `[]`.
- Sync interruption/resume, repeated revision, concurrent sync ownership, derived-count repair, and duplicate avoidance: PASS.
- Production-shaped sync: 5,351 entries and exactly 2,729 source-review groups; repeat sync did not duplicate reviews, runs, or decisions.
- Full tests: PASS, 62/62.
- TypeScript (`npx tsc --noEmit`): PASS.
- Lint: PASS with pre-existing warnings only.
- Production build: PASS, 83 pages; admin queue and both admin API surfaces emitted.
- `git diff --check`: PASS.

## Scope and cleanup

QA did not modify implementation, production data, accounts, roles, sessions, commits, remotes, or deployment state. Unrelated dirty changes were preserved. The disposable database and runtime were removed/stopped after evidence capture.
