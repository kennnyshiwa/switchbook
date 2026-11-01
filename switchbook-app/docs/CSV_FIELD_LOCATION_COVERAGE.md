# Collection CSV and quantity coverage — scope repair

Implementation review artifact; not independent QA acceptance or deployment approval.

## Isolation and source evidence

- Worktree: `/Users/kennnyshiwa/.openclaw/workspace-builder/switchbook-scope-20261101`.
- Branch: `fix/csv-quantity-scope-20261101`.
- Base: `73c3509bcb35449d33297a52c1ff4b97bdda337a` (original review baseline; parent is released `8cd2eacf620dca96ad30140e2ecabd7ccce7e4bb`). Dependency/security changes are inherited, not edited or included in the focused diff.
- Follow-up input: independent QA `workspace-qa/evidence/switchbook-477759b-review/REPORT.md` and its captured payload, base comparison, real-route probes and local-file alias proof. Only F1/F2 repaired after `477759b`.
- Initial inputs: QA `workspace-qa/evidence/switchbook-8cd2eac-scope-audit/REPORT.md`; ops `workspace-ops/switchbook-authenticated-acceptance-20261101T231000Z.md`.
- Baseline QA probe rerun against unchanged main confirmed all 12 groups, including actual sparse PUT data loss, notes rejection and bulk modified-state drift. Those passing probe assertions confirm defects, not product acceptance.
- No production access/mutations, migration/backfill, push, deployment, PR or main-checkout edits in this pass.

## Import/update contract

1. **Omitted means preserve.** Single PUT, bulk PUT and notes PATCH validate partial inputs and transform only present fields. Missing CSV columns and short trailing rows omit keys. Full forms send explicit empty strings/NaN (JSON null) to clear; zero and false remain values. Required name cannot be cleared. Bulk-edit grid blanks now retain explicit intent: text/enum/material cells send empty strings, numeric cells send null. Never-edited absent fields still omit; the API sparse transform is unchanged.
2. **Explicit empty means clear.** Text/enum/date clears to null, numeric blank/null to null, spring flags to false, tags to []. Empty galleries clear owned relations and primary selection, independently of legacy URL. To remove every photo reference, clear both Image References and Legacy Image URL.
3. **Owned identity, not names.** Exported Collection Switch ID is only an overwrite hint. Names/makers are never sufficient to overwrite. Repeated IDs, edited name/maker, and ambiguous name collisions default to skip and offer explicit create-new. Within-file duplicates are detected. Removing another row cannot convert a create choice into overwrite. Single route checks ID/path consistency and owner; bulk rejects repeated target IDs.
4. **Text fidelity.** Native export uses RFC4180, UTF-8 BOM, quoted CR/LF and JSON tags/gallery. Name, manufacturer, spring descriptions and magnetic text are not trimmed/aliased on import. Empty string and database null are equivalent for optional text; whitespace-only strings are preserved. Unquoted hand-written CSV cells still trim; enum aliases and delimited tags remain supported. Malformed numeric/boolean cells and unclosed quotes report errors. Missing names remain visible as errors, not dropped rows.
5. **Validation harmonized.** Collection strings have no arbitrary app length caps; measurements accept finite database/catalog values rather than narrower collection-only ranges. Browser measurement inputs use `step="any"`; quantity retains integer/range constraints. No truncation. No schema/migration change.
6. **Catalog copying.** One tracked-spec contract drives catalog search/form selection, add-to-collection, link, sync, sync-all and modification tracking. Fresh linked POST seeds omitted specs from current master, explicit supplied values win and differences are truthful. Native imports retain snapshot specs; an older master version is not an archived master body. Submit-to-master copies Franken fields and numeric zero, but never inventory/personal data.
7. **CSV references, not media backup.** Import never fetches a URL or reads a file; source media must remain available. HTTP(S) or safe public `/uploads/` references only. User IDs, image IDs, master image ownership and public tokens are never restored. Not a binary archive or whole-account backup. Owned-upload cleanup compares canonical local asset paths across gallery, collection legacy and master legacy references, including same-origin absolute URLs, redundant slashes, encoded paths and same-row aliases. Hostnames are not used to prove absence (proxy/host aliases conservatively retain). Unparseable references or failed lookups retain the file; foreign/master ownership rules are unchanged.

