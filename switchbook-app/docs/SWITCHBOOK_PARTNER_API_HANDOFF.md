# SwitchBook Partner API handoff

This document is the standalone integration contract for a partner consuming SwitchBook's canonical switch catalog. The authoritative machine-readable contract is OpenAPI 3.1 at:

- Production base URL: `https://switchbook.app/api/v1`
- Sandbox base URL: `https://sandbox.switchbook.app/api/v1`
- OpenAPI: `https://switchbook.app/openapi/partner-v1.yaml` (contract version 1.1.0)

Catalog application keys are read-only, server-side credentials with exactly the `catalog:read` scope. They cannot submit switches, suggest corrections, access profiles, or invoke OAuth flows.

## Security and authentication

Send the application key in `X-API-Key` over HTTPS. Keep it in a server-side secret store; never put it in browser or mobile code, source control, URLs, analytics, logs, screenshots, support tickets, or client-visible errors. The examples below use placeholders only.

```http
X-API-Key: <APPLICATION_KEY>
```

For a server-side JavaScript process:

```js
const response = await fetch(
  "https://switchbook.app/api/v1/catalog/switches?manufacturer=Gateron&limit=25",
  { headers: { "X-API-Key": process.env.SWITCHBOOK_APPLICATION_KEY } },
);
if (!response.ok) throw new Error(`SwitchBook request failed: ${response.status}`);
const page = await response.json();
```

For a manual curl smoke test, use the placeholder only in shared material. A real operator should load the header from a protected curl config or equivalent secret injection so the key is not typed into shell history or exposed in process arguments.

```bash
curl --fail-with-body --config ./switchbook-partner.curlrc \
  'https://switchbook.app/api/v1/catalog/switches?q=Oil%20King&limit=10'
```

Example protected `switchbook-partner.curlrc` shape (mode `0600`; replace the placeholder only in the protected local file):

```text
header = "X-API-Key: <APPLICATION_KEY>"
```

Authentication failures return `401`. A valid credential missing the required scope returns `403`. Each application has a fixed per-minute rate limit; exhausted windows return `429` with a reset timestamp in `error.details.resetAt`. Do not retry `401` or `403`; back off until the stated reset for `429`.

## Operator key lifecycle

Run these commands from the application repository with its normal protected database configuration. They do not contact Hydra, register redirects, send webhooks, or print raw keys. `--output` is mandatory for issue and rotation; the path is created exclusively with mode `0600`, and the operation fails rather than overwriting an existing file. Move the value immediately into the designated secret store, then securely remove the one-time file under your organization's secret-handling policy.

### Issue

```bash
npm run partner:catalog-key -- issue \
  --name 'Example catalog consumer' \
  --rate-limit 120 \
  --expires-at '2027-09-05T00:00:00Z' \
  --output /protected/operator-selected/new-switchbook-key.json
```

`--expires-at` is optional and must be a future ISO-8601 timestamp. The bounded rate limit is 1–600 requests per minute (default 120). The command creates an active `PartnerApplication` with only `catalog:read`, empty redirect URIs, no webhook configuration, and an inaccessible/discarded OAuth secret. Console output contains only application and credential metadata, including the non-secret key prefix.

### Inspect metadata

```bash
npm run partner:catalog-key -- list
npm run partner:catalog-key -- status --application catalog_exampleclientid
```

Use the exact `clientId` shown by issue/list/status. Names are display labels and are not accepted as rotation or revocation targets. Metadata includes active/revoked/expired state, prefix, rate limit, creation time, and last-use time, never the raw key.

### Rotate

```bash
npm run partner:catalog-key -- rotate \
  --application catalog_exampleclientid \
  --expires-at '2027-09-05T00:00:00Z' \
  --output /protected/operator-selected/rotated-switchbook-key.json
```

Rotation is serialized and atomic in the database: all active credentials for the exact catalog-only application are revoked and one replacement is created in the same transaction. The one-time file is published before commit; a publication error rolls the transaction back. Coordinate consumer secret replacement because the prior key stops authenticating when rotation commits. `--rate-limit` may be supplied to change the application limit during rotation.

### Revoke

Revoke one exact credential prefix:

```bash
npm run partner:catalog-key -- revoke \
  --application catalog_exampleclientid \
  --prefix sbk_0123456789ab
```

Or revoke every active credential belonging to one exact application:

```bash
npm run partner:catalog-key -- revoke --application catalog_exampleclientid
```

