import { PartnerApiError } from './errors'

export async function assertNoMergeCycle(sourceId: string, targetId: string, nextTarget: (id: string) => Promise<string | null>) {
  if (sourceId === targetId) throw new PartnerApiError(409, 'lifecycle_cycle', 'A record cannot merge into itself')
  const seen = new Set([sourceId])
  let current: string | null = targetId
  for (let depth = 0; current && depth < 100; depth++) {
    if (seen.has(current)) throw new PartnerApiError(409, 'lifecycle_cycle', 'Merge would create a lifecycle cycle')
    seen.add(current)
    current = await nextTarget(current)
  }
  if (current) throw new PartnerApiError(409, 'lifecycle_depth_exceeded', 'Merge chain exceeds the supported depth')
}