## Exhaustive Switch member matrix (54 members; 51 scalars/enums + 3 relations)

There are **45 CSV columns**: 44 scalar values/hints plus Image References. Every member is accounted for below. Ordinary portable scalars use the common omitted/blank contract above.

| Member | Prisma type | CSV / representation | Treatment |
|---|---|---|---|
| `id` | `String` | Collection Switch ID | Identity hint only: overwrite requires this ID in the current account and unchanged identity. Create always generates a new ID; foreign/missing IDs never address another account. |
| `name` | `String` | Switch Name | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `type` | `SwitchType?` | Type | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `springWeight` | `String?` | Spring Weight | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `springLength` | `String?` | Spring Length | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `actuationForce` | `Float?` | Actuation Force (g) | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `bottomOutForce` | `Float?` | Bottom Out Force (g) | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `preTravel` | `Float?` | Pre-travel (mm) | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `bottomOut` | `Float?` | Bottom Out (mm) | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `manufacturer` | `String?` | Manufacturer | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `notes` | `String?` | Notes | Unbounded PostgreSQL text, same as catalog/legacy policy; no truncation, no collection-only length cap. Native CSV preserves whitespace and CR/LF. |
| `imageUrl` | `String?` | Legacy Image URL | Portable legacy image reference, independent of gallery. Blank clears; omission preserves on PUT. No fetch. |
| `topHousing` | `String?` | Top Housing | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `bottomHousing` | `String?` | Bottom Housing | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `stem` | `String?` | Stem | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `dateObtained` | `DateTime?` | Date Obtained | Full ISO timestamp retained by native CSV/API, including milliseconds. Bulk and single-edit forms omit unchanged/reverted dates, preserving untouched timestamp precision; deliberate picker changes edit calendar dates and explicit blanks clear. |
| `createdAt` | `DateTime` | Excluded | New database timestamp; not user-authored data. |
| `updatedAt` | `DateTime` | Excluded | New database timestamp; not user-authored data. |
| `userId` | `String` | Excluded | Current authenticated owner only; never imported. |
| `chineseName` | `String?` | Chinese Name | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `compatibility` | `String?` | Compatibility | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `magnetOrientation` | `String?` | Magnetic Pole Orientation | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `technology` | `SwitchTechnology?` | Technology | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `magnetPosition` | `String?` | Magnet Position | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `initialForce` | `Float?` | Initial Force (g) | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `initialMagneticFlux` | `Float?` | Initial Magnetic Flux (Gs) | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `bottomOutMagneticFlux` | `Float?` | Bottom Out Magnetic Flux (Gs) | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `pcbThickness` | `String?` | PCB Thickness | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `magnetPolarity` | `String?` | Magnet Polarity | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `frankenBottom` | `String?` | Franken Bottom | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `frankenStem` | `String?` | Franken Stem | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `frankenTop` | `String?` | Franken Top | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `isModified` | `Boolean` | Derived | Recomputed for linked imports/updates against current master specs, not historical master contents. No manual status control exists in the collection forms. |
| `masterSwitchId` | `String?` | Master Switch ID | Catalog lineage hint. POST validates approved master; CSV retries missing/unapproved master as unlinked without losing personal fields/gallery. PUT preserves target linkage; it does not relink/unlink. |
| `masterSwitchVersion` | `Int?` | Master Switch Version | Historical version hint: positive version <= current retained; explicit null retained. Invalid/future version falls back to current. PUT retains target version. Current master data is not archived. |
| `modifiedFields` | `Json?` | Derived | Shared exhaustive scalar comparison; bulk and notes-only updates compare the merged row. Not portable user text. |
| `personalNotes` | `String?` | Personal Notes | Unbounded user text; visible/editable linked or unlinked, including after failed submission. Link merges old notes without truncation. Shared collections also display it: not a private-secret field. |
| `primaryImageId` | `String?` | Image References[].primary | Selection meaning preserved; reference remapped to a fresh server-generated image ID. Never import a source image ID. |
| `doubleStage` | `Boolean` | Double Stage | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `progressiveSpring` | `Boolean` | Progressive Spring | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `tactileForce` | `Float?` | Tactile Force (g) | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `clickType` | `ClickType?` | Click Type | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `tactilePosition` | `Float?` | Tactile Position (mm) | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `personalTags` | `String[]` | Personal Tags | JSON string array; preserves whitespace, commas, quotes and Unicode. Blank/[] clears; absent preserves. Delimited hand-written tags remain supported. |
| `quantity` | `Int?` | Quantity | Nullable owner-only integer 0..1,000,000. Blank/null clears; zero persists; absent preserves. |
| `bottomHousingColor` | `String?` | Bottom Housing Color | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `markings` | `String?` | Markings | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `stemColor` | `String?` | Stem Color | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `stemShape` | `String?` | Stem Shape | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `topHousingColor` | `String?` | Top Housing Color | Portable user spec; copied/compared only where shared with master. Text preserved verbatim; finite measurements preserve zero. |
| `shareableId` | `String?` | Excluded | Unique public token; never imported. Existing overwrite retains its token; a new copy needs a new share link. |
| `masterSwitch` | `MasterSwitch?` | Excluded relation | Current catalog object, ownership, moderation, scores and metadata are not a collection snapshot. |
| `user` | `User` | Excluded relation | Account identity/password/preferences are not exported; ownership binds to current session. |
| `images` | `SwitchImage[]` | Image References (JSON) | Portable gallery described below; IDs/ownership are regenerated. Explicit []/blank clears owned gallery and primary; omission preserves on update. |

