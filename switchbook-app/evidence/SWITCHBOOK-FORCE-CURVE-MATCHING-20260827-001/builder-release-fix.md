# Builder release fix — packaged production sync entrypoint

Date: 2026-08-27

Status: host and PostgreSQL gates pass; Docker image execution must be rerun by QA/ops because Docker Desktop on this builder host reports `Docker Desktop is unable to start`.

## Change

- `force-curves:sync` now runs `node dist/sync-force-curves.cjs` rather than the development-only `tsx` interpreter.
- The builder stage compiles `scripts/sync-force-curves.ts` and its application imports into one Node 20 CommonJS artifact with esbuild. `@prisma/client` remains external so the generated client/runtime already traced into the Next standalone image is used.
- The runner copies only `dist/`, not raw TypeScript scripts. No TypeScript interpreter, source tree, ad-hoc install, endpoint, credential, or additional production service is introduced.
- esbuild is a direct development/build dependency only and is absent from the runtime stage.

## Verification

- `npm run build:force-curves-sync`: PASS; emitted `dist/sync-force-curves.cjs` (8.7 KB).
- Controlled unreachable-DB startup: `DATABASE_URL='postgresql://invalid:invalid@127.0.0.1:1/invalid?connect_timeout=1' npm run force-curves:sync`: reached `prisma.forceCurveSyncRun.upsert()` and failed only with Prisma `Can't reach database server at 127.0.0.1:1`. There was no `tsx: not found`, module-resolution, syntax, or missing-generated-client error.
- Fresh disposable PostgreSQL 17 database `sb_fc_release_fix`: all 33 migrations applied; `npm run test:force-curves-db` PASS with `runs=4`, `catalog=5`, `reviews=6`, `peachApprovedUrls=[]`; database dropped afterward.
- `npm test`: PASS, 55/55.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with only the existing warnings.
- `npm run build`: PASS, 82 pages/routes.
- `git diff --check`: PASS.
- `docker build -t switchbook-force-curves-sync:test .`: environment BLOCKED before build by Docker Desktop startup failure. Independent QA/ops must build the image and run `npm run force-curves:sync` in the resulting runner against an unreachable or disposable PostgreSQL endpoint before release.

## Files owned by this fix

- `Dockerfile`
- `package.json`
- `package-lock.json`
- this evidence file

Unrelated dirty files were not modified. No commit, push, deployment, or production mutation was performed.

## Rollback

Revert these three packaging files. The canonical schema/data are additive and unaffected. The production feature rollback remains `FORCE_CURVE_LEGACY_ROLLBACK=true` followed by the authorized Compose redeploy.
