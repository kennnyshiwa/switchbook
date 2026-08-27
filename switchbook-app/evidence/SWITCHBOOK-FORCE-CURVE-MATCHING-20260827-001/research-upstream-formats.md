# Upstream force-curve format audit

Date: 2026-08-27  
Scope: read-only audit of `ThereminGoat/force-curves` at the exact revision fetched by the first production sync, `66cc5aa36208bb33997d3a037137ff60885f5861` (`66cc5a`). No repository, database, container, or production state was changed.

## Executive finding

The production catalog was empty because the importer selected only paths ending in `TG.csv`. At revision `66cc5a`, the complete, non-truncated Git tree contains 15,029 entries, 5,422 CSV blobs, and **zero** `TG.csv` paths. The actual force measurements are predominantly:

- `<human-readable measurement name> Raw Data CSV.csv` (2,757 blobs), and
- `<underscore measurement name>_HighResolutionRaw.csv` (2,650 blobs).

Both are real raw force/displacement measurements. They are normally a low-resolution/high-resolution pair for one measurement, not two independently named switches. A safe catalog should retain both exact source paths and blob SHAs, group them into a measurement identity, prefer the high-resolution member for the default link, and retain the ordinary raw member as a fallback/alternate. Distinct samples, colors, modifications, or actuation-count measurements in the same folder are legitimate multiple curves and must not be collapsed.

No authoritative manufacturer or switch-technology field exists in this repository/tree/CSV format. Folder and filenames contain useful candidate text (`KTT`, `HE`, `Magnetic`, `EC`, `Inductive`, etc.), but those tokens are not sufficiently reliable to satisfy an automatic manufacturer/technology compatibility gate. Such metadata must come from a reviewed external mapping or human review; absent or conflicting metadata must fail closed.

## Exact GitHub evidence

