# Builder evidence

Status: implementation_complete
Date: 2026-08-26

## Design

- Added `src/lib/switch-filters.ts` as the shared pure filtering contract used by both the personal collection and master browse paths.
- Categorical values are trimmed, internal whitespace collapsed, case-insensitively deduplicated, locale/numeric sorted, and matched with normalized exact semantics.
- Numeric options accept finite values including zero, and ranges/booleans use the same combined predicate pipeline.
- Master categorical controls are dropdowns populated solely from the fetched approved master dataset. Hard-coded type, technology, magnetic, and PCB option lists were removed.
- Master search, sort/order URL persistence, API fetch (`limit=0`), comparison, details, collection/wishlist mutations, and virtual list remain in their existing paths.
- Clear/reset retains the existing single action and the no-results state now correctly checks the filtered result set.

## Files changed

- `src/lib/switch-filters.ts`
- `src/components/SwitchCollection.tsx`
- `src/app/switches/browse/page-client.tsx`
- `tests/switch-filters.test.ts`
- `tests/run-tests.ts`

## Focused regression coverage

- whitespace/case normalization
- real-data option derivation, case-insensitive deduplication, sorting, numeric and boolean derivation
- normalized single and combined categorical filters
- combined numeric/boolean filters
- no-result and empty-filter reset behavior

## Verification

- `npm test`: PASS, 49/49
- `npx tsc --noEmit`: PASS
- `npm run lint`: PASS with pre-existing repository warnings only; no warning remains in the changed master browse file
- `npm run build`: PASS; production build and static generation completed

## Risks / QA focus

- Browser QA should exercise the large real production dataset, especially whitespace/casing variants and narrow mobile layout.
- Numeric ranges remain numeric inputs, matching the personal collection's range model; categorical fields are data-derived dropdowns.
- Filter URL persistence was not introduced because the existing browse behavior persists only sort/order; that behavior is preserved.
- No commit, push, CI, deployment, or production mutation was performed by Builder.
- Pre-existing unrelated dirty/untracked work, including `scripts/rehost-master-switch-images.ts`, was preserved.
