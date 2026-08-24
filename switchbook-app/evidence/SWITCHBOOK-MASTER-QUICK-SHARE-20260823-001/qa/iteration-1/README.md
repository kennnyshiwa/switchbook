# SWITCHBOOK-MASTER-QUICK-SHARE-20260823-001 — QA iteration 1

Verdict: **PASS_VERIFIED**

## Automated validation

- `npm test`: 31/31 passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; 78/78 pages generated.
- Existing lint warnings were unchanged and non-blocking.

## Browser acceptance

The real local `/switches/browse` page and `MasterSwitchDetailsPopup` were exercised in Chromium through CDP. The local PostgreSQL endpoint at `localhost:55432` was unavailable, so the browse API call was deterministically intercepted with two records shaped from the production master-switch API: one with production `shareableId` `HdVGho4j7-`, and one with `shareableId: null`. No application code or database data was changed.

- Clicking a master card opened the popup.
- `Copy Share Link` immediately follows `View Full Details` in DOM order and on the same desktop row.
- Clicking it changed the visible label to `Copied!`.
- The OS clipboard contained exactly `http://127.0.0.1:3010/share/switch/HdVGho4j7-` (the current origin plus canonical path).
- The corresponding production canonical URL returned HTTP 200.
- The record without `shareableId` rendered no copy action.
- At 390x844, Full Details and Copy Share Link remained visible and usable; the action wrapped beneath Full Details without overflow.
- Full Details, Link to Collection, Suggest Edit, Add to Wishlist, and Add to Collection remained present.
- Copy is a semantic button with accessible name `Copy share link`; Full Details and Suggest Edit remain semantic links.

## Files

- `browser-acceptance.json`: DOM order, link targets, exact expected URL, geometry, missing-ID and mobile assertions.
- `popup-dom.html`: captured mobile popup DOM.
- `desktop-popup-before-copy.png`: desktop state before copy.
- `desktop-popup-copied-fresh.png`: fresh desktop `Copied!` state.
- `desktop-popup-no-share-id.png`: missing-ID omission.
- `mobile-popup.png`: 390x844 layout.

No deployment was performed.