## Exhaustive image-member matrix

Image References is a JSON array with URL, type, display order, metadata and optional `primary: true`. Export strips database identifiers. Import generates new image IDs before inserting, so primary mapping is deterministic even for equal URLs/orders. All gallery writes and switch scalar writes are in one transaction. A linked native import with its own gallery (including []) never inherits the current master gallery.

| SwitchImage member | Representation / handling |
|---|---|
| `id` (`String`) | Never imported; fresh server-generated ID. Source primary selection maps by array position before database insertion. |
| `switchId` (`String?`) | Never imported; bound to the current owned/new switch. |
| `masterSwitchId` (`String?`) | Never imported; no foreign/master ownership copied. Existing dual-owned records detach from the user on replacement, remain with master. |
| `url` (`String`) | Portable HTTP(S) or safe /uploads/ reference; no server fetch. |
| `type` (`ImageType`) | UPLOADED/LINKED provenance carried; not proof of physical-file ownership. |
| `order` (`Int`) | Portable integer display order; not silently renumbered on CSV restore. |
| `caption` (`String?`) | Portable verbatim user text, including whitespace/newlines and legacy long captions. |
| `width` (`Int?`) | Carried as nullable derived metadata; no media reinspection. |
| `height` (`Int?`) | Carried as nullable derived metadata; no media reinspection. |
| `size` (`Int?`) | Carried as nullable derived metadata; no bytes uploaded, ownership or deletion rights conferred. |
| `uploadedAt` (`DateTime`) | New row timestamp; not portable user data. |
| `altText` (`String?`) | Portable verbatim accessible metadata. |
| `remoteUrl` (`String?`) | Portable provenance text, preserved verbatim when represented; not interpreted or fetched. |
| `sourceUrl` (`String?`) | Portable provenance text, preserved verbatim when represented; not interpreted or fetched. |
| `sourceName` (`String?`) | Portable provenance text, preserved verbatim when represented; not interpreted or fetched. |
| `license` (`String?`) | Portable provenance text, preserved verbatim when represented; not interpreted or fetched. |
| `attribution` (`String?`) | Portable provenance text, preserved verbatim when represented; not interpreted or fetched. |
| `checksumSha256` (`String?`) | Not restored; derived media integrity metadata, not user-authored. No checksum verification or media fetch performed. |
| `revision` (`Int`) | New row default; bookkeeping, not portable user data. |
| `masterSwitch` (`MasterSwitch?`) | Excluded catalog relation; no master writes from CSV import. |
| `switch` (`Switch?`) | New owned relation. |
| `partnerSubmissionPhotos` (`PartnerSubmissionPhoto[]`) | Excluded partner moderation relation; never assigned/copied. |

