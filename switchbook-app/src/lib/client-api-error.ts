type ApiErrorBody = {
  error?: string | { message?: string }
  message?: string
}

export function apiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const value = body as ApiErrorBody
  if (typeof value.error === 'string' && value.error.trim()) return value.error
  if (value.error && typeof value.error === 'object' && typeof value.error.message === 'string' && value.error.message.trim()) return value.error.message
  if (typeof value.message === 'string' && value.message.trim()) return value.message
  return fallback
}

export async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return apiErrorMessage(body, fallback)
}
