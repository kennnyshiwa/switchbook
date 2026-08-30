# Independent QA — PASS_VERIFIED

Date: 2026-08-29
Assignment: `SWITCHBOOK-FORCE-CURVE-INCOMPATIBLE-IDENTITY-20260829-001`

## Verdict

`PASS_VERIFIED` for the scoped pre-deployment change. The reported MasterSwitch is now deliberately fail-closed and is presented as a disabled, reason-annotated search result. The backend remains the authority, so a stale client still receives `409 INCOMPATIBLE_IDENTITY`, while the changed UI maps that code to actionable copy. No implementation files were edited by QA.

This verdict does **not** assert that `cmqo2gr3403wqnu3voig85fi9` is the correct target for the curve. Live data and independent product evidence disagree on switch type, so attaching this source to that target must remain blocked until the catalog identity is corrected or an ID-scoped alias is supported by reconciled evidence.

## Exact production reproduction and data truth (read-only)

The user screenshot was inspected at:

`/Users/kennnyshiwa/.openclaw/workspace/media/inbound/openclaw-staged-af0daa4a-e89e-4cf6-9ca3-f1cc46ed351d/442fee44-b41b-4e44-acc2-43dac7b21a82.jpg`

It shows source group `measurement:80retros 1989 retro blue 80retros 1989 retro blue`, three evidence rows, selected result `KTT 80Retros KTT Game1989 Retro Blue — MECHANICAL`, an enabled attach button, and terminal raw `INCOMPATIBLE_IDENTITY` banner.

Read-only SQL against the production Compose PostgreSQL service confirmed:

- Reported target `cmqo2gr3403wqnu3voig85fi9`: `80Retros KTT Game1989 Retro Blue`, manufacturer `KTT`, type `TACTILE`, technology `MECHANICAL`, `APPROVED`.
- High-resolution catalog `cmtbuy2gk0004uq2nageylhc4`: display `80Retros 1989 Retro Blue`, path `80Retros 1989 Retro Blue/80Retros_1989_Retro_Blue_HighResolutionRaw.csv`, hash `fe599be40fd67a9e931b3f8c230d9a1286af868b`, revision `66cc5aa36208bb33997d3a037137ff60885f5861`, canonical source, exists.
- Raw catalog `cmtbuy2gc0003uq2n00sp53z2`: same display, raw path, hash `fc9241d05e3245ca1f34d493ae87fd2d232d65b6`, same revision, canonical source, exists.
- Reviews `cmtbuyudp044ruq2ntucske9q`, `cmtc6w9au0004mu2zprjiprpw`, and `cmtc7pvpa0003nu7dtq45nxvk` remain `OPEN` and unlinked. This verifies that the failed production action did not cross-attach the source.
- Sibling `cmiw6ucte007prs2ocgwrb4s2` is `KTT Retro Blue`, type `LINEAR`; it has an `AUTO_APPROVED` mapping to a different catalog entry (`cmtbuyk8302nquq2nb3xlbwwu`), not either 80Retros catalog ID.

The reported target's `TACTILE` type conflicts with the cited upstream characterization of the KTT-made 80Retros Blue Retro as silent linear. A broad fuzzy normalization would therefore create an unacceptable cross-switch risk.

## Scoped implementation audit

- `catalogMasterCompatibility` is shared by search presentation and mutation validation. It retains exact normalized folder/display equality, requires manufacturer evidence, and requires equality of all non-manufacturer identity tokens.
- The exact reported pair produces `compatible: false` with `MasterSwitch name and catalog switch identity do not exactly match.`
- A production-shaped exact identity (`80Retros KTT 1989 Retro Blue` / KTT) remains compatible.
- `KTT Retro Blue`, wrong color, wrong folder, missing manufacturer, and fuzzy manufacturer strings remain incompatible.
- Search now requires `catalogEntryId`, verifies the catalog row is current/canonical, and maps every returned approved MasterSwitch to a compatibility object.
- The select disables every non-compatible option and includes its reason. Attach remains disabled unless the selected result is explicitly compatible.
- The mutation path still locks and re-reads review, MasterSwitch, and catalog rows and reruns exact compatibility inside the transaction. A stale/old client therefore cannot bypass UI gating.
- The UI converts backend `INCOMPATIBLE_IDENTITY` into `That MasterSwitch does not exactly match this catalog switch. Choose a compatible result.` Raw code is no longer terminal UX on the changed client.
- `linkSourceReviewGroup`, queue grouping, conflicts, mapping publication, and idempotency/replay code were not weakened. Existing database coverage exercises exact group attachment, mixed-source atomic rollback, race serialization, replay safety, and queue behavior.

## Verification commands

- `git diff --check` — PASS.
- `npx tsx --test tests/force-curves.test.ts tests/admin-navigation.test.ts` — PASS, 29/29.
- `npx tsc --noEmit` — PASS.
- `npm test` — PASS, 80/80.
- `npm run lint` — PASS (only pre-existing warnings outside the scoped files).
- `npm run build` — PASS; optimized Next.js build completed and 83/83 static pages generated.

## Browser evidence limitation

Fresh local browser capture was not possible in this QA environment: no browser admin credentials or Chromium executable were provided, and the isolated PostgreSQL endpoint configured in `.env.local` (`localhost:55432`) was not listening. QA did not point the local app at production or mutate production to manufacture evidence. The exact pre-fix browser screenshot plus live read-only SQL establishes the reproduction; post-fix production browser evidence remains a mandatory release-stage check after Compose deployment.

## Release-stage assertions still required

- In production, search this exact source group for `80Retros`; confirm `cmqo2gr3403wqnu3voig85fi9` is disabled with the exact actionable reason and attach remains disabled.
- Confirm no raw `INCOMPATIBLE_IDENTITY` banner is shown, including a deliberately stale-client PUT.
- Confirm the three exact review rows remain unlinked and neither 80Retros catalog ID gains a mapping.
- Exercise one independently verified exact compatible source/master pair through attach and replay, then confirm one mapping only and unchanged queue grouping.
- Record iOS parity as N/A: this is an authenticated web-admin-only surface.
