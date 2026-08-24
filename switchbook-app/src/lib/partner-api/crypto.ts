import { createHash, randomBytes, timingSafeEqual } from 'crypto'

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
