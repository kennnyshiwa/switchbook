# Independent QA — production sync packaging fix

Date: 2026-08-27  
Iteration: 1  
Verdict: **PASS for commit/CI; production execution remains gated on an exact-SHA CI image build and post-redeploy runner test**

## Scope and design review

Reviewed `ops-production-release.md`, `builder-release-fix.md`, `Dockerfile`, `package.json`, `package-lock.json`, the sync entrypoint, generated bundle, and Next standalone trace independently.

- The builder stage runs `npm run build:force-curves-sync` and deterministically emits `dist/sync-force-curves.cjs`.
- The runner copies `/app/dist`, while `force-curves:sync` invokes only `node dist/sync-force-curves.cjs`.
- `tsx` and raw TypeScript/scripts are no longer runtime requirements.
- Application code imported by `scripts/sync-force-curves.ts` is bundled. The sole intentional external is `@prisma/client`; both `.next/standalone/node_modules/@prisma/client` and `.next/standalone/node_modules/.prisma/client` are present after the production build.
- `esbuild` is a build-only dev dependency and is not needed in the runner.
- No endpoint, ad-hoc package installation, second service, or production credential handling was added.

## QA evidence

### Artifact and runtime entrypoint

- Built twice with `npm run build:force-curves-sync`: PASS, 8.7 KB both times.
- SHA-256 was identical on both builds: `632b12ca250ac1b360188dd9337db49fc5ff82e2754f1e7dee5454957508a3f8`.
- Controlled invocation with an unreachable PostgreSQL URL: reached `prisma.forceCurveSyncRun.upsert()` and failed only with `Can't reach database server at 127.0.0.1:1`. No interpreter, module-resolution, generated-client, or syntax failure.
- Bundle inspection found bundled `src/lib/prisma.ts`, `src/lib/force-curves.ts`, and the entrypoint; no `tsx` dependency or TypeScript-source runtime import.

### PostgreSQL 17 fixture and idempotency

Used a disposable local PostgreSQL 17.8 database, then removed it.

- `npx prisma migrate deploy`: PASS, all 33 migrations applied from scratch.
- `npm run test:force-curves-db`: PASS (`runs=4`, `catalog=5`, `reviews=6`, `peachApprovedUrls=[]`).
- Repeated `npx prisma migrate deploy`: PASS, `No pending migrations to apply`.
- Packaged `node dist/sync-force-curves.cjs` against the migrated fixture: PASS.
- Repeated packaged sync: PASS and returned the same completed sync-run ID/revision with zero errors, demonstrating resumable/idempotent revision handling.
- KTT Peach Blossom remained without an approved URL in the DB suite (`peachApprovedUrls=[]`).

### Full gates

- `npm test`: PASS, 55/55.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with only pre-existing warnings.
- `npm run build`: PASS, 82 routes/pages; the standalone Prisma client and generated client are traced.
- `git diff --check`: PASS.

## Docker runner-image gate

`docker info` and `docker version` were attempted. The client could not obtain a daemon response and timed out; this reproduces the builder's Docker Desktop unavailable blocker. Consequently, this host cannot independently execute the final runner image.

This does **not** block committing the scoped packaging fix and asking CI to build the exact image. It **does** remain a hard release gate: do not redeploy or run production sync unless CI succeeds for the exact commit and the resulting runner image is verified to contain `dist/sync-force-curves.cjs` and successfully reaches Prisma when `npm run force-curves:sync` is executed. After Compose redeploy, ops must run the normal sync command and complete the previously required production QA.

## Worktree isolation

The packaging fix owns only `Dockerfile`, `package.json`, and `package-lock.json` (plus its evidence files). Existing unrelated changes such as `scripts/rehost-master-switch-images.ts`, the parent `.gitignore`, and other evidence directories were neither edited nor included by QA. QA created only this evidence file. No commit, push, deploy, container lifecycle operation, or production mutation was performed.

## Rollback

Revert the three packaging files to restore the prior entrypoint. Feature rollback remains `FORCE_CURVE_LEGACY_ROLLBACK=true` plus an authorized Compose redeploy; additive canonical data may remain. The prior production failure occurred before sync writes, so this packaging repair itself requires no data rollback.
