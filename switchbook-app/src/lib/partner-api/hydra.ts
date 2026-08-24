import { PartnerApiError } from './errors'

const adminUrl = () => (process.env.HYDRA_ADMIN_URL || 'http://hydra:4445').replace(/\/$/, '')

export async function hydraAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${adminUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  })
  if (!response.ok) throw new PartnerApiError(502, 'oauth_provider_error', 'OAuth provider rejected the request')
  return response.json() as Promise<T>
}
