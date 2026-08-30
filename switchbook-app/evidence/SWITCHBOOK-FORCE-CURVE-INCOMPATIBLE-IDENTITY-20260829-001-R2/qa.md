# Independent QA — R2

Assignment: `671e3864-b382-4bbe-9cae-66937a63856d`

Verdict: **FAIL — RELEASE BLOCKED**

## Release-blocking finding

The R2 validator permits cross-manufacturer attachment. `catalogMasterCompatibility` no longer verifies that the catalog manufacturer/brand identity agrees with the MasterSwitch manufacturer identity. It only checks whether catalog display-name tokens occur in order in the MasterSwitch name.

This is not DOM-only. The same `exactCatalogMasterIdentity` result gates `linkSourceReviewGroup`, `linkSourceReview`, metadata verification, and bulk approval. A false positive can therefore pass the server mutation boundary.

The changed regression suite explicitly codifies unsafe results:

- MasterSwitch `{ name: "Gateron Oil King", manufacturer: "KTT" }` is expected compatible with catalog `Gateron Oil King`.
- MasterSwitch `{ name: "BSUN Raw Tactile", manufacturer: "Aflion" }` is expected compatible with catalog `BSUN Raw Tactile`.
- MasterSwitch `{ name: "GateronX Oil King", manufacturer: "Gateron" }` is expected compatible with catalog `GateronX Oil King`; this also defeats token-boundary manufacturer safeguards.

These violate the acceptance requirement that actual cross-switch attachment remain impossible. Because this is a server-side integrity failure, QA did not perform a write transaction or local browser attachment: either would merely demonstrate an unsafe write that must not ship.

## Exact 80Retros case

The pure validator does mark the requested exact target shape compatible:

- source: `80Retros 1989 Retro Blue`
- requested target ID: `cmqo2gr3403wqnu3voig85fi9`
- target name: `80Retros KTT Game1989 Retro Blue`
- result: compatible (`80 retros 1989 retro blue` is an ordered subsequence after alpha/digit normalization)

The focused tests also block HMX `80Retros GAME1989`, standalone KTT `Retro Blue`, and Orange/Red/White/Silver siblings by product tokens. That positive behavior does not offset the cross-manufacturer server bypass.

## Representative fixture assessment

- HMX alpha/digit punctuation normalization: covered and passes.
- KTT exact 80Retros target/sibling separation: covered and passes at pure-function level.
- Gateron: unsafe cross-manufacturer fixture is asserted compatible.
- Aflion/BSUN: unsafe cross-manufacturer fixture is asserted compatible.
- Greetech punctuation normalization: covered, but manufacturer is null and therefore does not prove manufacturer safety.

The requested representative matrix is therefore incomplete as a safety proof and contains two explicit counterexamples.

## Commands and gates

- `npx tsx --test tests/force-curves.test.ts`: 26/26 pass, including the unsafe expectations above.
- `npm test`: 80/80 pass.
- `npx tsc --noEmit`: pass.
- `npm run lint`: pass with pre-existing warnings.
- `npm run build`: pass; 83 static pages generated, with pre-existing warnings.
- Diff review: implementation changes are limited to `src/lib/admin-force-curves.ts` and `tests/force-curves.test.ts` for R2; unrelated dirty files remain present and were not modified by QA.

## Required correction before re-QA

Use the complete identity model to distinguish brand/vendor/OEM aliases from contradictory manufacturer identities. A scoped, evidence-backed equivalence (for example, the exact 80Retros/KTT naming relationship) may allow the requested target, but a generic rule must not make `KTT` compatible with `Gateron Oil King` or `Aflion` compatible with a BSUN-branded identity. Add server-mutation regression tests that prove these negative cases are rejected, then repeat isolated transaction and browser QA.

No commit, push, deployment, production mutation, or implementation edit was performed. Dirty worktree preserved.

---

## Corrective re-verification

Verdict remains **FAIL — RELEASE BLOCKED**.

The corrective diff adds `uniqueCatalogMasterCompatibility` to search, group-link, and single-link, but does not establish one invariant across all server mutations.

### Remaining server-side bypasses

Three reachable mutation paths still call `exactCatalogMasterIdentity`, which supplies neither verified manufacturer aliases nor the approved-master uniqueness set:

