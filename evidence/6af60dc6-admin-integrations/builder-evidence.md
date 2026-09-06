# Builder evidence — admin integration API keys

Candidate parent: `9d606c48a848e267fde909a99c7b5422a8ea2df5`

## Delivered

- ADMIN-only `/admin/integrations` management surface with responsive loading, empty, error, confirmation, metadata, audit, one-time reveal, and copy states.
- Metadata-only admin list endpoint plus same-origin protected create, rotate, and exact revoke endpoints.
- New applications are fixed to `catalog:read`, empty redirects, no webhook, no webhook envelope, and no Hydra/OAuth integration.
- Application and credential material are generated independently; only SHA-256 hashes persist. The raw application key exists only in the successful create/rotate mutation response.
- Rotation requires the caller to explicitly choose overlap or atomic revocation of prior active keys. Exact credential revocation is immediate and concurrency-safe.
- Audit events record actor, action, application/credential target, timestamp, non-secret prefix, expiry/rate/rotation metadata, and never the raw key or hash.
- Every response is `Cache-Control: no-store, private` with `Pragma: no-cache`; error projection is allowlisted and secret-independent.
- Existing catalog CLI and OAuth code paths are unchanged.

## Verification

- Focused tests: **7/7 passed** (`tsx --test tests/admin-integrations.test.ts`).
- Full suite after adding the focused coverage: **141/141 passed** (`npm test`).
- Typecheck: passed (`tsc --noEmit`).
- Lint: passed, with only pre-existing warnings (`npm run lint`).
- Production build: passed (`npm run build`), including the new page and three API routes.
- Diff hygiene: passed (`git diff --check`).
- Secret scan: changed tracked diff passed with no leaks. Repository-history scan reports one pre-existing finding outside this change.
- Browser acceptance specification added at `tests/admin-integrations.browser.ts`; not executed because this isolated Builder lane has no authenticated disposable runtime and must not mutate real credentials.

## Safety

No push, deployment, production access, database write, application creation, credential issuance, OAuth/Hydra change, or real key material occurred. The primary checkout was not modified. Its existing `node_modules` was referenced through an ignored worktree symlink for local verification only.