- Recursive tree API: [tree at `66cc5a`](https://api.github.com/repos/ThereminGoat/force-curves/git/trees/66cc5aa36208bb33997d3a037137ff60885f5861?recursive=1). Returned SHA `66cc5aa36208bb33997d3a037137ff60885f5861`, `truncated=false`, 15,029 entries.
- Upstream format statement: [README at `66cc5a`](https://raw.githubusercontent.com/ThereminGoat/force-curves/66cc5aa36208bb33997d3a037137ff60885f5861/README.md). It describes each switch folder as containing a readable PDF, processed XLSX data, and raw CSV data.
- Tree blob extensions: 5,422 CSV, 4,545 XLSX, 2,765 PDF, plus one each MD, Z3A, and HTML.
- The recursive tree has 2,279 top-level directories. Some datasets are nested more deeply (for example spring testers), so identity must always use the complete repository-relative path rather than assuming exactly two path components.

Reproduction commands (read-only):

```sh
curl -fsSL \
  -H 'Accept: application/vnd.github+json' \
  -H 'User-Agent: Switchbook-research' \
  'https://api.github.com/repos/ThereminGoat/force-curves/git/trees/66cc5aa36208bb33997d3a037137ff60885f5861?recursive=1'
```

The returned tree was counted by `type=blob` and case-insensitive `.csv` suffix. Searching all paths for `(^|/)TG\.csv$` returned zero.

## Layout and filename population

Classification of all 5,422 CSV paths:

| Class | Count | Meaning |
|---|---:|---|
| exact suffix ` Raw Data CSV.csv` | 2,757 | normal raw tester export |
| exact suffix `_HighResolutionRaw.csv` | 2,650 | high-resolution raw tester export |
| other CSV spellings | 15 | mostly historical typos/legacy names; one explicit construction filename and two spring-tester files |

The standard suffixes occur across 2,293 CSV-bearing directories:

- 2,221 directories contain both standard raw and high-resolution forms.
- 63 contain standard raw only.
- 9 contain standard high-resolution only (typically because their partner uses a legacy/nonstandard CSV spelling).
- 46 directories contain one CSV total; 2,139 contain two; 108 contain more than two. The largest, `DareU Mahjong`, contains 22 CSVs (11 measurement identities, each with raw/high-resolution members).

Common multi-measurement patterns include:

- numbered samples (`... 1`, `... 2`, `... 3`),
- wear testing (`17000`, `34000`, `51000`, or `100000 Actuations`),
- variants/colors grouped in one folder (`KTT Macaron (Chinajoy Edition)` has seven colors), and
- a blank/control plus colored samples (`DareU Mahjong`).

These are not duplicate catalog mistakes. They are separate measurement identities and are valid candidates for multiple canonical curves on one master switch only when their semantic variant is compatible and reviewed.

The 15 nonstandard paths are:

```text
BSUN Avocado Panda V2/BSUN Avocado Panda V2.csv
BSUN Crystal Light Blue/BSUN Crystal Light Blue.csv
Domikey x Glove Chocolate Donut Pink/Domikey x Glove Chocolate Donut Pink Raw Data CSv.csv
Gateron Full POM Strawberry Smoothie/Gateron Full POM Strawberry Smoothie.csv
Huano Pineapple/Huano Pineapple 51000 Actuations Ra w Data CSV.csv
Kailh Pro Heavy Plum (PCB Mount)/Kailh Pro Heavy Plum (PCB Mount) Raw Data.csv
KeyGeek Raw/KeyGeek Raw Raw CSV.csv
Keyfirst Bling Green/Keyfirst Bling Green Data Construction.csv
LCET Sea Night/LCET Sea Night Data CSV.csv
MOD-M Linear/MOD-M Linear Raw Data.csv
MODE Tomorrow Purple Prototype/MODE_Tomorrow_Purple_Prototype_HighResolution.csv
Mekanisk Ultramarine V2/Mekanisk_Ultramarine_V2_HighResoultionRaw.csv
PantheonKeys x TTC PT Black/PantheonKeys x TTC PT Black 51000 Actuations.csv
SwitchOddities Spring Testers/TX XL/SO Springs Linear TX XL 45g.csv
SwitchOddities Spring Testers/TX XL/SO Springs Tactile TX XL 45g.csv
```

These must not be accepted solely because they end in `.csv`. They require content-signature validation and, for unclear semantics such as spring testers or `Data Construction`, review or explicit allowlisting.

## Content signatures

### Standard raw export

[Example raw blob](https://raw.githubusercontent.com/ThereminGoat/force-curves/66cc5aa36208bb33997d3a037137ff60885f5861/AEBoards%20Naevy%20EC/AEBoards%20Naevy%20EC%2017000%20Actuations%20Raw%20Data%20CSV.csv), path `AEBoards Naevy EC/AEBoards Naevy EC 17000 Actuations Raw Data CSV.csv`, blob SHA `64e9204e2a2e1bc103601c12cd71e74aeae71592`, 108,891 bytes.

Characteristic first rows:

```text
Maximum,194.3,@,No.1124
Minimum,-0.2,@,No.4
Average,48.56
Data Quantity,2196
Number of NG,0
No.,Force,Unit,Displacement,Unit,Judge,Position,Time,Date,
1,0.1,gf,0.000,mm,OK,--,...
```

Safe signature: metadata rows followed by a header containing `No.`, `Force`, `Unit`, `Displacement`, and `Unit`, with subsequent numeric samples using force unit `gf` and displacement unit `mm`.

### High-resolution raw export

[Example high-resolution blob](https://raw.githubusercontent.com/ThereminGoat/force-curves/66cc5aa36208bb33997d3a037137ff60885f5861/AEBoards%20Naevy%20EC/AEBoards_Naevy_EC_17000_Actuations_HighResolutionRaw.csv), path `AEBoards Naevy EC/AEBoards_Naevy_EC_17000_Actuations_HighResolutionRaw.csv`, blob SHA `99cd0eb92bec6f4a1ab9c569d293cdb9b03e4529`, 848,299 bytes.

Characteristic metadata:

```text
MAX FORCE = 190.9,4.495
MIN FORCE = -1.0,-0.010
AVERAGE FORCE = 45.35,
UNIT = gf,mm
DATA COUNT = 71331,
RECORDING RATE = 0.0005,
FILE DATE = 3/4/2025 9:07:03 PM,
```

Safe signature: `MAX FORCE`, `MIN FORCE`, `UNIT = gf,mm`, numeric `DATA COUNT`, and numeric force/displacement samples later in the file. High-resolution data has tens of thousands of samples versus roughly two thousand in the paired normal export and is the better default curve artifact when both exist.

### Why filename-only and generic CSV acceptance are unsafe

`Keyfirst Bling Green/Keyfirst Bling Green Data Construction.csv` has blob SHA `198937debecda32c3217362e2c660d0b7ed49cc0` and happens to contain a raw-export signature despite its construction-oriented filename. Conversely, the repository also includes spring-tester CSVs that do not represent a switch. Therefore:

- a recognized filename plus valid content signature may enter the catalog automatically;
- an unrecognized spelling plus valid content signature may be cataloged as `review-required`, never auto-mapped;
- construction/linearity/processed files and spring-only datasets must be denied unless explicitly reviewed as a switch curve;
- a recognized name with an invalid/unknown content signature must be rejected/quarantined, not linked.

## Deterministic inclusion and priority rule

1. **Immutable source identity:** key every artifact by `(source = github:ThereminGoat/force-curves, exact repository-relative path)`. Store tree revision, Git blob SHA, byte size, detected format, and last-seen sync. Never synthesize a filename or truncate to the directory.
2. **Candidate discovery:** consider CSV blobs only. Automatically classify the two exact, case-sensitive standard suffixes above. Send the 15 nonstandard spellings (and future unknowns) through content-signature validation into review; do not silently broaden a regex every time a typo appears.
3. **Curve validation:** accept only a recognized normal-raw or high-resolution signature with force/displacement units and numeric samples. Explicitly reject/quarantine processed/construction/linearity exports, spring-only datasets, empty files, HTML/error bodies, and malformed/unknown schemas.
4. **Measurement identity:** within the complete parent directory, strip only the recognized terminal suffix; normalize spaces/underscores and punctuation for *pairing only*. Preserve the original stem and both exact artifact identities. Never use the normalized pairing key as the source identity or as sufficient evidence for a MasterSwitch match.
5. **Pair priority:** for a paired measurement, expose the high-resolution path as the preferred/default URL and retain normal raw as an alternate/fallback. If only one validated member exists, it may be used. If multiple members of the same format normalize to one key, mark the group ambiguous and require review.
6. **Multiple legitimate curves:** keep distinct measurement keys (sample number, color/variant, lubrication state, actuation count) as separate curve records. They may all map to one MasterSwitch only after variant compatibility is established. Do not auto-map a folder wholesale merely because one member matches.
7. **Master-switch mapping:** require an exact reviewed alias/external identity or trusted manufacturer + switch identity + technology compatibility. Folder/filename text can generate candidates but cannot establish manufacturer or technology. Missing/conflicting trusted metadata, multiple MasterSwitch candidates, variant mismatch, or unknown technology must be `review-required`/`no-match`, never auto-approved.
8. **Change behavior:** a changed blob SHA makes the affected approved artifact stale and review-required. A new paired high-resolution member does not silently replace a manually approved raw member; it is proposed for review (or adopted only under an explicit reviewed rule). Removed paths make their mappings stale.

This rule is deterministic, incremental, preserves all exact identities, supports multiple real measurements, and fails closed at both artifact classification and switch mapping boundaries.

## Regression fixtures

Use these exact revision/path/SHA tuples in catalog tests (raw URLs above or Git blob content fetched by SHA):

| Purpose | Exact path | Blob SHA | Expected |
|---|---|---|---|
| paired normal raw | `'X' Green/'X' Green Raw Data CSV.csv` | `7be19f0a7336eb3ca63e097a50369ed9facf8ed3` | validated normal raw, paired |
| paired high resolution | `'X' Green/'X'_Green_HighResolutionRaw.csv` | `82bcbe5132c6e3a498869fa44fe79b5add1e5152` | validated high-res, preferred |
| actuation variant raw | `AEBoards Naevy EC/AEBoards Naevy EC 17000 Actuations Raw Data CSV.csv` | `64e9204e2a2e1bc103601c12cd71e74aeae71592` | separate `17000 Actuations` measurement |
| actuation variant high-res | `AEBoards Naevy EC/AEBoards_Naevy_EC_17000_Actuations_HighResolutionRaw.csv` | `99cd0eb92bec6f4a1ab9c569d293cdb9b03e4529` | paired with preceding row, preferred |
| close KTT name, wrong switch | `KTT Peach Sun/KTT_Peach_Sun_HighResolutionRaw.csv` | `f5b95be6b3c1a28981b7d5b7ae765fb5343e2719` | must not match KTT Peach Blossom |
| generic close name, wrong maker/identity | `Cherry Blossom/Cherry Blossom Raw Data CSV.csv` | `f0d9e90f61c981f6d28968ca226329a04b8d72ff` | must not match KTT Peach Blossom |
| explicit different maker | `Jerrzi Cherry Blossom/Jerrzi_Cherry_Blossom_HighResolutionRaw.csv` | `ed51f10c9fa926e02b6df0a838ad579ad962c3ff` | manufacturer-conflict/no auto-match |
| nonstandard/construction name | `Keyfirst Bling Green/Keyfirst Bling Green Data Construction.csv` | `198937debecda32c3217362e2c660d0b7ed49cc0` | review-required despite raw-like content |

### KTT Peach Blossom regression

The complete, non-truncated exact-revision tree has:

- zero paths containing `Peach Blossom`;
- zero paths containing both `KTT` and `Peach Blossom`;
- six tree entries under `KTT Peach Sun` (a different switch), including one normal raw and one high-resolution raw CSV;
- `Cherry Blossom` and `Jerrzi Cherry Blossom` folders, both different identities.

Therefore MasterSwitch `cmqo21sm103vknu3vh0tjs75x` (`KTT Peach Blossom`) has no verified upstream curve at this revision. Its expected canonical result is zero approved curve URLs. Neither a generated `TG.csv` URL nor a fuzzy link to `KTT Peach Sun`, `Cherry Blossom`, or `Jerrzi Cherry Blossom` is permissible.

## Data limitations and operational consequence

The Git tree supplies exact path, blob SHA, file mode/type, and byte size; raw content supplies measurement units/schema/date. It does **not** supply authoritative manufacturer, technology, MasterSwitch ID, or a durable upstream switch ID independent of the path. Consequently, the catalog can be populated automatically and safely, but mapping cannot be broadly auto-approved from this source alone. Initial matching should produce conservative review candidates, and reviewed aliases/metadata should persist across incremental revisions. This is preferable to false-positive curve links.
