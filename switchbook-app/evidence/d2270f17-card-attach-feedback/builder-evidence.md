# Builder evidence — card-scoped force-curve attach feedback

- Root cause preserved: `APPROVED_MASTER_REQUIRED` remains a fail-closed server integrity gate; no server or data mutation logic changed.
- Change: the manual `Attach selected MasterSwitch` path owns persistent feedback keyed by `sourceKey`, rendered inside the exact review card with explicit loading, success, and actionable error states.
- The HTTP 400 message explains that approved manufacturer/technology metadata must be completed before retrying.
- Error handling does not clear selected MasterSwitch, compatibility override acknowledgement, audit reason, staged rank action, or card position. Skip/defer and flag-off paths are untouched.
- The inline block is mobile-safe at 390px (`break-words`, card-contained width), keyboard/screen-reader announced (`alert`/`status`, `aria-live`), and remains visible after the request completes.

## Verification

- Focused attach/rank/admin tests: PASS, 17/17.
- Full unit suite: PASS, 111/111.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with pre-existing unrelated warnings only.
- `npm run build`: PASS.
- `git diff --check`: PASS.
