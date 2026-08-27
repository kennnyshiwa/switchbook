# Ops production release attempt

Date: 2026-08-27  
Accepted revision: `345cfaae0954a92704443e00f123b9b559baa3b6`  
CI run: `33099333087` (`SUCCESS`)  
Status: **BLOCKED — production sync command is not runnable in the image**

## Pre-release and rollback capture

- Previous revision: `6afae2b734e1e058511306e5a7b76ce04e6c6a98`
- Previous image ID: `sha256:2835559601bccf0492bc82046de8bb20a863f0033c5108d9fe8315689e8612bb`
- Previous retained digest: `ghcr.io/kennnyshiwa/switchbook@sha256:2ab06ef4cb1d50d8b5413264f75ee508c2a3b937aefdb2992e53e969998b3531`
- All services were healthy before release. `FORCE_CURVE_LEGACY_ROLLBACK` was unset.
- `_prisma_migrations` had zero unfinished, non-rolled-back rows.

## Exact image and Compose-only deploy

The approved app image was pulled and its OCI revision asserted before deploy:

- Revision: `345cfaae0954a92704443e00f123b9b559baa3b6`
- Image ID: `sha256:bd4faba02b187acc4545bc1a6c54be13da866abf0b43ab3b88ae8f94061d2bef`
- Digest: `ghcr.io/kennnyshiwa/switchbook@sha256:69094c0f82a354f6f843f4bc5537f1917a78e8f61a540b553adc10ab7987dafb`

The only deployment command was:

```sh
docker compose -f docker-compose.yml -f docker-compose.switchesdb.yml up -d app
```

The app started healthy at the exact image and applied both new migrations through its normal startup path:

- `20260827190000_add_canonical_force_curves`
- `20260827230000_schema_catchup`

Prisma reported 33 migrations and `Database schema is up to date!`. There were no P3018/42710 errors.

## Blocking failure

The required normal initial sync command failed before catalog or mapping writes:

```text
$ docker compose -f docker-compose.yml -f docker-compose.switchesdb.yml exec -T app npm run force-curves:sync
> switchbook-app@1.0.0 force-curves:sync
> tsx scripts/sync-force-curves.ts
sh: tsx: not found
```

Cause: `force-curves:sync` depends on `tsx`, which is a development dependency. The production runner copies `scripts/` but neither installs/copies `tsx` nor includes the imported TypeScript source tree/runtime dependencies. The required packaged production sync path therefore does not exist. Ops stopped and did not use an ad-hoc interpreter, registry install, admin-session workaround, or direct database mutation.

Post-failure counts confirm no partial sync state:

- catalog entries: `0`
- mappings: `0`
- reviews: `0`
- sync runs: `0`

## Healthy deployed state after stop

- App, PostgreSQL, Hydra, Redis, and SwitchesDB healthy; nginx running.
- `GET https://switchbook.app/health/ready`: HTTP 200, `{"status":"ok"}`.
- Peach canonical API: HTTP 200, `{"curves":[],"source":"canonical"}`.
- Anonymous admin queue: HTTP 307 to `/auth/login`.
- Recent app-log scan: zero error/exception/fatal/panic/P30xx lines.
- Canonical tables remain empty, so no approved sample mappings exist yet and the initial-sync/idempotency acceptance gates cannot be evaluated.

## Required repair and rollback

Builder must provide a production-supported sync entry point in the built image (and tests proving it executes there), followed by a new exact-SHA CI-green Compose release. Do not paper over this by installing `tsx` interactively in production.

If rollback is required, set `FORCE_CURVE_LEGACY_ROLLBACK=true` in the Compose environment, retag the retained previous digest as the Compose app image, and run the same Compose-only `up -d app`. The two schema migrations and empty additive canonical tables may remain intact. Rollback was documented but not executed.

