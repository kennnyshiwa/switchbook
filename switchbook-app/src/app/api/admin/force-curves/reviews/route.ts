import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adminActor, isSameOriginMutation, linkSourceReview, resolveForceCurveReview, verifyReviewMetadata } from '@/lib/admin-force-curves'

const linkSchema = z.object({ reviewId: z.string().cuid(), masterSwitchId: z.string().cuid(), catalogEntryId: z.string().cuid() }).strict()
const verifySchema = z.object({ reviewId: z.string().cuid(), catalogEntryId: z.string().cuid(), manufacturer: z.string().trim().min(1).max(120), technology: z.enum(['MECHANICAL','OPTICAL','MAGNETIC','INDUCTIVE','ELECTRO_CAPACITIVE']) }).strict()
const resolutionSchema = z.object({ reviewId: z.string().cuid(), resolution: z.enum(['MANUALLY_APPROVED','REJECTED','NO_MATCH']), catalogEntryId: z.string().cuid().optional(), reason: z.string().trim().max(1000).optional() }).strict()
const ids = (payload: unknown) => typeof payload === 'object' && payload && Array.isArray((payload as { candidateIds?: unknown }).candidateIds) ? (payload as { candidateIds: string[] }).candidateIds : []

async function actor() { return adminActor(await auth()) }
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'INVALID_REVIEW_OPERATION'
  const conflicts = ['REVIEW_ALREADY_LINKED','INCOMPATIBLE_IDENTITY','AMBIGUOUS_REVIEW_IDENTITY','CONFLICTING_OPEN_REVIEW','LINKED_MASTER_REQUIRED']
  const notFound = ['OPEN_SOURCE_REVIEW_REQUIRED','OPEN_REVIEW_REQUIRED']
  return NextResponse.json({ error: message }, { status: conflicts.includes(message) ? 409 : notFound.includes(message) ? 404 : 400 })
}
async function mutationAccess(request: NextRequest) {
  const actorId = await actor()
  if (!actorId) return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  if (!isSameOriginMutation(request)) return { response: NextResponse.json({ error: 'Same-origin request required' }, { status: 403 }) }
  return { actorId }
}

export async function GET() {
  if (!await actor()) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const reviews = await prisma.forceCurveReviewCase.findMany({ where: { status: 'OPEN' }, include: { masterSwitch: { select: { id: true, name: true, manufacturer: true, technology: true } }, catalogEntry: true, feedback: true }, orderBy: { createdAt: 'asc' } })
  const allIds = [...new Set(reviews.flatMap(r => [...ids(r.payload), ...(r.catalogEntryId ? [r.catalogEntryId] : [])]))]
  const candidates = await prisma.forceCurveCatalogEntry.findMany({ where: { id: { in: allIds }, exists: true } })
  return NextResponse.json(reviews.map(r => ({ ...r, candidates: candidates.filter(c => ids(r.payload).includes(c.id) || r.catalogEntryId === c.id) })))
}

export async function PUT(request: NextRequest) {
  const access = await mutationAccess(request); if ('response' in access) return access.response
  const parsed = linkSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid link request' }, { status: 400 })
  try { return NextResponse.json(await linkSourceReview({ ...parsed.data, actorId: access.actorId }, prisma)) } catch (error) { return failure(error) }
}

export async function PATCH(request: NextRequest) {
  const access = await mutationAccess(request); if ('response' in access) return access.response
  const parsed = verifySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid metadata verification request' }, { status: 400 })
  try { return NextResponse.json(await verifyReviewMetadata({ ...parsed.data, actorId: access.actorId }, prisma)) } catch (error) { return failure(error) }
}

export async function POST(request: NextRequest) {
  const access = await mutationAccess(request); if ('response' in access) return access.response
  const parsed = resolutionSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid resolution request' }, { status: 400 })
  try { return NextResponse.json(await resolveForceCurveReview({ ...parsed.data, actorId: access.actorId }, prisma)) } catch (error) { return failure(error) }
}