**Cleanup:** gallery replacement removes only owned database relations, never media files. Image deletion only deletes a physical uploaded file under that owned switch’s upload directory when no other image, legacy collection URL or master legacy URL references it. Linked/foreign-path/master-owned references cannot delete their source files. Shared records are detached rather than deleting the master’s image. Replacement can leave unreferenced files: conservative retention is intentional; no new garbage collector is introduced.

## Quantity surface matrix

| Surface / flow | Contract and verification |
|---|---|
| Prisma Switch / additive migration | Existing nullable Int and nonnegative CHECK unchanged. No defaults/backfill; unknown is not zero. Application max remains 1,000,000. |
| Manual add / selected-master add / pending link removal | Optional SwitchForm quantity; zero/blank validation. Master selection only copies tracked specs, never quantity. |
| Catalog browse quick-add | Optional native quantity confirmation; blank=unknown, cancel=no add, invalid=no request; POST sends quantity. Browser covered. |
| Browse popup quick-add | Same browse handler and quantity confirmation. Existing collection browser regression covers popup. |
| Catalog detail quick-add | Same optional confirmation and validated owner-only POST; browser covered. |
| Catalog add-to-collection API | Parses optional body; validates quantity; creates owned Switch with shared master specs. Never writes quantity to MasterSwitch. Route tests cover absent/null/0/12 and invalid values. |
| Individual edit | Nullable quantity input; full-form explicit blank clears. Long/legacy notes remain saveable; browser sends zero and measurement clear. |
| POST /api/switches | Create only owner inventory; imported quantity independent of catalog state. Route roundtrip tests cover zero and nonzero. |
| PUT /api/switches/[id] | Sparse quantity-only update preserves all other omitted scalars/images. Explicit blank/null clears. Ownership/path-ID checks. |
| Bulk create API | Quantity validated by shared schema; owner-only. This scalar endpoint is not gallery restore; supplied imageReferences/imageUrl explicitly reject. |
| Bulk update API | Partial per-row update; repeated IDs reject; merged modified state recomputed. Explicit gallery fields reject, not silently dropped. |
| Bulk edit grid | Existing nullable integer column/zero preserved. Measurement bounds/steps aligned with catalog values; no quantity backfill. |
| CSV export and template | Quantity column present; null blank; numeric 0 represented. Shared 45-column contract. |
| CSV mapping, preview, create and overwrite | Qty alias; invalid quantities block row; blank clears and missing preserves; owned identity rules above. |
| Owner list/single GET / dashboard payload | Raw owned Switch includes quantity; no new derived inventory storage. |
| Cards / virtual collection grid | Shared SwitchCard displays quantity including 0, hides unknown. Numeric-zero spec guards fixed too. |
| Table | Qty including 0; unknown hidden. Personal Notes visible in both link states; zero measurements display. |
| Owner collection sort | Numeric quantity ascending/descending; unknown always last, stable equal values. Shared comparator regression tests. |
| Shared collection sort | Same comparator/null policy; controls offer both orders. |
| Owner quantity filters | Existing numeric min/max including zero; unknown excluded when active bound applies. No new unknown-only filter required. |
| Shared quantity filters | Existing shared bounds and zero handling retained. |
| Owner stats | Entry count + sum of known units + count of unknown-quantity entries. Charts remain explicitly entry-based. |
| Shared stats | Same CollectionStats component and inventory summary; underlying Switch payload already contains quantity. |
| Shared collection cards/table | Same components and quantity display rules as owner views; public data is not private. |
| Individual user switch share | Existing canonical personal section carries quantity, including 0, and unlinked personal notes. |
| Printed 4×6 label | Real route selects quantity; renderer prints quantity including 0, omits unknown. |
| Link existing to master | Preserves quantity/tags/date/personal notes (ordinary notes deliberately merged into personal notes); shared spec copy excludes inventory. |
| Submit to master | Allowlist excludes quantity/personal notes/tags; preserves existing collection inventory. Franken and zero specs now survive subsequent sync. |
| Sync/reset one and sync all | Never inherit/write master quantity; preserve owner quantity and personal fields. All tracked specs copied. |
| Missing-master CSV fallback | POST retry unlinked retains snapshot quantity, notes, tags and image references. |
| Persisted in-place unlink | No existing supported control/endpoint; not implemented or claimed tested. Pending-add unlink and missing-master fallback are different flows. |
| Master cards, master shares, catalog stats, force-curve definitions | Correctly quantity-free: these are catalog/spec objects, not owned inventory. |
| JSON owner/share endpoints | Quantity included in existing JSON reads; not a new backup/restore platform. |

