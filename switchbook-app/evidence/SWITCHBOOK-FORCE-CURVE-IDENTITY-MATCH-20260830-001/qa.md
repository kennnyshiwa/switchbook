# Independent QA — PASS_VERIFIED

Assignment: `SWITCHBOOK-FORCE-CURVE-IDENTITY-MATCH-20260830-001`

QA date: 2026-08-30
Baseline: `9de5f23dcd6569f04769624500d3be6b302bccc2`

## Verdict

`PASS_VERIFIED`

The change is a deliberately exact product alias, not a fuzzy relaxation. `80Retros Retro Orange` canonicalizes only to `80Retros GAME1989 Orange`, with an explicit KTT manufacturer requirement. The same canonicalization is applied to candidate discovery, bounded authoritative resolution, compatibility annotation, and the mutation write gate. Existing technology, folder/display identity, manufacturer, ordered-token, ambiguity, and candidate-cap protections remain active.

QA found the first database fixture did not fully encode the acceptance matrix. Corrective iteration 1 strengthened it with White, Blue, V2, a real unrelated attach, and replay assertions; the implementation itself did not need rework. The strengthened fixture was rerun independently on another freshly migrated database and passed.

## Fresh PostgreSQL 17 evidence

- Engine: Homebrew PostgreSQL `17.8`, disposable local cluster, trust-bound to `127.0.0.1:55439`.
- Schema: fresh empty databases; `prisma migrate deploy` applied all `34/34` migrations.
- Exact fixture: `DATABASE_URL=.../switchbook_qa_exact2 npx tsx tests/force-curves-retro-orange.db.ts` — PASS.
- Exact output: `{"exactAlias":true,"highOnly":true,"rawAndHigh":true,"rawOnly":true,"wrongCandidatesBlocked":5,"negativeReviewMutations":0,"unrelatedEnabledAndAttached":true,"linked":3,"repeatStable":true,"rawIncompatibleError":false}`.
- Exact target: KTT `80Retros GAME1989 Orange` is the unique authoritative master.
- Exact three-row group: high-only `SOURCE_UNVERIFIED`, raw+high `MANUFACTURER_CONFLICT`, and raw-only `SOURCE_UNVERIFIED` all resolve to the selected high-resolution catalog entry.
- Negative controls: identical HMX name plus KTT Red, White, Blue, and Orange V2 all throw the closed compatibility error internally, leave all three reviews OPEN/unlinked, and create zero mappings.
- Unrelated control: Gateron Oil King remains compatible and was actually attached, resolving its review and creating exactly one manually approved mapping.
- Exact attach resolves all three rows and creates exactly one manually approved mapping. Safe repeat returns `replayed:true` and preserves the single mapping.
- No raw `INCOMPATIBLE_IDENTITY` reaches the successful path; no all-candidates-incompatible regression exists.

## Broader database suites

Each suite ran on its own fresh database with all 34 migrations:

- `tests/force-curves-r2.db.ts` — PASS: `{"migrations":34,"exactReviews":3,"exactMappings":1,"negativeVariants":3,"crossMaker":2,"ambiguousRejected":1,"capCandidates":201,"repeatStable":true}`.
- `tests/force-curves.db.ts` — PASS: `14` runs, `5,388` catalog rows, `5,504` reviews, no Peach Blossom approved URLs.

These suites independently retain cross-maker rejection, variant rejection, ambiguity failure, mandatory-anchor candidate cap failure at 201, replay stability, source grouping, and mapping publication invariants.

## Code and static gates

- Focused force-curve unit suite: `29/29` PASS.
- Full repository suite: `87/87` PASS.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with pre-existing warnings only; no errors.
- `npm run build`: PASS; optimized production build generated all routes.

## Scope review

Reviewed implementation files:

- `src/lib/admin-force-curves.ts`
- `src/app/api/admin/force-curves/master-switches/route.ts`
- `tests/force-curves.test.ts`
- `tests/force-curves-retro-orange.db.ts`

Search expansion is restricted to the exact source entry and only exact source-name/short-alias queries; unrelated queries such as `HMX` are not expanded. Wrong manufacturers cannot exploit the canonical name because the exact alias branch requires normalized manufacturer `ktt`. Neighboring colors and V2 retain extra/missing tokens and remain blocked. The resolver remains bounded and authoritative; no direct or fuzzy force-link bypass was introduced.

No production system, production mapping, commit, push, or deployment was touched by QA. Unrelated dirty worktree files were preserved.
