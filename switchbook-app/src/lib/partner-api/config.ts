export const PARTNER_SCOPES = [
  'catalog:read',
  'profile:read',
  'submissions:write',
  'submissions:read',
  'corrections:write',
] as const

export type PartnerScope = (typeof PARTNER_SCOPES)[number]

export const apiOrigin = () =>
  (process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || 'https://switchbook.app').replace(/\/$/, '')

export const switchesDbSearchUrl = (name: string, manufacturer?: string | null) => {
  const query = [manufacturer, name].filter(Boolean).join(' ')
  return `https://switchesdb.switchbook.app/?search=${encodeURIComponent(query)}`
}
