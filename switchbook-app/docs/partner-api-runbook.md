# SwitchBook partner API runbook

## Production configuration

1. Create a separate PostgreSQL database/user for Hydra and set `HYDRA_DSN`. Never reuse or publish the application DB password.
2. Generate `HYDRA_SYSTEM_SECRET` with at least 32 random bytes. Keep it in the deployment secret store.
3. Generate an independent 32-byte `PARTNER_SECRET_ENCRYPTION_KEY` (base64 or hex) for encrypted webhook secrets. Back it up in the deployment secret store; losing or changing it without re-encrypting existing secrets disables webhook delivery.
4. Set `PARTNER_OIDC_ISSUER=https://switchbook.app`, `PARTNER_OIDC_AUDIENCE=https://switchbook.app/api/v1`, `REDIS_URL`, and a random `AUDIT_IP_SALT`.
5. Run `docker compose pull && docker compose up -d`. Compose runs Hydra migrations before serving; verify `docker compose ps`, `curl -fsS https://switchbook.app/health/ready`, and discovery/JWKS.
6. Provision KeebVault once with an exact callback URL:
   `PARTNER_NAME=KeebVault PARTNER_REDIRECT_URI=https://keebvault.example/oauth/switchbook/callback npm run partner:provision`
   Store the one-time client secret, catalog API key, and webhook secret in KeebVault's secret manager.
7. Schedule `npm run partner:webhooks` every minute if webhooks are enabled.

## OAuth requirements

- KeebVault must generate a fresh `state`, `nonce`, and S256 PKCE verifier for every authorization.
- Redirect URIs are exact HTTPS matches. Wildcards and implicit/password grants are forbidden.
- Request only needed scopes. `offline_access` is required for refresh tokens.
- Revoke at `/oauth2/revoke`; discovery is `/.well-known/openid-configuration`.

## Operations

- Rotate application keys by creating a new `PartnerCredential`, cut over, then set `revokedAt` on the old key.
- Hydra client secrets rotate through its admin API and the corresponding `PartnerApplication.secretHash` audit record.
- Alert on elevated 401/403/429/5xx rates, webhook retries, Redis failures, and Hydra readiness.
- Preserve tombstones indefinitely. Merge chains must terminate at one active record and may not cycle.
- Webhooks are signed with the decrypted per-application secret as `HMAC-SHA256(timestamp + "." + rawBody)`. Verify `X-SwitchBook-Timestamp` and `X-SwitchBook-Signature` before parsing, reject stale timestamps, and compare signatures in constant time.
- Rollback: revert the application image; migrations are additive. Keep Hydra schema/data and disable the partner application (`active=false`) for an immediate integration kill switch.

## Images and rights

KeebVault may hotlink SwitchBook-hosted images in authenticated owner dashboards and cache them for 24 hours. It must display “Data and photo from SwitchBook” linked to `recordUrl`. No public redistribution or permanent catalog mirror is granted. Individual image license/attribution fields override this default. Force curves are not copied: when available, the API supplies only a SwitchesDB search link.
