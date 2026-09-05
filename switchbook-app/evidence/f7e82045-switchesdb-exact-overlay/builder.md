# Builder evidence — exact SwitchesDB admin overlay

Workboard: `f7e82045-8a92-40f2-a8f6-43710ce65491`
Base: `7dc9f55efaf193dfa8ca8e780b14c29407f39f08`
Date: 2026-09-04

## Implemented

- Added a pure resolver restricted to the exact `github:ThereminGoat/force-curves` source and exact safe repository paths from one card candidate set.
- Mirrored the SwitchesDB ThereminGoat key transform: strip `[$&+,:;=?@#|'<>^*%!]`, replace the exact ` Raw Data CSV.csv` suffix with `~TG.csv`, and `encodeURIComponent` the hash key.
- Paired HighResolutionRaw only to one exact raw sibling with the same parent and exact underscore-to-space filename identity. Missing, tied, unsafe, mixed-repository, inconsistent-ID, unsupported-repository, and nonstandard cases fail closed.
- Made the existing lookup component a controlled dialog taking exact URL and label. It has dialog semantics, trapped focus, Escape/backdrop close, focus return, 44px controls, dark styling, and a `390x844`-safe viewport height.
- Added the in-app action before the unchanged safe canonical GitHub fallback. Unavailable resolution is persistent and card-local.
- View state changes only `openSwitchesDB`; no queue refresh, navigation, review state reset, or API mutation was added.

## Verification

| Command | Result |
| --- | --- |
| `npx tsx --test tests/force-curves.test.ts tests/admin-navigation.test.ts` | PASS — 43/43 |
| `npx tsx --test tests/admin-force-curve-overlay.browser.ts` | PASS — 1/1 at 390x844 |
| `npm test` | PASS — 117/117 |
| `npx prisma generate && npx tsc --noEmit` | PASS |
| `npm run lint` | PASS (exit 0; pre-existing warnings only, none in card files) |
| `npm run build` | PASS — optimized production build, 84/84 static pages |
| `git diff --check` | PASS |

The browser test bundles and renders the real `ForceCurveLookupButton`, asserts two distinct exact iframe fragment URLs, dialog semantics, focus behavior, 44px targets, mobile bounds, staged form/selection/scroll preservation, and an empty trace for `PUT`, `PATCH`, `POST`, and `DELETE`.

## Mutation and release boundary

- Production/database writes: **0**.
- View-flow mutating HTTP requests in browser trace: **0**.
- Schema/migration changes: **0**.
- Pushes/deployments: **0**.
- iOS: N/A (admin web-only surface).
- Remote SwitchesDB dataset rendering and production before/after database counts remain for independent QA; builder did not self-accept or access production.

---

# Builder evidence R2 — exact inventory collision correction

Date: 2026-09-05 EDT
Rejected base: `890932b32734ff1c389501e5964df4a549a0da31`
Exact implementation SHA: `50d6ebd4c85778572ba135a9e167b4fb3df8271b`

## Authoritative inventory contract

- Inspected upstream SwitchesDB source `heralden/switchesdb` at `37ba553fc257758509fb42e17e7b84034d61b22e`.
- `parser/theremingoat.clj` generates a target from the source basename by stripping `[$&+,:;=?@#|'<>^*%!]` and replacing the raw suffix. `parser/commons.clj` overwrites an existing target. `metadata.edn` records only generated key → source and has no reverse upstream path.
- R2 therefore combines the deployed SwitchesDB `data/metadata.edn` key inventory with the complete current, existing ThereminGoat raw repository-path inventory. A source path is marked exact only when its generated key exists in SwitchesDB metadata and exactly one distinct upstream path produces it.
- Metadata fetch failure, parse failure, absent downstream key, or any many-to-one key collision fails closed. The card keeps persistent actionable feedback directing the reviewer to the exact canonical GitHub source; no iframe is created for an unverified path.

## Corrective implementation

- Added a read-only cached inventory loader using only a catalog `aggregate`, catalog `findMany`, and an HTTP GET for `metadata.edn`; the external request has a five-second timeout and no credential forwarding.
- Annotated bounded queue candidates with `verified`, `collision`, or `unavailable` exactness after admin authorization. Both the server-rendered page and authenticated GET refresh path use the same inventory gate.
- Kept the R1 resolver's exact source-group, raw/high-resolution sibling, safe-path, trusted-repository, controlled overlay, and GitHub provenance contracts. No fuzzy name matching or fabricated mapping was added.
- No schema, migration, mutation endpoint, production write, push, deploy, or self-acceptance occurred.

## Live inventory findings

At ThereminGoat tree SHA `a82a8f22a7463ab0c288ae7c4f17e9eb436da922` (recursive tree not truncated):

- Raw source paths: 2,763.
- One-to-one paths present in the deployed SwitchesDB metadata: 2,755.
- Collision paths: exactly `Novelkeys Cream+/Novelkeys Cream+ Raw Data CSV.csv` and `Novelkeys Cream/Novelkeys Cream Raw Data CSV.csv`.
- Both now resolve `available: false`; neither can emit the shared `Novelkeys Cream~TG.csv` iframe URL.
- `AEBoards Naevy EC 17000 Actuations` and `AEBoards Naevy EC 51000 Actuations` remain independently verified and emit distinct exact keys.

## Exact-SHA verification

All commands ran in a detached worktree pinned to `50d6ebd4c85778572ba135a9e167b4fb3df8271b`.

| Command | Result |
| --- | --- |
| `npx tsx --test tests/force-curves.test.ts tests/admin-navigation.test.ts` | PASS — 46/46 |
| `npx tsx --test tests/admin-force-curve-overlay.browser.ts` | PASS — 1/1 at 390×844 dark mode |
| `npm test` | PASS — 115/115 |
| `npx prisma generate && npx tsc --noEmit` | PASS |
| `npm run lint` | PASS, exit 0; existing warnings only |
| `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy npm run build` | PASS — 84/84 static pages; `/admin/force-curves` generated |
| `git diff --check 50d6ebd^ 50d6ebd` | PASS |

The shared dirty checkout also passed its current full runner at 120/120; the detached count above is the reproducible exact-commit count.

## Browser and zero-write evidence

- Real component browser test at 390×844 dark mode retained the direct exact iframe, staged target/override/reason/action, scroll position, Escape close, focus trap/return, 44px controls, and zero POST/PUT/PATCH/DELETE requests.
- OpenClaw managed-browser verification at 390×844 dark mode loaded both exact AEBoards 17000 and 51000 hashes separately. Each rendered one canvas with the correct selected source. The 51000 transition issued one request, GET of the exact CSV (200); browser errors: 0; mutating requests: 0.
- R2 adds no write query or mutating browser request. Production/database writes performed by builder: 0. Production before/after database counts remain unavailable to builder and must be collected by independent QA if that release gate is required.
- iOS remains N/A because this is an authenticated admin-only web surface.

## Builder verdict

**BUILDER_PASS** for corrective implementation `50d6ebd4c85778572ba135a9e167b4fb3df8271b`. Independent QA remains the acceptance gate.