## Adjacent audit findings and deliberate bounds

- All seven requested meaningful issue groups are addressed; none dismissed as unreal. The audit’s “backup” concern is addressed for scalar/user image-reference data, not offline media bytes.
- Force-curve preferences, username/account settings, wishlist/ratings, submission/moderation records and current-master metadata are not Switch snapshot data. Export wording explicitly avoids whole-account backup claims. No JSON backup platform added.
- Public share tokens, owner IDs and image database IDs are intentionally not portable. Share URLs do not follow a new imported copy. Current-master comparison can legitimately mark an old snapshot modified.
- Database quantity values written outside app validation above 1,000,000 still reject on import. No evidence of such values was supplied; the authorized nullable migration and existing cap are preserved, not widened or backfilled.
- Hand-written unquoted cells trim and enum aliases canonicalize; native exported quoted text is preserved. Optional empty text/null are semantically equivalent. Browser textareas/date pickers are editing controls, not byte-archive tools.
- Unsupported/malformed image references block the row rather than silently lose images. URL reachability and media lifetime are not verified. Captions/provenance do not grant filesystem ownership.
- Bulk scalar API is not the CSV restoration endpoint: the importer uses the single POST/PUT routes with transactional gallery support. Explicit gallery fields on bulk API are rejected.
- No independent QA acceptance, live authenticated rerun, CI, database migration execution, backup or Compose gate is claimed here. Parent owns those gates and final main integration/push.

## Regression map

- `tests/scope-rework.test.ts`: real POST/PUT/bulk/PATCH/catalog/label/image-delete routes with mocked auth/database/storage boundaries; scalar preservation/clearing, images, ownership, primary, identity, modifications and quantity helpers. F2 adds 28 alias/owner combinations plus unreadable-reference, unparseable-reference and distinct-file cases alongside the five existing cleanup ownership cases.
- `tests/bulk-edit-clearing.browser.ts`: actual grid JSON through real bulk PUT, then browser reload; Notes, Actuation Force, Type and Top Housing clear; quantity zero/blank, measurement zero and omitted personal notes/images survive. Auth/database/lookups are test boundaries, not a live authenticated E2E.
- `tests/scope-rework.browser.ts`: actual form/card/table/stats/controls/import preview; long unlinked notes, failed submission, numeric clears/zero, duplicate IDs and edited identity.
- `tests/collection-refresh.browser.ts`: actual browse/detail add handlers and existing collection refresh flows; optional quantity confirmation now asserted.
- Updated existing CSV, quantity and master-image regressions to reflect lossless text and transaction contracts. See `SCOPE_REWORK_HANDOFF.md` for final commands/counts/logs and changed files.
