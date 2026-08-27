# SWITCHBOOK-FILTER-UNIFY-20260826-001

Status: assigned_builder
Owner: Switchbook domain owner
Reported by: Kenneth
Date: 2026-08-26

## Reproduction and trace

- Personal collection path: `src/components/SwitchCollection.tsx` derives filter options from loaded collection data, renders the shared `src/components/CollectionControls.tsx` dropdown UI, and applies `ActiveFilters` predicates to the collection.
- Master database path: `src/app/switches/browse/page-client.tsx` independently owns dozens of text/debounced/filter states and bespoke predicates. Several categorical fields use case-insensitive substring matching while others use exact enum/string matching. The master page does not use the collection dropdown contract and does not derive normalized categorical options from real master data.
- Master data source: `GET /api/master-switches` in `src/app/api/master-switches/route.ts`; browse currently requests `limit=0` and then filters in the client. The route also contains a second, differing server-side filter implementation.
- Reproduction conclusion: the two paths have duplicated UI/state/predicate semantics, so master filters cannot reliably match personal collection behavior.

## Builder assignment

Unify applicable master database filters with the personal collection dropdown/data-derived model. Prefer shared pure utilities/contracts over another copy. Preserve unrelated dirty worktree changes, especially `scripts/rehost-master-switch-images.ts` and pre-existing untracked evidence.

## Acceptance contract

1. Master browse uses the same dropdown/data-derived filtering model and shared semantics as personal collection for every applicable filter.
2. Master dropdown options come only from real approved master-switch data; values are trimmed/normalized, deduplicated case-insensitively, deterministically sorted, and every option returns at least one result.
3. Single and combined filters, clear/reset, supported URL/query persistence, no-result state, and responsive mobile/desktop layouts work.
4. Search, sort, catalog count/results, pagination/fetch behavior, comparison, add-to-collection/wishlist, and details behavior remain intact.
5. Focused regression tests cover normalization, option derivation, single filtering, combined filtering, and no-result/reset.
6. `npm test`, typecheck, lint, and production build pass.
7. Builder documents changed files, design decisions, commands/results, and residual risks in `evidence/SWITCHBOOK-FILTER-UNIFY-20260826-001/builder.md`.

## Release gates

Independent QA must PASS before Ops. Ops must commit/push, confirm CI green, deploy only through the repository-approved Docker Compose process, verify health/logs and live desktop/mobile flows, document rollback, then independent production QA must return PASS_VERIFIED.
