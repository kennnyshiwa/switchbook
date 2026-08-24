export type ImageOwnership = 'UPLOADED' | 'LINKED'

/** External linked images are already URL-validated at ingestion, but must not
 * be fetched by the server-side Next optimizer. SwitchBook-owned uploads keep
 * normal optimization and its responsive derivatives. */
export function bypassImageOptimizer(type: ImageOwnership) {
  return type === 'LINKED'
}
