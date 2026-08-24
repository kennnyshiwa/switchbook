# ADR 0001: Partner API and OAuth boundary

Status: accepted (2026-08-23)

## Decision

SwitchBook exposes a versioned `/api/v1` contract from the existing Next.js/Postgres service. Read-only catalog access uses scoped, rotatable application keys. User-authorized profile, submission, and correction access uses OAuth 2.0 Authorization Code with S256 PKCE and OpenID Connect, issued by an Ory Hydra sidecar. Hydra owns authorization codes, token signing, refresh-token rotation/reuse detection, revocation, discovery, and JWKS. SwitchBook's existing NextAuth session supplies login identity; the consent bridge always displays requested scopes and requires an explicit decision.

The API validates issuer, audience, signature, expiry, authorized party, user linkage, and scopes. It never accepts unsigned identity headers and never implements OAuth token cryptography itself.

## Consequences

- Production needs an isolated Hydra database/credential, a 32+ byte system secret, exact HTTPS redirects, and a reverse proxy to Hydra's public port. Its admin port stays private.
- Access tokens live 15 minutes; refresh tokens live 30 days and rotate.
- Catalog DTOs are explicit allowlists. Raw Prisma records, user details, moderation internals, and raw force-curve data never cross the partner boundary.
- Legacy approved records without lifecycle rows are treated as active. Merged/removed records return tombstones so foreign inventory references remain repairable.
- API stability follows additive changes within v1; breaking changes require v2 and at least 180 days' notice.

## Rejected

- NextAuth as an authorization server: it is an OAuth client/session framework, not an issuer.
- Hand-built authorization codes, JWTs, refresh rotation, or PKCE: unacceptable security risk.
- Reusing UI endpoints: they expose broad Prisma shapes and are not a stable contract.
