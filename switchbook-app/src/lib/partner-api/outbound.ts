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
