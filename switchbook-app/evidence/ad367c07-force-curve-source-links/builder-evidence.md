# Builder evidence — canonical force-curve review links

- Baseline: `d7d9e41ffeb97fbc713906f57ae037de95b1d220`
- Root cause: the catalog query loaded `ForceCurveCatalogEntry.repositoryPath` but omitted `source` from the admin queue projection, leaving review cards unable to construct a publisher-aware upstream target.
- Change: project `source`, construct exact segment-encoded GitHub blob links only from valid `github:owner/repository` metadata and safe relative paths, otherwise fall back to `https://github.com/ThereminGoat/force-curves`.
- UI: each review card exposes a 44px-minimum, keyboard-focusable source link with publisher text, a descriptive new-tab accessible label, `target="_blank"`, and `rel="noopener noreferrer"`. It is a plain anchor with no state or mutation handler.
- Preserved: review decisions, rank assist, flag-off presentation, assignment flow, authorization, API methods, and mutation behavior are unchanged.

## Verification

- Focused: `npx tsx --test tests/force-curves.test.ts tests/admin-navigation.test.ts` — PASS, 38/38.
- Typecheck: `npx tsc --noEmit` — PASS.
- Full unit suite: `npm test` — PASS, 109/109.
- Lint: `npm run lint` — PASS with pre-existing unrelated warnings only.
- Production build: `npm run build` — PASS.
