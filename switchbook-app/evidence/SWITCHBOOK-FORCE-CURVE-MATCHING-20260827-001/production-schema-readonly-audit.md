# Production schema read-only audit

Date: 2026-08-27  
Host: `159.223.148.215`  
Compose project: `/home/kennnyshiwa/switchbook/switchbook-app`

The audit ran through `docker compose exec -T postgres psql` inside `BEGIN READ ONLY` and ended with `ROLLBACK`. No file, database, container, deployment, or migration state was changed.

## Verified migration state

- Production has completed migrations through `20260823215500_separate_partner_photo_identity`.
- The proposed force-curve and schema-catch-up migrations are not present.
- Historical migration rows include rolled-back failed attempts followed by successful rows for several 2025 migrations; there is no current failed force-curve migration.

## Verified production shape relevant to catch-up

- Enum `ClickType` already exists.
- `User.emailMarketing`, `MasterSwitch.imageUrl`, and `MasterSwitch.clickType` already exist.
- `PartnerSubmissionPhoto.sourceUrl` exists and is `NOT NULL`.
- `SwitchImage_switchId_fkey` already has the desired `ON DELETE SET NULL ON UPDATE CASCADE` definition.
- Existing tables include `PartnerSubmissionPhoto` and `SwitchImage`.
- Force-curve canonical enums/tables do not yet exist.

## Conclusion

The unconditional `20260827230000_schema_catchup` migration is confirmed unsafe for the real production shape: it would fail immediately on `CREATE TYPE "ClickType"`. The repair must be a guarded reconciliation that is a no-op for already-correct production objects, fills only genuinely missing historical-chain objects on a clean database, and never drops/recreates an already-correct constraint. It must be validated on both a clean historical migration chain and a production-shaped fixture before release authorization.