Issue, rotation, and revocation create `PartnerAuditEvent` records containing application IDs, credential IDs/prefixes, timestamps, and lifecycle metadata only. Raw key material and secret hashes are excluded from audit metadata and console output. Repeating revoke against an already-revoked or mismatched prefix fails closed.

## Catalog discovery

All catalog reads expose only records whose moderation status is `APPROVED` and whose lifecycle is active (including legacy records with no lifecycle row). Pending and rejected data is never included.

### Deterministic substring search

`GET /catalog/switches` preserves its existing behavior. Optional `q` is a case-insensitive substring across `name`, `chineseName`, and `manufacturer`; it does not correct typos. Optional exact filters are `manufacturer`, `type`, and `technology`.

```bash
curl --fail-with-body --config ./switchbook-partner.curlrc \
  'https://switchbook.app/api/v1/catalog/switches?q=oil&manufacturer=Gateron&sort=name&order=asc&limit=25'
```

The endpoint uses cursor pagination. `limit` is 1–100 (default 25). If `page.hasMore` is true, pass `page.nextCursor` as `cursor` without changing the filters, sort, or order. Do not interpret a cursor as a durable record ID or construct one yourself.

### Advisory typo-tolerant discovery

`GET /catalog/switches/similar` is explicit and backward-compatible. `q` is required, trimmed, Unicode-normalized, and limited to 2–120 searchable characters and 24 terms. Empty normalized text, control/format characters, oversized input, and too-short input return `400`. `limit` is 1–25 (default 10). Existing `manufacturer`, `type`, and `technology` filters are optional.

```bash
curl --fail-with-body --config ./switchbook-partner.curlrc \
  'https://switchbook.app/api/v1/catalog/switches/similar?q=Gateron%20Oil%20Kign&limit=10'
```

```js
const query = new URLSearchParams({ q: "Gateron Oil Kign", limit: "10" });
const response = await fetch(
  `https://switchbook.app/api/v1/catalog/switches/similar?${query}`,
  { headers: { "X-API-Key": process.env.SWITCHBOOK_APPLICATION_KEY } },
);
const result = await response.json();
for (const candidate of result.data) {
  console.log(candidate.id, candidate.match.kind, candidate.match.matchedFields);
}
```

Ordering is deterministic: normalized `exact`, then `substring`, then bounded edit `similar`; equal scores use SwitchBook ID ascending. `match.matchedFields` names `name`, `chineseName`, and/or `manufacturer`. `match.explanation`, `advisory: true`, and `requiresHumanConfirmation: true` make the contract explicit. `rankScore` is only a stable heuristic ordering value—never confidence, probability, or permission to resolve identity. Ambiguous matches remain separate candidates. A consumer must show candidates for human confirmation and use the selected stable SwitchBook ID. It must never auto-link, auto-merge, auto-submit, or silently select the first result.

The scorer reads at most 5,000 filtered approved-active candidates in one bounded projection and performs no per-result database reads. A catalog larger than that bound returns `503 search_capacity_exceeded`; narrow exact filters and retry. An empty `data` array is a valid negative result.

## Retrieval endpoints

- `GET /catalog/switches/{id}` — returns one full active record, a `MERGED`/`REMOVED` tombstone, or `404`.
- `POST /catalog/switches/batch` — retrieves 1–100 IDs in request order. Each item is `ACTIVE` with data, `MERGED`/`REMOVED` as a tombstone, or `NOT_FOUND`.
- `POST /migration/matches` — read-only reviewed migration candidates for up to 100 external entries. It never modifies inventory and still requires user confirmation.

Treat `id` as the only durable catalog identity. Names, manufacturers, images, and measurements can evolve. Persist IDs and periodically refresh records.

### Lifecycle and tombstones

An active full response has `status: ACTIVE`. When records are deduplicated, `status: MERGED` includes `mergedIntoId`; replace the stored ID only after consuming that explicit tombstone. `REMOVED` may have no replacement. `NOT_FOUND` in batch means no approved catalog identity is available. Never infer deletion from a transient error, empty search page, spelling result, or a name change.

## Full switch record

The full record includes:

- identity: `id`, `status`, `mergedIntoId`, `name`, `chineseName`, `manufacturer`, `type`, `technology`;
- forces in gram-force: `forces.initialGf`, `actuationGf`, `tactileGf`, `bottomOutGf`;
- travel in millimetres: `travel.preMm`, `totalMm`, `tactilePositionMm`;
- materials: `materials.topHousing`, `bottomHousing`, `stem`;
- colors: `colors.topHousing`, `bottomHousing`, `stem`;
- construction: `stemShape`, `spring.weight`, `spring.length`, `spring.progressive`, `spring.stages`, `clickType`, `markings`, `compatibility`, `notes`;
- magnetic-only metadata: `magnetic.orientation`, `position`, `polarity`, `initialFluxGs`, `bottomOutFluxGs`, `pcbThickness` (otherwise `magnetic` is null);
- media and provenance: `images`, `thumbnail`, `forceCurve`, `forceCurves`, `recordUrl`, `attribution`;
- revisions: `version`, `createdAt`, `updatedAt`.

Nullable measurements mean “not recorded,” not zero. Preserve the units and field distinctions; for example, tactile force is not interchangeable with actuation force.

### Force curves and multiple measurements

`forceCurve` is the backward-compatible first approved measurement summary with `available`, `url`, fixed `source: SwitchesDB`, `rawDataIncluded: false`, and `checkedAt`. `forceCurves` is the complete array of every currently approved distinct measurement. Each item has:

- `measurementId` — stable measurement/catalog identity;
- `condition` — source-supported condition such as stock, break-in/retest, or generic measurement;
- `measuredAt` — source-supported `YYYY-MM-DD` date or null;
- `url` — upstream curve file URL;
- `source` — measurement provenance label;
- `rawDataIncluded` — always false; follow the URL under its source terms;
- `checkedAt` — time the associated SwitchBook record was last checked/updated.

Do not collapse multiple measurements: stock, break-in, retest, date, actuation count, and other distinct evidence can all be legitimate. An empty `forceCurves` array means no approved measurements. The legacy `forceCurve.available: false` conveys the same absence for older clients.

### Images and attribution

Each image includes `id`, absolute `url`, descriptive `alt`, optional dimensions/byte size/SHA-256, `revision`, `source`, optional `sourceUrl`/`license`, required `attribution`, and `updatedAt`. Hotlink only if the partner terms and returned source/license allow it; otherwise follow the agreed caching/rehosting policy. Preserve attribution near the image and link `recordUrl` or `attribution.url` as required. Do not strip creator/source/license metadata, imply ownership, or use a stale URL as identity. `thumbnail` is a convenience URL and may change.

## Caching and conditional requests

Catalog responses return:

- `Cache-Control: private, max-age=300, stale-if-error=86400`
- `ETag`
- `Last-Modified`
- `Vary: Authorization, X-API-Key`

Cache per authenticated application, never in a shared public cache. Revalidate with `If-None-Match` (preferred) or `If-Modified-Since`; `304` has no JSON body. Keep the cached body when a valid `304` arrives. Respect tombstones and record `version`/`updatedAt` after a `200` refresh.

## Errors

Errors are structured as:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid similarity query",
    "requestId": "request-id-for-support",
    "details": {}
  }
}
```

