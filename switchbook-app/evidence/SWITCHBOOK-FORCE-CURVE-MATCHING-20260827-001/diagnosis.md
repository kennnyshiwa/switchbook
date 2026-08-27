# Diagnosis evidence

- Production API `GET https://switchbook.app/api/share/switch/gWtSnezYCI` returned `MasterSwitch.id=cmqo21sm103vknu3vh0tjs75x`, name `KTT Peach Blossom`, manufacturer `KTT`, technology `MECHANICAL`, updated `2026-08-27T16:20:48.403Z`.
- `src/utils/forceCurves.ts` fetches only top-level tree folder names, then applies case-insensitive exact, manufacturer+name exact, and bidirectional substring matching. It returns the first sorted display-name match from `findForceCurveData`.
- `src/components/ForceCurvesButton.tsx` invokes that client-side matcher and directly opens its generated GitHub folder URL. Saved preferences are keyed by `(userId, switchName, manufacturer)` and retain arbitrary selected folder/URL rather than catalog identity.
- `src/app/api/force-curve-feedback/route.ts` stores feedback by display name and only deletes `ForceCurveCache`; `getIncorrectMatches` in `src/utils/forceCurves.ts` is a stub that always returns an empty set.
- The upstream recursive tree inspected on 2026-08-27 contains top-level `Cherry Blossom`, `Cherry MX Blossom`, and `Jerrzi Cherry Blossom`, but no exact `KTT Peach Blossom` folder. Therefore this master switch has no verified curve.
- The production API record’s `originalSubmissionData.sourceSwitchId` is `cmqo21nh203vgnu3vc6bod3s9`; the canonical linkage target remains the master ID, not that submission/source switch ID.

The root failure is identity: mutable display names are being treated as source identifiers. Cache invalidation and user preferences cannot make that safe because neither establishes existence, uniqueness, manufacturer compatibility, technology compatibility, or durable upstream identity.
