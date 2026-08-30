# Builder evidence — optional MasterSwitch technology

- Revised invariant: force-curve attachment still requires an existing `APPROVED` MasterSwitch with a manufacturer; `MasterSwitch.technology` is optional and no longer blocks attachment.
- Both grouped and legacy single-review attachment gates use the same revised eligibility rule.
- Compatibility checks remain unchanged. When evidence is not compatible, explicit acknowledgement and an audited reason are still required.
- Card-local loading/success/error feedback remains in place for genuine failures; its `APPROVED_MASTER_REQUIRED` copy now describes only the remaining approval/manufacturer requirements.
- DB regression uses an approved target with null technology and verifies successful reviewed mappings, resolved review ownership, exact compatibility-override reason/actor audit, no mappings on the wrong target or raw siblings, preservation of the distinct automatic sibling, same-measurement supersession, replay immutability, and mixed-group atomic rollback.

## Verification

- Focused unit/admin/force-curve tests: PASS, 51/51.
- Null-technology override DB fixture: PASS on fresh isolated PostgreSQL 17 with all migrations applied.
- Full unit suite: PASS, 111/111.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with pre-existing unrelated warnings only.
- `npm run build`: PASS.
- `git diff --check`: PASS.

The isolated PostgreSQL instance was stopped and moved to Trash after the fixture. No production database was contacted or mutated.
