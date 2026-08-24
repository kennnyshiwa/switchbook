# Builder self-test — SWITCHBOOK-KEEBVAULT-ACCEPT-20260823-001

Date: 2026-08-23 (America/New_York)

## Production/config diagnosis

- Production image before repair: `cb5ff3c6a200d88f16a2884f0c79ca347b811090`.
- Compose services observed healthy: application, nginx, Hydra, Postgres, and shared Redis.
- Partner OAuth issuer/audience, Hydra admin URL, Redis URL, and secret-encryption key are configured (values redacted).
- Initial production counts: zero partner applications and zero Hydra clients.
- `sandbox.switchbook.app` had no DNS answer. The OpenAPI file advertised it, but there was no normal developer or sandbox UI route.
- The normal submission/upload/correction UI did not safely extract the partner API's nested structured JSON error shape and did not safely handle non-JSON error bodies.
- A production catalog request showed Cloudflare exposes origin ETags as weak validators. The origin's byte-exact `If-None-Match` comparison therefore returned 200 instead of 304.

## Repairs and provisioning

- Added `/developers` and `/developers/sandbox`; the sandbox keeps a user-entered key in page memory and sends it only to the same-origin catalog API.
- Added legacy, structured, and non-JSON client error extraction and used it in the normal switch submission, photo upload, and correction UI.
- Added RFC weak comparison for `If-None-Match`, including comma-separated validators.
- A first provisioning attempt used an inferred `keebvault.app` callback. Ownership/implementation could not be established, so it was rejected as non-authoritative and fully rolled back: application disabled, one credential revoked, Hydra client deletion returned 204, and subsequent Hydra lookup returned 404.
- Raw values are absent from source/evidence. The revoked one-time output is quarantined at `/Users/kennnyshiwa/.openclaw/secure-handoffs/quarantine/SWITCHBOOK-KEEBVAULT-ACCEPT-20260823-001.revoked.json`, mode `000` inside a `0700` directory. It must not be handed off or reactivated.
- Revocation controls: partner application `active=false`, credential `revokedAt`, Hydra client delete/secret rotation, and OAuth `/oauth2/revoke`.

## Evidence summary

- Before immediate revocation, the isolated key proved search 200 with two results; single 200; ordered batch 200 with `ACTIVE` and `NOT_FOUND`; missing key 401 with `code`, `message`, and `requestId`. The key is no longer active.
- ETag production issue reproduced; repair unit test accepts CDN-weakened and comma-separated validators. Post-release production 304 remains an Ops/QA verification item.
- Full test suite: 33 passed, 0 failed.
- TypeScript: pass (`tsc --noEmit`).
- Lint: pass with only pre-existing warnings.
- Clean production build: pass; generated routes include `/developers` and `/developers/sandbox`.
- Hydra E2E: S256 required; missing/wrong verifier rejected; authorization code and consent scopes; refresh rotation; replay rejection; revocation all pass.
- Partner atomicity E2E: injected rollback, concurrent exactly-once behavior, deterministic replay all pass.
- Partner photo E2E: two remote images sharing one source page ingest once under six concurrent replays; checksum deduplication removes redundant upload.

## Remaining release boundary

Authoritative KeebVault-owned OAuth callback evidence is required before provisioning. Ops must release only through CI/Compose, verify rollback, configure DNS/TLS for `sandbox.switchbook.app` (or formally use the same-origin `/developers/sandbox` URL), and demonstrate the repaired external 304 on the released SHA. Independent production acceptance belongs to QA.

## Builder iteration 2

- The main submission call site now parses its response exactly once through `responseJsonBody`; HTML/empty error bodies resolve to the safe fallback, while structured and legacy JSON errors remain readable. Duplicate and successful responses are shape-checked before use.
- Regression coverage reads the main submission source to prohibit a return to unconditional `response.json()` and directly verifies non-JSON parsing returns `null`.
- The initial `npm audit --omit=dev` reported seven high transitive findings after the lockfile refresh in `0777d7f`:
  - Next.js 15.5.23 hard-pins `postcss@8.4.31` (GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849) and permits `sharp@^0.34.3`, resolved to 0.34.5 (GHSA-f88m-g3jw-g9cj). npm's offered fix is Next.js 16.3.2, a framework major upgrade outside this focused acceptance repair.
  - Prisma 6.19.0 hard-pinned `@prisma/config@6.19.0`, which pinned `deepmerge-ts@7.1.5` (GHSA-ggr8-5vv4-36mx) and `effect@3.18.4` (GHSA-38f7-945m-qr2g).
  - Exposure is build/config tooling rather than partner request-data execution: application runtime imports `@prisma/client`; the vulnerable Prisma packages are CLI/config dependencies used for generation/migrations. The PostCSS and sharp copies are framework build/image-processing dependencies. This reduces exploitability but does not erase the advisories; major upgrades require a separately tested release.

## Builder iteration 3

- Registry verification found compatible Prisma and `@prisma/client` patches through 6.19.3. Both were updated together from 6.19.0 to 6.19.3.
- `@prisma/config@6.19.3` upgrades `effect` to 3.21.0, clearing GHSA-38f7-945m-qr2g. Audit moved from seven to six high package findings. The claim that this patch clears four findings is not supported by the current registry audit.
- Prisma 6.19.3 still hard-pins `deepmerge-ts@7.1.5`, so GHSA-ggr8-5vv4-36mx remains and npm reports it through `deepmerge-ts`, `@prisma/config`, and `prisma`. No newer 6.19.x patch exists; forcing `deepmerge-ts` 8 would override a hard-pinned transitive major.
- The other three residual package findings are the existing Next.js chain: `next`, its hard-pinned `postcss@8.4.31`, and its `sharp@0.34.5`. npm offers Next 16.3.2 as the fix, a framework major that remains outside this focused rework.
