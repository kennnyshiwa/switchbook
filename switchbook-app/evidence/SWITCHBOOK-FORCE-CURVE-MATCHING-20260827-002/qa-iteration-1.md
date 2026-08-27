# Independent QA iteration 1

Date: 2026-08-27
Baseline: `06b9b8b69b4553cad352feba12c96e1c16363f96`
Verdict: **FAIL_REWORK**

## Blocking defect

The admin workflow cannot link any of the four exact researched production MasterSwitch identities. Production stores each MasterSwitch `name` with the manufacturer already included, while `exactCatalogMasterIdentity()` unconditionally constructs `${manufacturer} ${name}`.

At `src/lib/admin-force-curves.ts:21-25`, a production Oil King is therefore compared as normalized `Gateron Oil King` (catalog) versus normalized `Gateron Gateron Oil King` (constructed master identity). `linkSourceReview()` consequently throws `INCOMPATIBLE_IDENTITY` at line 50 before audit linking, metadata verification, decision, mapping, or public serving can occur.

This was reproduced two independent ways:

1. Direct predicate execution with the exact names and paths from `evidence/SWITCHBOOK-FORCE-CURVE-MATCHING-20260827-001/research-approved-samples.md` returned `false` for all four.
2. Real Prisma transactions against fresh PostgreSQL 17 database `sb_fc_assignment002_qa1`, seeded with the exact production master IDs, master names, catalog IDs, paths, manufacturer, technology, source, and open source-review shape, returned:

```text
Gateron Oil King INCOMPATIBLE_IDENTITY
Gateron Smoothie INCOMPATIBLE_IDENTITY
Gateron Magnetic Jade INCOMPATIBLE_IDENTITY
Gateron G Pro 3.0 Yellow INCOMPATIBLE_IDENTITY
```

Exact affected records:

- `cmcj8nlk20001ju04hkhn73i4` / `cmtbuybf90197uq2ni7cm18gf` / `Gateron Oil King/Gateron_Oil_King_HighResolutionRaw.csv`
- `cmgwp60xy04jwpk2om25iv882` / `cmtbuybn801aluq2njayzle8l` / `Gateron Smoothie/Gateron_Smoothie_HighResolutionRaw.csv`
- `cmgwnyflm04blpk2ow1uibj03` / `cmtbuyb5e017kuq2nqlgwl087` / `Gateron Magnetic Jade/Gateron_Magnetic_Jade_HighResolutionRaw.csv`
- `cmgloohl501vfpk2os8do5jwo` / `cmtbuyaip0140uq2n2z0pe3ws` / `Gateron G Pro 3.0 Yellow/Gateron_G_Pro_3.0_Yellow_HighResolutionRaw.csv`

The builder tests mask the defect: `tests/force-curves.db.ts:35` and `tests/force-curves.test.ts:85` use the synthetic master name `Oil King`, not the exact production name `Gateron Oil King`. No test covers the other three exact production identities.

## Independent checks completed

- Fresh PostgreSQL 17 migration deploy: PASS, all 33 migrations applied with no drift or schema change required.
- Production-shaped force-curve DB suite: PASS at its current assertions; counts were 8 sync runs, 5,362 extant catalog entries, 2,741 reviews, and Peach approved URLs `[]`.
- Full tests: PASS, 61/61. This does not override the missing production-identity coverage above.
- TypeScript (`npx tsc --noEmit`): PASS.
- Lint: PASS with pre-existing warnings only.
- Production build: PASS, 83 pages; admin force-curve page, master search route, and review route emitted.
- `git diff --check`: PASS.
- Anonymous production runtime on port 3022:
  - `/admin/force-curves`: 307 redirect to login.
  - master-switch search API: 401.
  - same-origin review `PUT`: 401.
- Current unit checks confirm anonymous/non-admin actor rejection and missing/cross-origin rejection with same-origin acceptance at the helper boundary.
- Repeat sync/idempotency and Peach `NO_MATCH` regression pass in the DB suite; Peach remains zero curves.
- No production access or mutation, account/role/session change, commit, push, or deploy was performed. Unrelated dirty changes were preserved.

## Acceptance impact and required rework

The primary acceptance condition requires all four researched samples to be resolvable through the legitimate ADMIN workflow. That condition fails for 4/4 exact production identities, so downstream approve/audit/public-curve acceptance for those samples cannot be exercised and release is blocked.

Rework must make exact identity comparison support the repository's actual MasterSwitch naming convention without introducing fuzzy matching. Add regression coverage using all four exact production IDs, names, catalog IDs, and paths, and prove each links through the real transactional service before repeating independent QA. The existing fail-closed behavior for incompatible and ambiguous identities and Peach Blossom must remain intact.

Disposable database data was QA-only. Implementation files were not modified.
