# Builder evidence — R2

Assignment ID: `671e3864-b382-4bbe-9cae-66937a63856d`

## Implementation

- Replaced the R1 manufacturer-presence requirement with a fail-closed product-identity validator in `src/lib/admin-force-curves.ts`.
- Normalization is case/punctuation insensitive and splits alpha/digit boundaries (`Game1989` -> `game`, `1989`).
- Catalog folder and display identity must still normalize exactly.
- Every catalog product token must occur in order in the MasterSwitch name. Extra MasterSwitch qualifiers (brand, OEM, vendor) are allowed.
- Verified Manufacturer names and aliases are recognized as catalog prefixes. A recognized prefix must equal the selected MasterSwitch manufacturer; only then is it stripped as metadata. Unrecognized vendor/brand prefixes remain required product identity.
- Catalog metadata technology must match the MasterSwitch when both values exist.
- Search annotation and every mutation path (single/group link, bulk approval, metadata verification, and manual resolution) use one authoritative bounded resolver. Zero or multiple matches fail closed as incompatible/ambiguous.
- The resolver chooses a mandatory normalized product anchor, queries only approved MasterSwitch names containing it, projects minimal identity fields, and reads at most 201 rows. More than 200 candidates fails closed with an actionable broad-identity reason.
- Repeated catalog representations of the same normalized folder/display identity reuse one resolution within grouped linking.
- PG17 correction: bulk approval no longer invokes the context-free queue classifier after authoritative resolution. It independently enforces source kind, one candidate ID, one catalog entry, one master ID, and one source identity before writing.
- Synchronous queue classification strips the selected master manufacturer only for conservative UI labelling; it remains non-authoritative and cannot authorize a mutation.
- Compatibility reasons report the verified token sequence or the matched/missing token evidence.
- Legacy exact/automatic matching no longer gates any write path; it remains only in non-mutating queue classification. There is no client-only bypass.

## Regression coverage

- Exact production case enabled: `80Retros 1989 Retro Blue` -> `80Retros KTT Game1989 Retro Blue`.
- Blocked: HMX `80Retros GAME1989`, standalone KTT `Retro Blue`, and Orange/Red/White/Silver siblings.
- Added/retained representative Gateron, HMX, KTT, Aflion/BSUN, and Greetech punctuation/alpha-digit fixtures. Gateron -> KTT and BSUN -> Aflion are explicitly blocked.
- Duplicate generic identities across approved masters are explicitly blocked as ambiguous.
- Existing mutation/idempotency, queue grouping, and cross-switch safety tests remain in the full suite.

## Gates

- Focused: `npx tsx --test tests/force-curves.test.ts` — 27/27 passed, including bounded anchor-query shape and 201-row cap failure.
- Full: `npm test` — 81/81 passed.
- Typecheck: `npx tsc --noEmit` — passed.
- Lint: `npm run lint` — passed with pre-existing warnings only.
- Production build: `npm run build` — passed (83 static pages generated).
- DB link/idempotency command: `npm run test:force-curves-db` — not runnable in this builder shell because `DATABASE_URL` is absent; it failed during Prisma initialization before any DB mutation. Independent QA/CI must run this gate with the isolated test database configured.
- PG17 QA is expected to rerun the fresh-migration DB suite; the reported valid KTT Queue split-brain path is removed in code.

## Scope and safety

- Changed files: `src/lib/admin-force-curves.ts`, `src/app/api/admin/force-curves/master-switches/route.ts`, `tests/force-curves.test.ts`, and this evidence file.
- Existing dirty worktree and R1 evidence were preserved.
- No commit, push, deployment, database write, or production mutation was performed.
- iOS parity: N/A; this is an admin-only web workflow.
