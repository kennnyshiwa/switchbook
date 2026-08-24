import { PARTNER_SCOPES } from './config'

export type HydraConsentRequest = {
  requested_scope: string[]
  requested_access_token_audience?: string[]
  client: { client_name?: string; client_id: string }
  subject: string
}

const standardScopes = ['openid', 'offline_access']

export function allowedConsentScopes(consent: HydraConsentRequest, selected: string[]) {
  return selected.filter(scope => consent.requested_scope.includes(scope) &&
    ((PARTNER_SCOPES as readonly string[]).includes(scope) || standardScopes.includes(scope)))
}

export function acceptedConsentGrant(
  consent: HydraConsentRequest,
  selectedScopes: string[],
  identity: { username?: string | null; email?: string | null },
) {
  // The audience is copied only from Hydra's trusted challenge. Form/query
  // input is intentionally not accepted here, preventing audience escalation.
  const audience = (consent.requested_access_token_audience || []).filter(value => typeof value === 'string' && value.length > 0)
  return {
    grant_scope: allowedConsentScopes(consent, selectedScopes),
    grant_access_token_audience: audience,
    remember: false,
    session: {
      id_token: { username: identity.username, email: identity.email },
      access_token: { client_id: consent.client.client_id },
    },
  }
}