- `bulkApproveForceCurveReviews`: its initial safety predicate uses `exactCatalogMasterIdentity`; the subsequent queue classifier also uses that same unsafe predicate.
- `verifyReviewMetadata`: PATCH can verify catalog metadata after evaluating only `exactCatalogMasterIdentity`.
- `resolveForceCurveReview`: POST `MANUALLY_APPROVED`/`REJECTED` evaluates only `exactCatalogMasterIdentity`; the manual-approval branch's `selectAutomaticCandidates` checks catalog metadata equality/path evidence but does not enforce the new global uniqueness invariant.

Consequently the search UI and link PUT may reject a contradictory or ambiguous target while alternate POST/PATCH workflows accept it. This fails the mandatory server-side enforcement requirement. An isolated database success/rejection suite cannot truthfully PASS until every mutation uses the same invariant; no unsafe database write was executed by QA.

### Query-cost and boundedness failure

The correction introduces unbounded full-table reads:

- Every search request loads every approved MasterSwitch in addition to the 50 displayed matches. Search is called as an admin types.
- Every group/single link transaction loads every approved MasterSwitch while locks are held.
- `uniqueCatalogMasterCompatibility` filters the full approved set for each displayed match. Search therefore performs approximately `50 × approvedMasterCount` compatibility evaluations after the unbounded read.
- Group-link repeats the full scan for the selected candidate and every evidence candidate.

There is no query bound, precomputed normalized identity, database-side narrowing, or cardinality guard. This does not preserve the queue/performance behavior expected of the production admin workflow.

### Corrective positive observations

- Search now uses the uniqueness-aware function and should annotate the production-shaped exact target as enabled when it is the sole approved compatible record.
- Group and single link now use the same uniqueness-aware function and recognize verified manufacturer prefixes/aliases.
- The Gateron→KTT and BSUN→Aflion pure validator fixtures now reject when the verified manufacturer registry is supplied.

Those changes are directionally correct but do not close the mutation bypasses or boundedness issue.

### Required next correction

Build one server compatibility service/invariant used by search and every accepting mutation (group link, single link, verify metadata, manual resolution, and bulk approval). Manufacturer resolution, technology, product identity, and uniqueness must be evaluated consistently. Bound uniqueness evaluation with a database-side candidate projection or persisted/indexed normalized identity rather than loading and scanning the complete approved catalog per request.

---

## Corrective iteration 2 re-verification

Verdict: **FAIL — EVIDENCE BLOCKED (implementation audit passes)**

### Corrected implementation audit

The prior two code blockers are resolved:

- `resolveUniqueCatalogMaster` is now the authoritative resolver used by the search annotation and every accepting write path: group link, single link, bulk approval, metadata verification, and manual resolution.
- No accepting mutation retains a direct `exactCatalogMasterIdentity` gate. Its remaining production use is queue presentation/classification; all writes re-resolve authoritatively.
- The resolver derives a mandatory normalized product anchor, queries approved names by that anchor, orders deterministically, and requests at most 201 rows. More than 200 candidates fails closed.
- Search resolves once and annotates its 50 displayed rows from that result; there is no per-result database scan or full approved-master load.
- Group/single link cache repeated catalog identities within the request. Each distinct evidence identity performs one bounded resolver query.
- Verified manufacturer names and aliases canonicalize prefixes; technology mismatches, Gateron→KTT, BSUN→Aflion, 80Retros color/HMX/short-name variants, and multiple compatible approved masters fail closed in the focused fixtures.
- Production-shaped target `cmqo2gr3403wqnu3voig85fi9` is returned by an exact-ID search and is compatible/enabled when it is the sole approved match for `80Retros 1989 Retro Blue`; the component disables incompatible options and enables Attach only for the selected compatible ID.

### Gates

- Focused force-curve tests: 27/27 pass.
- Full suite: 81/81 pass.
- Typecheck: pass.
- Lint: pass with pre-existing warnings only.
- Production build: pass; 83 static pages generated.
- `git diff --check`: pass.

### Mandatory evidence unavailable in this QA environment

PASS_VERIFIED is withheld because two specifically requested integration artifacts could not be produced:

- PostgreSQL: `.env.local` points to the disposable local endpoint `127.0.0.1:55432/switchbook`, but the port refuses connections. No `psql`/`pg_isready` binaries are installed, Docker has no running PostgreSQL container or locally available image, and QA did not pull/create infrastructure or touch production. Therefore the requested isolated real transaction proving exact 80Retros group attach, replay/idempotency, negative writes, and mapping/review integrity was not executed.
- Browser fixture: no `BROWSER_BASE_URL`, admin fixture credentials, Chromium path, Chrome, or Chromium are available. The existing Playwright test requires all four. DOM source and API-shape behavior were audited, but no real browser screenshot/interaction was fabricated.

