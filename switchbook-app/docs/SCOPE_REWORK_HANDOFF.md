# CSV all-fields + quantity-all-locations implementation handoff

**Implementation complete for independent review; not self-accepted or deployed.**

## Review location

- Worktree: `/Users/kennnyshiwa/.openclaw/workspace-builder/switchbook-scope-20261101`
- Branch: `fix/csv-quantity-scope-20261101`
- Base: `73c3509bcb35449d33297a52c1ff4b97bdda337a`, current main containing the separately authored dependency upgrade. Released ancestor: `8cd2eacf620dca96ad30140e2ecabd7ccce7e4bb`.
- Review diff: branch tip against that base. No push, PR, merge or deployment performed.
- Main checkout remains at the base with its original five untracked entries; its package files were never edited/stashed/reverted/staged by this pass.
- `package.json`, `package-lock.json`, Prisma schema and nullable quantity migration are unchanged. No backfill.

## Delivered changes

1. Sparse CSV/single PUT/bulk PUT/notes PATCH preserve all omitted fields; explicit blanks clear. Full-form blanks/NaN and numeric zero have regression coverage.
2. Owned collection-ID overwrite only, repeated-ID detection, ambiguous/name-only/edited identity blocking, explicit create-new/skip choices. Create choices cannot turn into overwrite after preview row removal. Server owner/path identity checks remain authoritative.
3. Lossless long catalog/legacy notes and personal notes. Collection validation follows database text/finite-number capabilities, with no arbitrary text caps, trimming, manufacturer alias rewriting or spring/magnetic text normalization on native imports. Quantity constraints remain unchanged.
4. 45-column CSV including gallery reference JSON, legacy image URL and owned identity hint. Captions/alt/order/primary/provenance preserved; fresh image IDs, owned relations and deterministic primary remapping; no server URL fetch. Explicit gallery replacement is transactional and never silently inherits current-master photos. File cleanup now respects references and source ownership.
5. Unlinked Personal Notes displayed/edited in forms/cards/tables, including failed submission; browser regression exercises the actual move-then-fail flow.
6. Shared exhaustive master copy/modified contract, including tactilePosition and Franken fields. Partial/bulk/notes comparisons use merged state; catalog suggestion fields/zero/clear semantics aligned; submit-to-master carries Franken/zero specs without inventory.
7. Quantity labels, numeric asc/desc with unknown last, known-units/unknown-entry summary for private/shared collections, optional validated catalog add quantity. Touched zero-valued spec displays corrected.

Exhaustive matrices: [CSV_FIELD_LOCATION_COVERAGE.md](CSV_FIELD_LOCATION_COVERAGE.md): all **54 Switch members**, all **22 SwitchImage members**, and quantity location contracts. It explicitly distinguishes user data from IDs, timestamps, share tokens and current-master metadata.

## Commands and final results

Working directory for application commands: `/Users/kennnyshiwa/.openclaw/workspace-builder/switchbook-scope-20261101/switchbook-app`.

| Command | Result |
|---|---|
| `npm ci` | Exit 0; isolated install, no package file edits. |
| `node /Users/kennnyshiwa/.openclaw/workspace-qa/evidence/switchbook-8cd2eac-scope-audit/audit-probes.cjs` | Exit 0; **12 baseline probe groups** confirmed, including real PUT/bulk route defects against unchanged baseline source. No DB/network fixture access. |
| `npm test` | Exit 0; **230 passed / 0 failed / 0 skipped**. Includes **36 new scope-rework route/helper regressions**; existing tests updated for intended policy changes. |
| `npx tsx --test tests/scope-rework.browser.ts tests/collection-refresh.browser.ts` | Exit 0; **2 passed / 0 failed**. Headless Chromium, actual React UI, mocked external APIs/auth and secondary widgets; not authenticated production acceptance. |
| `npx tsc --noEmit` | Exit 0; **0 diagnostics**. |
| `npm run lint` | Exit 0; **26 warnings / 0 errors**: 22 next/no-img-element, 4 hooks dependencies. Plus Next 15 next-lint deprecation notice. |
| Initial `npm run build` | Exit 1 solely on Google Inter download. Independent curl reproduced environment proxy CONNECT **403**. Preserved as evidence, not silently relabeled a pass. |
| `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/tmp/switchbook-scope-font/responses.cjs npm run build` | Exit 0, using existing cached actual Inter latin WOFF2 from main's ignored `.next/static/media` and Next's supported font test fixture. No source/config/dependency changes. **87/87** static pages. |
| Final plain `npm run build` | Exit 0 with warmed local font cache, compiled successfully, **87/87** static pages, same **26 lint warnings**. No font environment override in this final invocation. A fresh uncached build still needs font network access or the documented fixture. |
| `git diff --check` | Exit 0. |
| Dependency/schema/migration diff check | Exit 0; no changes to package files, Prisma schema or quantity migration. |

