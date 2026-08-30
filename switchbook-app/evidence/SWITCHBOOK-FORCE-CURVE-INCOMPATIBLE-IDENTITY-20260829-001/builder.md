# Builder evidence

Date: 2026-08-29

## Scope

- Preserved the pre-existing dirty worktree and edited only the five implementation/test files listed below plus this evidence file.
- No production mutation, deployment, push, or commit was performed.
- iOS parity: N/A; this is an authenticated web admin review surface.

## Implementation

- `src/lib/admin-force-curves.ts`: added one fail-closed `catalogMasterCompatibility` result shared by mutation validation and search presentation. It retains exact folder/display equality, requires the declared manufacturer to occur in the catalog or master identity, strips only exact manufacturer tokens, and requires all remaining identity tokens to match exactly.
- `src/app/api/admin/force-curves/master-switches/route.ts`: requires an existing canonical catalog candidate and annotates every approved substring search hit with the shared compatibility verdict/reason.
- `src/components/admin/ForceCurveReviewQueue.tsx`: sends the exact catalog ID during search, disables incompatible results with an actionable reason, disables attach unless the selected result is compatible, and maps a defensive backend `INCOMPATIBLE_IDENTITY` response to actionable copy.
- `tests/force-curves.test.ts`: covers the exact `80Retros 1989 Retro Blue` / `80Retros KTT Game1989 Retro Blue` conflict as fail-closed, proves a truly exact 80Retros identity remains valid, rejects the sibling `KTT Retro Blue`, and preserves wrong color/folder/manufacturer and Peach Blossom exclusions. Research found a tactile-vs-silent-linear type conflict for the reported production MasterSwitch, so no global alias was added; a future alias must be explicitly scoped by verified MasterSwitch ID and source measurement identity.
- `tests/admin-navigation.test.ts`: asserts catalog-bound search, disabled incompatible results, and raw error-code UX mapping.

## Focused verification

Command:

`npx tsx --test tests/force-curves.test.ts tests/admin-navigation.test.ts`

Result: PASS, 29 tests, 0 failures.

Command:

`npx tsc --noEmit`

Result: PASS, exit 0.

Command: `npm test`

Result: PASS, 80 tests, 0 failures.

Command: `npm run lint`

Result: PASS, exit 0, with pre-existing repository warnings only (no warnings in changed files).

Command: `npm run build`

Result: PASS, optimized production build completed and all 83 static pages generated.

## Safety properties

- Link mutations continue to lock and re-read review, MasterSwitch, and exact catalog rows and re-run compatibility inside the transaction.
- No mapping, queue grouping, idempotency, bulk approval, or conflict logic was relaxed or bypassed.
- Variant identity remains exact: the conflicted reported target, sibling switch, wrong color/folder/manufacturer tests all fail closed.
