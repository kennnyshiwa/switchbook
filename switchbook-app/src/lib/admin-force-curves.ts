import { ForceCurveMappingState, Prisma, PrismaClient, SwitchTechnology } from '@prisma/client'
import { FORCE_CURVE_SOURCE, selectAutomaticCandidates } from '@/lib/force-curves'

type Db = PrismaClient
type AdminSession = { user?: { id?: string; role?: string } } | null | undefined

const SOURCE_REVIEW_KINDS = ['SOURCE_UNVERIFIED', 'SOURCE_NONSTANDARD'] as const
const TECHNOLOGIES: SwitchTechnology[] = ['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']
const normalize = (value?: string | null) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function adminActor(session: AdminSession) {
  return session?.user?.role === 'ADMIN' && session.user.id ? session.user.id : null
}

export function isSameOriginMutation(request: { headers: { get(name: string): string | null }; nextUrl: { origin: string } }) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try { return new URL(origin).origin === request.nextUrl.origin } catch { return false }
}

export function exactCatalogMasterIdentity(master: { name: string; manufacturer: string | null }, entry: { displayName: string; repositoryPath: string }) {
  if (!master.manufacturer) return false
  const manufacturer = normalize(master.manufacturer)
  const name = normalize(master.name)
  const expected = name === manufacturer || name.startsWith(`${manufacturer} `) ? name : `${manufacturer} ${name}`
  if (normalize(entry.displayName) !== expected) return false
  const folder = entry.repositoryPath.split('/').at(-2) || ''
  return normalize(folder) === normalize(entry.displayName)
}

function objectPayload(payload: Prisma.JsonValue | null) {
  return typeof payload === 'object' && payload && !Array.isArray(payload) ? payload as Record<string, Prisma.JsonValue> : {}
}

function candidateIds(payload: Prisma.JsonValue | null) {
  const value = objectPayload(payload).candidateIds
  return Array.isArray(value) && value.every(id => typeof id === 'string') ? value as string[] : []
}

export async function linkSourceReview(input: { reviewId: string; masterSwitchId: string; catalogEntryId: string; actorId: string }, db: Db) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id = ${input.reviewId} FOR UPDATE`
    const review = await tx.forceCurveReviewCase.findUnique({ where: { id: input.reviewId } })
    if (!review || review.status !== 'OPEN' || !SOURCE_REVIEW_KINDS.includes(review.kind as typeof SOURCE_REVIEW_KINDS[number])) throw new Error('OPEN_SOURCE_REVIEW_REQUIRED')
    if (review.masterSwitchId && review.masterSwitchId !== input.masterSwitchId) throw new Error('REVIEW_ALREADY_LINKED')
    // Distinct review rows can race for the same master/catalog identity. The
    // selected master is their shared serialization point; recheck conflicts
    // only after this lock is held.
    await tx.$queryRaw`SELECT id FROM "MasterSwitch" WHERE id = ${input.masterSwitchId} FOR UPDATE`
    const [master, entries] = await Promise.all([
      tx.masterSwitch.findUnique({ where: { id: input.masterSwitchId }, select: { id: true, name: true, manufacturer: true, technology: true, status: true } }),
      tx.forceCurveCatalogEntry.findMany({ where: { id: { in: candidateIds(review.payload) }, source: FORCE_CURVE_SOURCE, exists: true } }),
    ])
    if (!master || master.status !== 'APPROVED' || !master.manufacturer || !master.technology) throw new Error('APPROVED_MASTER_REQUIRED')
    const selected = entries.find(entry => entry.id === input.catalogEntryId)
    if (!selected) throw new Error('REVIEW_CANDIDATE_REQUIRED')
    if (!exactCatalogMasterIdentity(master, selected)) throw new Error('INCOMPATIBLE_IDENTITY')
    if (entries.some(entry => !exactCatalogMasterIdentity(master, entry))) throw new Error('AMBIGUOUS_REVIEW_IDENTITY')

    const conflictingReview = await tx.forceCurveReviewCase.findFirst({ where: { id: { not: review.id }, status: 'OPEN', masterSwitchId: master.id, catalogEntryId: { in: entries.map(entry => entry.id) } } })
    if (conflictingReview) throw new Error('CONFLICTING_OPEN_REVIEW')
    const payload = objectPayload(review.payload)
    const now = new Date()
    return tx.forceCurveReviewCase.update({ where: { id: review.id }, data: {
      masterSwitchId: master.id,
      catalogEntryId: selected.id,
      payload: { ...payload, linkAudit: { actorId: input.actorId, linkedAt: now.toISOString(), source: selected.source, repositoryPath: selected.repositoryPath, revision: selected.revision, contentHash: selected.contentHash, masterSwitchId: master.id, catalogEntryId: selected.id } } as Prisma.InputJsonValue,
    } })
  })
}

export async function verifyReviewMetadata(input: { reviewId: string; catalogEntryId: string; manufacturer: string; technology: SwitchTechnology; actorId: string }, db: Db) {
  if (!input.manufacturer.trim() || !TECHNOLOGIES.includes(input.technology)) throw new Error('VERIFIED_METADATA_REQUIRED')
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id = ${input.reviewId} FOR UPDATE`
    const review = await tx.forceCurveReviewCase.findUnique({ where: { id: input.reviewId }, include: { masterSwitch: true } })
    const entry = await tx.forceCurveCatalogEntry.findUnique({ where: { id: input.catalogEntryId } })
    if (!review || review.status !== 'OPEN' || !review.masterSwitch || !entry?.exists) throw new Error('OPEN_LINKED_REVIEW_REQUIRED')
    if (!candidateIds(review.payload).includes(entry.id) || review.catalogEntryId !== entry.id) throw new Error('REVIEW_CANDIDATE_REQUIRED')
    if (normalize(input.manufacturer) !== normalize(review.masterSwitch.manufacturer) || input.technology !== review.masterSwitch.technology || !exactCatalogMasterIdentity(review.masterSwitch, entry)) throw new Error('INCOMPATIBLE_IDENTITY')
    const payload = objectPayload(review.payload)
    const now = new Date()
    await tx.forceCurveCatalogEntry.update({ where: { id: entry.id }, data: { manufacturer: input.manufacturer.trim(), technology: input.technology, metadataVerifiedAt: now, metadataVerifiedById: input.actorId } })
    return tx.forceCurveReviewCase.update({ where: { id: review.id }, data: { payload: { ...payload, metadataVerification: { catalogEntryId: entry.id, manufacturer: input.manufacturer.trim(), technology: input.technology, verifiedById: input.actorId, verifiedAt: now.toISOString() } } as Prisma.InputJsonValue } })
  })
}

