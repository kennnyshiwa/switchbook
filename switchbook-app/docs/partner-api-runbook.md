# SwitchBook partner API runbook

## Production configuration

1. Set unique `HYDRA_DB_USER`, `HYDRA_DB_PASSWORD`, and `HYDRA_DB_NAME`. Fresh volumes create the isolated role/database through `ops/postgres/init-hydra-db.sh`. For an existing volume, run `ops/postgres/bootstrap-hydra-db.sh` before cutover; it is idempotent and then proves Hydra connectivity by applying migrations.
2. Generate `HYDRA_SYSTEM_SECRET` with at least 32 random bytes. Keep it in the deployment secret store.
3. Generate an independent 32-byte `PARTNER_SECRET_ENCRYPTION_KEY` (base64 or hex) for encrypted webhook secrets. Back it up in the deployment secret store; losing or changing it without re-encrypting existing secrets disables webhook delivery.
4. Set `PARTNER_OIDC_ISSUER=https://switchbook.app`, `PARTNER_OIDC_AUDIENCE=https://switchbook.app/api/v1`, and a random `AUDIT_IP_SALT`. Compose provides persistent Redis at `redis://redis:6379`; the partner API fails closed if shared quota storage is unavailable.
5. Run `docker compose pull && docker compose up -d`. Compose runs Hydra migrations before serving; verify `docker compose ps`, `curl -fsS https://switchbook.app/health/ready`, and discovery/JWKS.
6. Obtain KeebVault's exact production HTTPS callback URL from the partner and provision it once:
   `PARTNER_NAME=KeebVault PARTNER_REDIRECT_URI=https://<partner-owned-host>/<exact-callback-path> npm run partner:provision`
   Do not substitute a placeholder, a SwitchBook-owned callback, or a wildcard. If the partner has not supplied the callback, catalog-key acceptance may continue, but production OAuth provisioning is blocked.
   Store the one-time client secret, catalog API key, and webhook secret in KeebVault's secret manager.
   Re-running with the same `PARTNER_CLIENT_ID` updates redirect/webhook configuration without rotating credentials. Rotation is explicit: set `PARTNER_ROTATE_SECRETS=true`, coordinate the cutover, and securely capture the newly printed values.
7. Schedule `npm run partner:webhooks` every minute if webhooks are enabled.

## OAuth requirements

- KeebVault must generate a fresh `state`, `nonce`, and S256 PKCE verifier for every authorization.
- Redirect URIs are exact HTTPS matches. Wildcards and implicit/password grants are forbidden.
- Request only needed scopes. `offline_access` is required for refresh tokens.
- Revoke at `/oauth2/revoke`; discovery is `/.well-known/openid-configuration`.

## External integration surfaces

- Production documentation is served at `https://switchbook.app/developers` and the OpenAPI 3.1 document at `https://switchbook.app/openapi/partner-v1.yaml`.
- The same-origin catalog request console is served at `https://switchbook.app/developers/sandbox`. It retains the entered application key only in page memory and sends it only to `switchbook.app`.
- The request console may use a scoped, revocable test credential against production-safe catalog data. Write/OAuth acceptance must use an isolated test account and synthetic records; it must not use a fabricated partner redirect URI.

### Repeatable acceptance evidence

- `ops/hydra/e2e-oauth.sh` creates isolated tmpfs Postgres/Hydra services, applies migrations, and drives login/consent challenges through Hydra's admin API. It verifies missing and wrong PKCE verifiers are rejected, a correct S256 verifier issues tokens, refresh rotation invalidates reuse, and revocation makes introspection inactive. The trap removes all temporary containers, networks, and data.
- `ops/partner-api/e2e-idempotency.sh` creates an isolated tmpfs database, applies application migrations, injects a fault after a business write but before response finalization, and proves rollback. It also proves one business mutation under six concurrent identical requests and byte-exact deterministic error replay.
- Run both from the repository root before release. Successful output begins `Hydra E2E PASS` and `Partner idempotency E2E PASS` respectively.

## Operations

- Rotate application keys by creating a new `PartnerCredential`, cut over, then set `revokedAt` on the old key.
- Hydra client secrets rotate through its admin API and the corresponding `PartnerApplication.secretHash` audit record.
- Alert on elevated 401/403/429/5xx rates, webhook retries, Redis failures, and Hydra readiness.
- Preserve tombstones indefinitely. Merge chains must terminate at one active record and may not cycle.
- Webhooks are signed with the decrypted per-application secret as `HMAC-SHA256(timestamp + "." + rawBody)`. Verify `X-SwitchBook-Timestamp` and `X-SwitchBook-Signature` before parsing, reject stale timestamps, and compare signatures in constant time.
- Rollback: revert the application image; migrations are additive. Keep Hydra schema/data and disable the partner application (`active=false`) for an immediate integration kill switch.

## Images and rights

KeebVault may hotlink SwitchBook-hosted images in authenticated owner dashboards and cache them for 24 hours. It must display “Data and photo from SwitchBook” linked to `recordUrl`. No public redistribution or permanent catalog mirror is granted. Individual image license/attribution fields override this default. Force curves are not copied: when available, the API supplies only a SwitchesDB search link.
