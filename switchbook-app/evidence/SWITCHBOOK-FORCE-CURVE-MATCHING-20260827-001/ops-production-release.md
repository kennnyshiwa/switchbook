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

## Iteration 2: packaged runner released, upstream format blocker found

Date: 2026-08-27
Accepted revision: `c55fb42fda4c5f169e1f930ab27ff43ee1070e92`
CI run: `33100608980` (`SUCCESS`)
Status: **BLOCKED — catalog filter matches none of the current upstream CSV files**

### Exact image and Compose-only deployment

Before the retry, production was healthy on revision `345cfaae0954a92704443e00f123b9b559baa3b6`, image ID `sha256:bd4faba02b187acc4545bc1a6c54be13da866abf0b43ab3b88ae8f94061d2bef`, retained digest `ghcr.io/kennnyshiwa/switchbook@sha256:69094c0f82a354f6f843f4bc5537f1917a78e8f61a540b553adc10ab7987dafb`.

Ops pulled `ghcr.io/kennnyshiwa/switchbook:main` and asserted its OCI revision before deployment:

- image ID: `sha256:cc7b2014df471cfc35d8cee944c66a332eaa0f0b6f20b45904dd20750496a78d`
- OCI revision: `c55fb42fda4c5f169e1f930ab27ff43ee1070e92`
- digest: `ghcr.io/kennnyshiwa/switchbook@sha256:a4fefa2e4c2f310e5cdfaad5ab1cd3a11b1aa1ed5fcfb5d34006e67e4ea1b009`

The only deploy command was:

```sh
docker compose -f docker-compose.yml -f docker-compose.switchesdb.yml up -d app
```

The app became healthy at the asserted image; `GET https://switchbook.app/health/ready` returned HTTP 200 with `{"status":"ok"}`. PostgreSQL, Hydra, Redis, and SwitchesDB remained healthy. Prisma startup found 33 migrations, reported no pending migrations, and `_prisma_migrations` contained zero unfinished non-rolled-back rows. The app log scan after deployment found zero `error|exception|fatal|panic|P30xx` matches.

### Runner and sync evidence

The production container contains `/app/dist/sync-force-curves.cjs` (8,906 bytes), and `npm pkg get scripts.force-curves:sync` returned `"node dist/sync-force-curves.cjs"`.

The first `npm run force-curves:sync` completed a sync run for upstream revision `66cc5aa36208bb33997d3a037137ff60885f5861`. A second invocation returned the same completed run in four seconds without adding another run, proving revision-level idempotency. Its persisted result was:

```text
status=COMPLETED cursor=0 before=0 after=0 new=0 changed=0 stale=0
unmatched=2756 reviews=2756 errors=0
```

Production after the run:

- catalog entries: `0` (`0` existing)
- mappings: `NO_MATCH=1`; `AUTO_APPROVED=0`; `MANUALLY_APPROVED=0`; all other states `0`
- review cases: `UNMATCHED/OPEN=2756`
- sync runs: `COMPLETED=1`, aggregate errors `0`

This is not a valid initial catalog. A direct read-only GitHub tree audit of the exact fetched revision reported `truncated=false`, 15,029 total tree entries, 5,422 CSV blobs, and **zero** paths matching `(^|/)TG\.csv$`. Current examples are named `<switch> Raw Data CSV.csv` and `<switch>_HighResolutionRaw.csv`. The packaged importer filters exclusively for `TG.csv`, therefore it deterministically submits an empty catalog and queues every approved master switch as unmatched. This also makes the required approved-mapping sample and curve-URL HTTP verification impossible.

### Safety checks

- `GET /api/force-curves/cmqo21sm103vknu3vh0tjs75x`: HTTP 200, `{"curves":[],"source":"canonical"}`.
- `GET /share/switch/gWtSnezYCI`: HTTP 200 and no `TG.csv` string in the rendered response.
- anonymous `GET /admin/force-curves`: HTTP 307 to `/auth/login`.
- anonymous `GET /api/admin/force-curves/reviews`: HTTP 401.
- anonymous `POST /api/admin/force-curves/reviews` with `{}`: HTTP 401.

### Required repair and rollback

Builder must update catalog discovery and metadata extraction for the repository's actual, versioned source formats, with fixtures that include current Raw Data and HighResolutionRaw paths. It must avoid treating two representations of one switch as ambiguous curves, populate manufacturer/technology metadata required by the fail-closed matcher, and define whether raw versus high-resolution files are user-facing. The 2,756 mechanically generated unmatched review cases also need a guarded reconciliation plan so the corrected rerun does not preserve queue noise. A new exact-SHA CI-green release and independent production QA are required.

Rollback was not activated. If required, set `FORCE_CURVE_LEGACY_ROLLBACK=true`, restore the prior retained image digest through the Compose app image reference, and run the same Compose-only `up -d app`; additive canonical tables and sync/review audit data can remain intact. No ad-hoc package install, destructive SQL, manual container lifecycle command, commit, or production code edit was performed.