export async function resolveForceCurveReview(input: { reviewId: string; resolution: Extract<ForceCurveMappingState, 'MANUALLY_APPROVED'|'REJECTED'|'NO_MATCH'>; catalogEntryId?: string; reason?: string; actorId: string }, db: Db) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id = ${input.reviewId} FOR UPDATE`
    const review = await tx.forceCurveReviewCase.findUnique({ where: { id: input.reviewId }, include: { masterSwitch: true } })
    if (!review || review.status !== 'OPEN') throw new Error('OPEN_REVIEW_REQUIRED')
    if (!review.masterSwitchId || !review.masterSwitch) throw new Error('LINKED_MASTER_REQUIRED')
    const targetId = input.catalogEntryId || review.catalogEntryId || undefined
    const candidate = targetId ? await tx.forceCurveCatalogEntry.findUnique({ where: { id: targetId } }) : null
    if (input.resolution !== 'NO_MATCH') {
      if (!candidate || !candidate.exists || !candidateIds(review.payload).includes(candidate.id)) throw new Error('REVIEW_CANDIDATE_REQUIRED')
      if (!exactCatalogMasterIdentity(review.masterSwitch, candidate)) throw new Error('INCOMPATIBLE_IDENTITY')
      if (input.resolution === 'MANUALLY_APPROVED' && !selectAutomaticCandidates(review.masterSwitch, [candidate]).length) throw new Error('INCOMPATIBLE_IDENTITY')
    }
    const now = new Date()
    const provenance = JSON.stringify({ workflow: 'admin-review', reviewId: review.id, actorId: input.actorId, decidedAt: now.toISOString(), source: candidate?.source || review.catalogEntryId && FORCE_CURVE_SOURCE, repositoryPath: candidate?.repositoryPath || null, masterSwitchId: review.masterSwitchId, catalogEntryId: candidate?.id || review.catalogEntryId })
    if (input.resolution === 'NO_MATCH') {
      await tx.forceCurveMapping.updateMany({ where: { masterSwitchId: review.masterSwitchId, state: { in: ['AUTO_APPROVED', 'MANUALLY_APPROVED'] } }, data: { state: 'STALE', reason: 'Superseded by manual no-match decision' } })
      await tx.forceCurveMapping.upsert({ where: { noMatchKey: review.masterSwitchId }, create: { masterSwitchId: review.masterSwitchId, noMatchKey: review.masterSwitchId, state: 'NO_MATCH', provenance, decidedById: input.actorId, decidedAt: now, reason: input.reason }, update: { state: 'NO_MATCH', provenance, decidedById: input.actorId, decidedAt: now, reason: input.reason } })
    } else {
      await tx.forceCurveMapping.deleteMany({ where: { noMatchKey: review.masterSwitchId } })
      await tx.forceCurveMapping.upsert({ where: { masterSwitchId_catalogEntryId: { masterSwitchId: review.masterSwitchId, catalogEntryId: candidate!.id } }, create: { masterSwitchId: review.masterSwitchId, catalogEntryId: candidate!.id, state: input.resolution, provenance, decidedById: input.actorId, decidedAt: now, reason: input.reason }, update: { state: input.resolution, provenance, decidedById: input.actorId, decidedAt: now, reason: input.reason } })
    }
    return tx.forceCurveReviewCase.update({ where: { id: review.id }, data: { status: 'RESOLVED', resolution: input.resolution, resolvedById: input.actorId, resolvedAt: now } })
  })
}
