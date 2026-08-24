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
