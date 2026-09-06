# Builder rework R3 evidence

- Workboard: `19b697c1-9b4f-4989-bc4c-7314602cfc62`
- Exact parent: `ad9bdc788445c9bdd2fb0e1e57129051c2671909`
- Required deployed-behavior base: `5c6f9d46fbcd23b13572a8b9206921c87a8365e3`
- Partner candidate `72918587a12a18b6611aa265a61a68bd630ca202` was not accessed or changed.
- Checkout began on the exact parent with no tracked changes.

## Root cause and correction

The normal-surface browser regression detached the dialog and immediately sampled
`document.activeElement`, but `ForceCurveLookupButton` intentionally restores exact
trigger focus on the next animation frame. The product behavior returned focus
correctly after that frame; the committed assertion raced the documented behavior.

The regression now uses Playwright's condition-based `waitForFunction` to wait until
the exact Collections trigger is `document.activeElement`. It adds no fixed sleep,
preserves the iframe-focused Escape path, and does not weaken the exact focus target.
No product or admin file changed in R3.

## R3 allowlist

1. `evidence/19b697c1-force-curve-surfaces-r3/builder.md`
2. `switchbook-app/tests/force-curve-surfaces.browser.ts`

## Verification

- Pre-change reproduction:
  - `npx tsx --test tests/force-curve-surfaces.browser.ts tests/admin-force-curve-overlay.browser.ts`
  - 2/3 pass; normal-surface exact focus-return assertion fails at line 150.
- Exact committed Chromium command after correction:
  - `npx tsx --test tests/force-curve-surfaces.browser.ts tests/admin-force-curve-overlay.browser.ts`
  - 3/3 pass at 390x844.
  - Same unmodified command repeated 10 additional times: 30/30 tests pass.
  - Coverage retained for admin overlay and GitHub provenance, Collections and Master
    Database exact one/multi overlays, auth/flag parity, exact iframe Escape and focus
    return, staged/form/filter/query/scroll state, and zero POST/PUT/PATCH/DELETE.
- `npx tsx --test tests/force-curves.test.ts tests/admin-navigation.test.ts` — 48/48 pass.
- `npm test` — full suite 117/117 pass.
- `npx tsc --noEmit` — pass with 0 diagnostics.
- `npm run lint` from an external clean validation checkout — pass with 0 errors and
  26 pre-existing warnings. The nested builder checkout itself still triggers Next's
  duplicate-config discovery artifact because its parent repository has the same
  ESLint config and dependency tree.
- `npm run build` without a font mock — blocked only by denied Google Fonts egress.
  Re-run from the clean validation checkout with Next's documented build-only
  `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` — pass; 84/84 static pages generated. The
  temporary mock was removed and is not committed.
- `git diff --check` — pass.
- Exact admin preservation check against `5c6f9d46` — pass (zero diff):
  - `src/app/admin/force-curves/page.tsx`
  - `src/app/api/admin/force-curves/reviews/route.ts`
  - `src/components/admin/ForceCurveReviewQueue.tsx`
  - `src/lib/admin-force-curve-switchesdb-inventory.ts`
  - `src/lib/admin-force-curve-switchesdb.ts`

## Boundaries

No push, CI, deploy, production access/mutation, Workboard completion, or
self-acceptance was performed.