Final complete logs and reproducible font fixture: `/Users/kennnyshiwa/.openclaw/workspace-builder/evidence/switchbook-scope-20261101`. `results.json`, `warnings.json`, `SHA256SUMS.json` summarize evidence. Earlier failing test runs were used to fix refactor errors and update obsolete cap assertions; final counts above are from the finished source.

The supplemental cold build also emitted **10 Edge-runtime compatibility warnings** through existing auth/email imports (email crypto:1, Prisma setImmediate:1, bcrypt crypto/setImmediate:3, jose CompressionStream/DecompressionStream:2, mailgun setImmediate/process.nextTick:3), one webpack large-string cache warning and one Tailwind config ES-module warning. Final warm build did not re-emit those cached compilation warnings. These are retained in `build-cached-font.log`; no unrelated dependency/auth/toolchain changes made here.

## Exact lint warning files

| File | Count |
|---|---|
| `src/app/admin/master-switches/page.tsx` | 1 |
| `src/app/auth/login/page.tsx` | 1 |
| `src/app/auth/register/page.tsx` | 1 |
| `src/app/credits/page.tsx` | 1 |
| `src/app/dashboard/bulk-edit/page.tsx` | 2 |
| `src/app/dashboard/page.tsx` | 1 |
| `src/app/page.tsx` | 4 |
| `src/app/switches/[id]/page-client.tsx` | 1 |
| `src/app/wishlist/page.tsx` | 1 |
| `src/components/AddSwitchModal.tsx` | 2 |
| `src/components/CanonicalSwitchShare.tsx` | 1 |
| `src/components/ImageCarousel.tsx` | 1 |
| `src/components/MasterSwitchDetailsPopup.tsx` | 1 |
| `src/components/MasterSwitchEditForm.tsx` | 1 |
| `src/components/MasterSwitchSubmissionForm.tsx` | 1 |
| `src/components/MasterSwitchSuggestions.tsx` | 1 |
| `src/components/SwitchImageManager.tsx` | 1 |
| `src/components/VirtualSwitchList.tsx` | 2 |
| `src/components/WishlistCollection.tsx` | 1 |
| `src/components/WishlistDetailsPopup.tsx` | 1 |

## Residual bounds / independent QA focus

- No fresh live database/authenticated production fixtures, CI, backup, Compose or deployment gate was run. Parent arranges independent QA and final integration/main push.
- Media references depend on existing media availability. No binary/offline archive or whole-account backup. Gallery replacement conservatively retains files; unreferenced-file garbage collection is not added.
- Bulk scalar API rejects explicit image fields; CSV uses transactional single POST/PUT routes. Scalar null/blank/omission, create/overwrite and linked/unlinked image cases are covered by route tests with database boundaries mocked, not a real PostgreSQL transaction exercise.
- Existing notes PATCH and master submission are still separate requests. Failed submission leaves moved text in Personal Notes, now always visible/editable; this is tested, not claimed atomic.
- Master lineage/version is contextual, not a historical catalog snapshot. A missing master falls back unlinked; in-place persisted unlink is not a supported feature and is not claimed.
- Quantity values above the unchanged 1,000,000 application cap written outside the application still reject on import. No evidence of such data; no cap expansion/backfill performed.
- No audit issue was silently dismissed: all seven meaningful groups addressed; external curve preferences, account state, moderation data, offline binaries and current catalog objects are explicitly outside this Switch CSV scope in the coverage document.