- `400` — invalid parameters/body; correct the request.
- `401` — missing, expired, revoked, or invalid credential; stop and rotate/fix configuration.
- `403` — credential lacks the required scope or OAuth account linkage; do not retry unchanged.
- `404` — no visible approved record for that identity.
- `409` — idempotency/lifecycle conflict on write-capable OAuth endpoints.
- `429` — application rate limit reached; wait until `details.resetAt`, add jitter, and do not fan out retries.
- `500` — unexpected server error; retry safe reads with bounded exponential backoff.
- `503 search_capacity_exceeded` — similarity candidate bound reached; add exact filters before retrying.

Log status, endpoint, and `requestId`, but never log authorization headers, application keys, protected key files, or full user-provided payloads.

## Minimal integration checklist

- [ ] Use the correct production or sandbox base URL and OpenAPI 1.1.0.
- [ ] Store the one-time key in a server-side secret manager; remove the protected handoff file.
- [ ] Send `X-API-Key` only over HTTPS and redact it everywhere.
- [ ] Confirm the application has only `catalog:read` and record its rate limit/expiry owner.
- [ ] Use `/catalog/switches` for unchanged substring behavior; use `/similar` only for advisory discovery.
- [ ] Require a human to confirm ambiguous similarity candidates by stable SwitchBook ID.
- [ ] Implement cursor pagination, per-credential private caching, ETag/Last-Modified revalidation, and `429` backoff.
- [ ] Handle `ACTIVE`, `MERGED`, `REMOVED`, and `NOT_FOUND` explicitly.
- [ ] Preserve all distinct force-curve measurements, units, image license/source, and attribution.
- [ ] Test rotation and revocation in the isolated environment and verify old credentials fail.
- [ ] Keep request IDs for support while excluding secrets from logs and evidence.
