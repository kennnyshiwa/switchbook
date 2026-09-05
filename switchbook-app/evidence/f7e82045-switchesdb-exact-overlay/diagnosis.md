# Diagnosis — exact SwitchesDB measurement from admin review

Workboard: `f7e82045-8a92-40f2-a8f6-43710ce65491`
Date: 2026-09-04
Scope: read-only diagnosis; no production or review-data mutation.

## Current contract

- `/admin/force-curves` renders one card per `sourceKey`, and each card contains the complete candidate set for that source/measurement identity.
- Each candidate already carries stable catalog identity: `id`, `source`, `repositoryPath`, `revision`, and `contentHash`. The queue must not resolve the curve by fuzzy switch or master name.
- The card currently offers only a safe canonical GitHub link. It does not invoke the existing SwitchesDB overlay.
- `ForceCurveLookupButton` is a standalone boolean modal with a hard-coded empty `https://switchesdb.switchbook.app/` iframe. It accepts no measurement identity and is not used by the review queue.
- SwitchesDB's native deep-link contract is a URL hash containing exact generated CSV keys. Its parser derives ThereminGoat keys from the exact upstream raw CSV filename, stripping unsafe punctuation and replacing ` Raw Data CSV.csv` with `~TG.csv`. Hash entries are URI-encoded and validated against `data/metadata.edn`; missing keys are rejected rather than guessed.
- High-resolution and raw CSV files may be sibling evidence for one measurement. The overlay resolver must select the exact SwitchesDB-loadable raw sibling inside the same `sourceKey`/candidate set; it must never cross a source group or collapse stock, break-in, dated, actuation-count, or retest measurements.

## Design decision

1. Add a pure allowlisted resolver from the card's stable candidate set to an exact SwitchesDB CSV key and URL. Supported identities must be derived from trusted repository + exact repository path only. No switch-name search or fuzzy fallback.
2. Prefer a SwitchesDB-loadable raw-data candidate within the same source group. Treat a unique exact key as success; ties, unsupported repositories, missing raw siblings, malformed paths, or keys not representable by the documented parser contract fail closed with a persistent card-local message.
3. Rework the existing overlay into a controlled accessible dialog accepting an exact resolved URL/label. Opening and closing changes component state only: no API mutation, queue refresh, navigation, or form reset.
4. Put the in-app SwitchesDB action first on every eligible review card. Keep the canonical exact-file GitHub action as a clearly labeled secondary provenance link opening a new tab with `noopener noreferrer`.
5. Preserve the review card component instance and all staged state (`chosenMaster`, override acknowledgement/reason, rank-assist staged action, filters, page, scroll, and focus). Escape/close returns focus to the invoking card action; 44px targets, keyboard trapping/labeling, dark theme, and 390x844 layout are acceptance requirements.
6. View-only interaction must issue no review, mapping, feedback, preference, sync, or catalog write. Flag-off behavior and existing guarded mutation endpoints remain unchanged.
7. Missing/unsafe identity is rendered as actionable card-local feedback while leaving the GitHub safe fallback available and leaving staged state untouched.

## Required verification

- Unit tests for exact path-to-SwitchesDB key derivation, encoding, sibling selection, source-group isolation, tie/missing/unsafe failures, and GitHub fallbacks.
- Component/browser tests for exact iframe URL, one-measurement direct load, multi-measurement separation, staged-state preservation, Escape/focus, mobile/dark/accessibility, and zero mutation calls.
- Independent QA must verify actual SwitchesDB rendering and before/after database counts before CI/release.
- iOS parity is N/A: this is an authenticated admin-only web surface; responsive mobile web remains required.
