# Independent QA — iteration 1

Status: PASS
Date: 2026-08-26
QA scope: source/diff inspection, focused regression tests, full automated gates, and static responsive/integration review. No implementation, commit, push, deployment, or production mutation performed.

## Verdict

The implementation satisfies the pre-release acceptance contract. The master browse page now derives categorical dropdowns from the fetched approved master-switch records and sends both master and personal-collection filtering through the same pure normalization, option-derivation, and predicate implementation in `src/lib/switch-filters.ts`.

## Acceptance evidence

1. **Shared dropdown/data-derived model and semantics — PASS**
   - `SwitchCollection.tsx` and `switches/browse/page-client.tsx` both call `deriveSwitchFilterOptions` and `applySwitchFilters`.
   - Every categorical filter previously exposed by master browse (manufacturer, type, technology, housing/stem materials and colors, markings, spring values, compatibility, magnet fields, and PCB thickness) is now a `<select>` populated from the shared derived option contract.
   - Numeric ranges and boolean filters enter the same combined shared predicate pipeline.

2. **Real-data option integrity — PASS**
   - Browse fetch remains `GET /api/master-switches?limit=0&page=1&sort=...&order=...`; the route constrains records to `MasterSwitchStatus.APPROVED`.
   - Options derive only from the returned `switches` array. `normalizedStringOptions` trims, collapses internal whitespace, removes empty values, deduplicates by locale-lowercased normalized key, and deterministically locale/numeric sorts display values.
   - Numeric options retain finite values (including zero), deduplicate, and sort numerically; booleans derive only from real boolean values.
   - Result-validity follows directly from deriving each option from a record and applying the identical normalized exact matcher. Focused tests confirm case/whitespace variants map back to records.

3. **Single/combined/reset/no-result/URL/responsive — PASS**
   - Focused tests cover normalized single filters, combined categorical filters, combined range/boolean filters, no-result, and empty-filter reset.
   - `clearAllFilters` resets every master filter state; the result empty state now keys off `filteredSwitches.length`.
   - Existing URL support is sort/order only; `updateURLParams` and initialization from `sort`/`order` remain intact. No unsupported filter URL behavior was claimed or removed.
   - Static structure remains responsive: primary controls use `grid-cols-1` with `md`/`lg` expansion, advanced groups likewise collapse to one column, and results continue through `VirtualSwitchList`.

4. **Existing browse behavior preserved — PASS**
   - Search predicate remains before shared filters; name/view-count client sorting and API-created-date ordering remain intact.
   - Full-catalog fetch (`limit=0`), approved catalog count, virtualized results, comparison state/actions, details popup, add-to-collection, wishlist, delete/link flows remain in place.
   - The displayed matching count now correctly reports `filteredSwitches.length`.

5. **Regression coverage — PASS**
   - `tests/switch-filters.test.ts` covers normalization, real-value option derivation, case-insensitive deduplication, deterministic sorting, numeric/boolean option derivation, single and combined exact-normalized filtering, combined numeric/boolean filtering, no-result, and reset.
   - `tests/run-tests.ts` includes the focused suite.

6. **Automated gates — PASS**
   - `npm test`: PASS, 49/49.
   - `npx tsc --noEmit`: PASS.
   - `npm run lint`: PASS with repository-existing warnings outside the changed browse/filter files; no new blocking lint errors.
   - `npm run build`: PASS; Next production compilation and generation of 78/78 static pages completed.

7. **Dirty-worktree preservation — PASS**
   - QA made no source changes. The unrelated modified `scripts/rehost-master-switch-images.ts` and unrelated untracked evidence remain untouched.

## Diff/test inspection notes

- The shared utility imports the existing `ActiveFilters`/`FilterOptions` contract, preventing semantic drift between personal and master paths.
- Master dropdown display values preserve the first normalized real-data spelling while comparisons are normalized, so case/spacing duplicates cannot create dead options.
- Search, filtering, and sorting remain ordered as search -> shared filtering -> sort.

## Non-blocking cleanup note

`SwitchCollection.tsx` retains the old option/predicate implementation after an unconditional return / inside `if (false)`. It is unreachable and does not affect behavior, typecheck, lint, tests, or build, but should be removed in a later cleanup to reduce review and maintenance noise.

## Release disposition

PASS for handoff to Ops. Commit/push, green CI, approved Docker Compose deployment, health/log/live desktop-mobile verification, rollback documentation, and independent production `PASS_VERIFIED` remain required release gates.