The implementation is ready for the missing isolated PostgreSQL and browser-fixture run. Those results are the only blockers recorded in this iteration; no code defect was found. No deployment or production mutation occurred.

---

## PostgreSQL re-run after environment unblock

Verdict: **FAIL — RELEASE BLOCKED**

The database evidence blocker was resolved with Homebrew PostgreSQL 17.8. QA created an explicit disposable cluster under `/tmp/switchbook-r2-pg.*`, started it on unused loopback port 56491, created only `switchbook_r2_qa`, and successfully applied all 34 migrations.

Command: `DATABASE_URL=postgresql://kennnyshiwa@127.0.0.1:56491/switchbook_r2_qa?schema=public npm run test:force-curves-db`

Result: fail at `tests/force-curves.db.ts:210`. The existing valid `KTT Queue DB` repeated-evidence workflow calls `bulkApproveForceCurveReviews` and receives `UNSAFE_BULK_APPROVAL`.

Root cause:

- Bulk approval first passes `resolveUniqueCatalogMaster` and `resolvedCatalogMasterCompatibility`.
- It then calls `classifyReviewGroup` as a second gate.
- `classifyReviewGroup` still calls context-free `exactCatalogMasterIdentity`.
- With the corrected validator's default empty manufacturer registry, catalog `KTT Queue DB` is not prefix-stripped while MasterSwitch name is `Queue DB`; the valid group is classified non-actionable and rejected.

This disproves the claim that one authoritative resolver gates every write path and regresses existing queue behavior. The dedicated 80Retros transaction matrix was not run after the prerequisite DB suite failed; release must stop at this first integrity regression.

The PostgreSQL server was stopped cleanly and the exact validated `/tmp/switchbook-r2-pg.*` directory was removed. No production data or non-temporary database was touched.

---

## Final independent re-verification after split-brain correction

Verdict: **PASS_VERIFIED**

### Fresh PostgreSQL proof

- PostgreSQL: Homebrew `postgresql@17` 17.8.
- Cluster: fresh `initdb` in an explicit `mktemp -d /tmp/switchbook-r2-pg.*` directory, trust auth, loopback only, unused port 56492.
- Database: explicit temporary `switchbook_r2_qa` only.
- Migrations: 34/34 applied successfully with `prisma migrate deploy`.
- Entire `npm run test:force-curves-db`: pass.
- Existing DB-suite terminal counts: 14 sync runs, 5,384 catalog entries, 5,499 review rows, zero Peach Blossom approved URLs.

### Exact production-shaped transaction proof

Dedicated regression: `tests/force-curves-r2.db.ts`.

- Catalog/source ID: `cmtbuy2gk0004uq2nageylhc4`, display `80Retros 1989 Retro Blue`.
- Exact target ID: `cmqo2gr3403wqnu3voig85fi9`, name `80Retros KTT Game1989 Retro Blue`.
- Two repeated source-evidence reviews linked successfully as one group.
- Repeating group link was stable: two OPEN rows remained linked to the same exact master/catalog; zero mappings were published during linking.
- Bulk approval created exactly one `MANUALLY_APPROVED` mapping and resolved exactly two reviews.
- Repeating bulk approval returned replay and left exactly one mapping.
- Three wrong variants rejected with no review link: HMX GAME1989, KTT Retro Orange, and shortened KTT Retro Blue.
- Two cross-maker identities rejected: Gateron→KTT and BSUN→Aflion.
- A duplicate approved exact master made resolution ambiguous and attachment was rejected.
- 201 anchor candidates triggered the fail-closed `>200` cap.
- Zero mappings existed for every negative/ambiguous master.

Dedicated terminal result: `{"migrations":34,"exactReviews":2,"exactMappings":1,"negativeVariants":3,"crossMaker":2,"ambiguousRejected":1,"capCandidates":201,"replayed":true}`.

### Static gates

- Focused force-curve unit tests: 27/27 pass.
- Full unit suite: 81/81 pass.
- Typecheck: pass.
- Lint: pass with pre-existing warnings only.
- Production build: pass; 83 static pages generated.
- `git diff --check`: pass.

### Cleanup and scope

The disposable PostgreSQL server stopped cleanly. QA validated the explicit `/tmp/switchbook-r2-pg.*` target before removing it and confirmed it no longer exists. No Docker, production database, deployment, commit, or push was used. The dirty worktree was preserved. Authenticated production browser verification remains the required post-release gate.

---

## Corrective iteration 3 PostgreSQL verification

Verdict: **FAIL — RELEASE BLOCKED**

