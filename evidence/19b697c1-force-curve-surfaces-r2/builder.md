# Builder rework R2 evidence

- Workboard: `19b697c1-9b4f-4989-bc4c-7314602cfc62`
- Exact parent: `5c6f9d46fbcd23b13572a8b9206921c87a8365e3`
- Rejected commit `2814dd7fe34bb3c78b79d71ba6ac88c00106ab37` was inspected only; it was not cherry-picked.
- Partner candidate `72918587a12a18b6611aa265a61a68bd630ca202` was not accessed or changed.
- Checkout began clean and isolated.

## Scope

Normal Collections and Master Database `ForceCurvesButton` controls now use exact SwitchesDB overlays. One exact measurement opens directly; multiple exact measurements use the existing accessible labeled picker. The read API projects only complete, distinct, inventory-verified exact measurements and fails the complete control closed for missing, tied, colliding, unsafe, unsupported, or unavailable inventory. Canonical GitHub source URLs remain available in each normal overlay.

The deployed admin review queue behavior was preserved. No admin page, admin API route, admin review queue component, or admin SwitchesDB resolver/inventory file differs from the parent.

## Allowlist

1. `evidence/19b697c1-force-curve-surfaces-r2/builder.md`
2. `switchbook-app/src/app/api/force-curves/[masterSwitchId]/route.ts`
3. `switchbook-app/src/components/ForceCurveLookupButton.tsx`
4. `switchbook-app/src/components/ForceCurvesButton.tsx`
5. `switchbook-app/src/components/SwitchCollection.tsx`
6. `switchbook-app/src/lib/force-curve-switchesdb.ts`
7. `switchbook-app/src/lib/force-curves.ts`
8. `switchbook-app/tests/force-curve-surfaces.browser.ts`
9. `switchbook-app/tests/force-curves.test.ts`

## Verification

- `npx tsc --noEmit` — pass.
- `npx tsx --test tests/force-curves.test.ts tests/admin-navigation.test.ts` — 48/48 pass.
- `npx tsx --test tests/force-curve-surfaces.browser.ts` — 2/2 Chromium tests pass at 390x844:
  - deployed admin review overlay remains available together with exact GitHub provenance;
  - Collections exact one/multi and Master Database exact one/multi;
  - authenticated and unauthenticated controls behave identically for viewing, the disabled flag renders no control;
  - exact stock/retest/date/source labels and stable measurement IDs remain distinct;
  - focus containment/return, iframe Escape, URL/form/filter/scroll state, and zero POST/PUT/PATCH/DELETE.
- `npx tsx --test tests/admin-force-curve-overlay.browser.ts` — existing admin browser regression 1/1 pass.
- `npm test` — full suite 117/117 pass.
- `npm run lint` from the external clean checkout — pass with 0 errors and 26 pre-existing warnings.
- `npm run build` initially reached Next compilation but Google Fonts egress was denied (`CONNECT tunnel failed, 403`). Re-run with Next's documented build-only mocked Google-font response — pass; 84/84 static pages generated. The temporary mock was removed and is not committed.
- `git diff --check` — pass.
- Exact admin preservation check — pass (zero diff):
  - `src/app/admin/force-curves/page.tsx`
  - `src/app/api/admin/force-curves/reviews/route.ts`
  - `src/components/admin/ForceCurveReviewQueue.tsx`
  - `src/lib/admin-force-curve-switchesdb-inventory.ts`
  - `src/lib/admin-force-curve-switchesdb.ts`

## Boundaries

No push, CI, deploy, production access/mutation, Workboard completion, or self-acceptance was performed.
