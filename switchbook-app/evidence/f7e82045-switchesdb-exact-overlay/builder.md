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
