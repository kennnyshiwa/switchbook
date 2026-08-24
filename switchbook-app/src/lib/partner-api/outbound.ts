import { assertPublicImageHost } from '@/lib/image-security'
import { PartnerApiError } from './errors'

export async function assertSafeWebhookUrl(raw: string) {
  let url: URL
  try { url = new URL(raw) } catch { throw new PartnerApiError(400, 'invalid_webhook_url', 'Webhook URL is invalid') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443') {
    throw new PartnerApiError(400, 'invalid_webhook_url', 'Webhook URL must use HTTPS on port 443 without embedded credentials')
  }
  try { await assertPublicImageHost(url.toString()) } catch { throw new PartnerApiError(400, 'invalid_webhook_url', 'Webhook URL must resolve only to public addresses') }
  return url.toString()
}

export async function drainLimitedResponse(response: Response, maxBytes = 64 * 1024) {
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > maxBytes) {
    await response.body?.cancel()
    throw new Error(`Webhook response exceeds ${maxBytes} bytes`)
  }
  if (!response.body) return
  const reader = response.body.getReader()
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new Error(`Webhook response exceeds ${maxBytes} bytes`)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
}
