# Production diagnosis — 80Retros Retro Orange

Assignment: `SWITCHBOOK-FORCE-CURVE-IDENTITY-MATCH-20260830-001`

Workboard: `8e7a901a-e957-4611-89ce-60ad762dc1ac`
Baseline SHA: `9de5f23dcd6569f04769624500d3be6b302bccc2`

## Immutable production record

Authenticated read-only API inspection on `https://switchbook.app/admin/force-curves` reproduced one OPEN source group:

- Source key: `measurement:80 retros retro orange 80 retros retro orange`
- Primary review: `cmtbuyuf3044tuq2nj9xfgqgt`
- Bucket/state: `CONFLICT`, confidence `0`, `OPEN`, unattached
- Reviews:
  - `cmtbuyuf3044tuq2nj9xfgqgt` — `SOURCE_UNVERIFIED`, catalog `cmtbuy2gy0006uq2nzphisy6t`
  - `cmtc6w9b30006mu2zqiwowsit` — `MANUFACTURER_CONFLICT`, catalog `cmtbuy2gr0005uq2n1qga01v7`
  - `cmtc7pvpb0005nu7dhkli7rcm` — `SOURCE_UNVERIFIED`, catalog `cmtbuy2gr0005uq2n1qga01v7`
- High-resolution catalog entry `cmtbuy2gy0006uq2nzphisy6t`:
  - display `80Retros Retro Orange`
  - path `80Retros Retro Orange/80Retros_Retro_Orange_HighResolutionRaw.csv`
  - content hash `591e5d3dd396f1052d1e1dc9eff3b0891cc12347`
- Raw catalog entry `cmtbuy2gr0005uq2n1qga01v7`:
  - path `80Retros Retro Orange/80Retros Retro Orange Raw Data CSV.csv`
  - content hash `96d29c279de4c09e2800da09e4a85f38b9bc7a38`
- Both entries are at source revision `66cc5aa36208bb33997d3a037137ff60885f5861`; manufacturer and technology metadata are null.
- Production MasterSwitch search returns `cmch5e0sr000fl805j707fhjh`, `80Retros GAME1989 Orange`, manufacturer `KTT`, `LINEAR`, `MECHANICAL`.
- Current compatibility rejection: `Product identity mismatch: matched [80, retros]; missing [retro, orange] in MasterSwitch name.`
- Exact source-name searches currently return no MasterSwitch result.

No review, catalog entry, MasterSwitch, or mapping was mutated during diagnosis.

## Schema/correctness truth

The live application schema and deployed route contract were read before querying. Reviews store immutable source/candidate IDs, payload evidence and decision state; catalog entries store source path, revision and content hash; mappings have a unique `(masterSwitchId, catalogEntryId)` identity and audit provenance. Every write is gated by `resolveUniqueCatalogMaster` and `resolvedCatalogMasterCompatibility`.

## Canonical identity evidence

Evidence supports that the expected canonical target is `cmch5e0sr000fl805j707fhjh`, not a fuzzy near-match:

- SwitchOddities markets the measured product as **80Retros Retro Orange**, explicitly identifies **KTT**, **Linear**, 40 g actuation, 45 g bottom-out, 1.9 mm actuation and 4.0 mm total travel: https://switchoddities.com/products/80retros-retro-orange
- Keypro markets **Game1989 Orange** in the same 80Retros family with the exact 40±3 g, 45±3 g, 1.9±0.2 mm and 4.0±0.2 mm specifications: https://keyprokb.com/en/products/hmx-switch
- The ThereminGoat repository independently names the measured folder and both evidence files `80Retros Retro Orange` at the captured revision: https://github.com/ThereminGoat/force-curves/tree/66cc5aa36208bb33997d3a037137ff60885f5861/80Retros%20Retro%20Orange
- The production MasterSwitch agrees on brand, orange variant, KTT manufacturer, linear type and mechanical technology. The only discrepancy is the marketed family alias `Retro` versus `GAME1989`.

This is an exact, product-scoped alias, not permission to ignore arbitrary family or variant tokens. Red, White, Blue, other manufacturers, and unrelated 80Retros records must remain distinct.

## Root cause and smallest durable fix

`catalogMasterCompatibility` performs a strict ordered token subsequence match. It has no product-alias layer, so catalog `[80, retros, retro, orange]` cannot match MasterSwitch `[80, retros, game, 1989, orange]`. `resolveUniqueCatalogMaster` also derives its mandatory anchor directly from the unaliased catalog tokens, and the search API only performs literal substring search. Therefore both candidate discovery and write authorization reject the same proven alias.

The smallest durable correction is a narrowly scoped canonical product-identity alias used consistently by search expansion, authoritative unique resolution, compatibility annotation and write gating. It must canonicalize only the proven `80Retros Retro Orange` ↔ `80Retros GAME1989 Orange` identity and retain manufacturer, technology, type and variant safety.