## Rollback

Revert the focused implementation commit if rejected. No schema/migration or production state to roll back in this pass. A later production CSV overwrite is a user data mutation: reverting code would not restore previously overwritten rows; independent QA should use owned disposable fixtures and parent-controlled backup gates.

## Exact changed-file inventory

**45 files** in the focused commit (including this handoff and coverage document):

- `switchbook-app/docs/CSV_FIELD_LOCATION_COVERAGE.md`
- `switchbook-app/docs/SCOPE_REWORK_HANDOFF.md`
- `switchbook-app/src/app/api/master-switches/[id]/add-to-collection/route.ts`
- `switchbook-app/src/app/api/master-switches/[id]/link-existing/route.ts`
- `switchbook-app/src/app/api/master-switches/search/route.ts`
- `switchbook-app/src/app/api/master-switches/submit/route.ts`
- `switchbook-app/src/app/api/switches/[id]/images/route.ts`
- `switchbook-app/src/app/api/switches/[id]/label/route.ts`
- `switchbook-app/src/app/api/switches/[id]/route.ts`
- `switchbook-app/src/app/api/switches/[id]/sync-master/route.ts`
- `switchbook-app/src/app/api/switches/[id]/update-notes/route.ts`
- `switchbook-app/src/app/api/switches/bulk/route.ts`
- `switchbook-app/src/app/api/switches/export/route.ts`
- `switchbook-app/src/app/api/switches/route.ts`
- `switchbook-app/src/app/api/switches/sync-all-master/route.ts`
- `switchbook-app/src/app/dashboard/bulk-edit/page.tsx`
- `switchbook-app/src/app/dashboard/bulk-upload/page.tsx`
- `switchbook-app/src/app/share/[shareableId]/page.tsx`
- `switchbook-app/src/app/switches/[id]/page-client.tsx`
- `switchbook-app/src/app/switches/browse/page-client.tsx`
- `switchbook-app/src/components/AccountSettings.tsx`
- `switchbook-app/src/components/CollectionControls.tsx`
- `switchbook-app/src/components/CollectionStats.tsx`
- `switchbook-app/src/components/EditSwitchModal.tsx`
- `switchbook-app/src/components/MasterSwitchSuggestions.tsx`
- `switchbook-app/src/components/SwitchCard.tsx`
- `switchbook-app/src/components/SwitchCollection.tsx`
- `switchbook-app/src/components/SwitchForm.tsx`
- `switchbook-app/src/components/SwitchTable.tsx`
- `switchbook-app/src/lib/collection-quantity.ts`
- `switchbook-app/src/lib/master-switch-form.ts`
- `switchbook-app/src/lib/master-switch-modifications.ts`
- `switchbook-app/src/lib/switch-image-references.ts`
- `switchbook-app/src/lib/switch-import-identity.ts`
- `switchbook-app/src/lib/switch-label.ts`
- `switchbook-app/src/lib/switchCsv.ts`
- `switchbook-app/src/lib/validation.ts`
- `switchbook-app/src/utils/dataTransform.ts`
- `switchbook-app/tests/collection-refresh.browser.ts`
- `switchbook-app/tests/master-match-images.test.ts`
- `switchbook-app/tests/run-tests.ts`
- `switchbook-app/tests/scope-rework.browser.ts`
- `switchbook-app/tests/scope-rework.test.ts`
- `switchbook-app/tests/switch-csv-roundtrip.test.ts`
- `switchbook-app/tests/switch-quantity.test.ts`
