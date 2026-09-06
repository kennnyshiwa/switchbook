# Builder rework evidence — admin integrations

Workboard: `6af60dc6-ec0d-48f2-a1fc-52deccce7f58`
Parent candidate: `976cac906e95500aa84fab572d0d3c80a99212af`

## Release blockers repaired

- The create form element is captured before the asynchronous mutation, so the
  successful one-time reveal resets the stable form and completes the metadata
  refresh without dereferencing React's cleared event target.
- Credential rendering now agrees with server authentication: revoked, expired,
  and active are distinct; expired/revoked credentials expose no revoke action.
- The populated credential table is contained in an accessible, keyboard-focusable
  horizontal scroll region. Synthetic 390×844 browser evidence measured body and
  viewport widths at exactly 390 px.
- Anonymous middleware denial remains HTTP 401 and now supplies `Cache-Control:
  no-store, private` plus `Pragma: no-cache`. Route-level ADMIN and same-origin
  enforcement are unchanged.

## Verification

```text
Focused tests: 8/8 PASS
Full tests: 142/142 PASS
TypeScript: PASS
Lint: PASS (26 pre-existing warnings, zero errors)
Production build: PASS (86 pages; integration page + 3 routes present)
Anonymous built API: 401 + no-store/private + no-cache PASS
Synthetic browser: 4/4 scenarios PASS at 390×844 and 1440×900
Populated mobile width: body=390, viewport=390
Create refresh: second GET observed; no client error
Expired credential: Expired, no action
One-time secret: absent from URL/request body after reveal; cleared on dismissal
```

The browser harness used intercepted synthetic metadata and a non-secret placeholder.
No real application, credential, OAuth client, database, or production endpoint was
mutated.

## Rollback

Revert the rework commit only. The parent candidate remains hash-only and
catalog-only. No schema or data rollback is required.
