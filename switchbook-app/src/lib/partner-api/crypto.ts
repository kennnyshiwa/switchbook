import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto'

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

export function secureEqualHash(raw: string, expectedHash: string) {
  const actual = Buffer.from(sha256(raw), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function issuePartnerKey() {
  const prefix = `sbk_${randomBytes(6).toString('hex')}`
  const secret = randomBytes(32).toString('base64url')
  return { prefix, raw: `${prefix}.${secret}`, hash: sha256(`${prefix}.${secret}`) }
}

function envelopeKey() {
  const raw = process.env.PARTNER_SECRET_ENCRYPTION_KEY
  if (!raw) throw new Error('PARTNER_SECRET_ENCRYPTION_KEY is required')
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('PARTNER_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes')
  return key
}

export function sealSecret(secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', envelopeKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function openSecret(envelope: string) {
  const [version, iv, tag, ciphertext] = envelope.split('.')
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Unsupported secret envelope')
  const decipher = createDecipheriv('aes-256-gcm', envelopeKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')
}