Fresh PostgreSQL 17.8 verification applied all 34 migrations. The entire existing `npm run test:force-curves-db` suite passed with 14 runs, 5,386 catalog entries, and 5,503 reviews.

The mandatory production-shaped split-candidate transaction failed on a second clean migrated database:

- `SOURCE_UNVERIFIED` row: high-resolution candidate only.
- `MANUFACTURER_CONFLICT` row: raw and high-resolution candidates.
- `SOURCE_UNVERIFIED` row: raw candidate only.
- All three share the exact `80Retros 1989 Retro Blue` measurement identity.
- Selected target: `cmqo2gr3403wqnu3voig85fi9`.
- Selected evidence: high-resolution `cmtbuy2gk0004uq2nageylhc4`.

`linkSourceReviewGroup` throws `REVIEW_CANDIDATE_REQUIRED` at `src/lib/admin-force-curves.ts:207`. Although `MANUFACTURER_CONFLICT` is now an allowed group kind, the implementation still requires every individual review payload to contain the selected catalog file. That cannot represent a source group whose durable rows split raw and high-resolution evidence.

The newly added implementation fixture misses this production boundary: it uses high-only / raw+high / high-only, so every row contains the selected high-resolution ID. The mandatory fixture is high-only / combined / raw-only.

Required correction: validate that the selected catalog belongs to the homogeneous source group's combined candidate set, then prove every individual row belongs to that same canonical source identity. Do not require the chosen raw/high file ID in each row. Mixed source identities, wrong candidates outside the group union, cross-maker targets, unsupported conflict kinds, and ambiguity must remain rejected atomically.

Static gates were not repeated after this first mandatory database failure. The temporary PostgreSQL server was stopped cleanly and its exact validated `/tmp/switchbook-r2-pg.*` directory removed. No production mutation or deployment occurred.

---

## Corrective iteration 4 independent verification

Verdict: **PASS_VERIFIED**

### Fresh PostgreSQL proof

- PostgreSQL: Homebrew `postgresql@17` 17.8, fresh loopback-only cluster in an explicit `mktemp -d /tmp/switchbook-r2-pg.*` path on port 56494.
- Databases: two clean temporary databases, `switchbook_r2_qa` and `switchbook_r2_exact`.
- Migrations: 34/34 applied successfully to both databases.
- Entire `npm run test:force-curves-db` suite passed on `switchbook_r2_qa` with terminal counts: 14 sync runs, 5,388 catalog entries, 5,504 review rows, and zero Peach Blossom approved URLs.

### Exact production-shaped group transaction proof

Dedicated independent regression: `tests/force-curves-r2.db.ts` on the separately recreated `switchbook_r2_exact` database.

- Exact target: `cmqo2gr3403wqnu3voig85fi9` (`80Retros KTT Game1989 Retro Blue`).
- Exact high-resolution catalog evidence: `cmtbuy2gk0004uq2nageylhc4`; raw evidence: `cmtbuy2gc0003uq2n00sp53z2`.
- The source group used the mandatory production split: one SOURCE_UNVERIFIED high-only row, one MANUFACTURER_CONFLICT raw+high row, and one SOURCE_UNVERIFIED raw-only row.
- Selecting the high-resolution evidence linked all three rows to the exact target successfully and atomically.
- Repeating the group link was stable: all three reviews remained OPEN, linked to the same exact master/catalog, with zero published mappings.
- Missing, stale, and wrong-source union catalog IDs were rejected by the full DB suite.
- Three wrong variants, two cross-maker identities, mixed source identities, unrelated TECHNOLOGY_CONFLICT rows, an ambiguous duplicate exact master, and the 201-candidate fail-closed cap were rejected without unintended mappings.

Dedicated terminal result: `{"migrations":34,"exactReviews":3,"exactMappings":0,"negativeVariants":3,"crossMaker":2,"ambiguousRejected":1,"capCandidates":201,"repeatStable":true}`.

### Static gates

- Focused force-curve unit tests: 27/27 pass.
- Full unit suite: 81/81 pass.
- Typecheck: pass.
- Lint: pass with existing warnings only.
- Production build: pass; 83 static pages generated.
- `git diff --check`: pass.

### Cleanup and scope

The disposable PostgreSQL server was stopped cleanly. QA validated the explicit `/tmp/switchbook-r2-pg.PuA9Bm` target before removal and confirmed it no longer exists. No production data, Docker deployment, commit, or push was touched. The dirty worktree was preserved. Authenticated production browser verification of Kenneth's exact screen remains the mandatory post-deployment gate.
