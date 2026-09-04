import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adminActor, bulkApproveForceCurveReviews, deferForceCurveReviews, isSameOriginMutation, linkSourceReview, linkSourceReviewGroup, resolveForceCurveReview, resolveNoMatchGroup, verifyReviewMetadata } from '@/lib/admin-force-curves'
import { getForceCurveReviewQueuePage, invalidateForceCurveReviewQueue } from '@/lib/admin-force-curve-queue'
import { forceCurveReviewFailureStatus } from '@/lib/admin-force-curve-attach-feedback'

const linkSchema = z.object({ reviewId: z.string().cuid(), masterSwitchId: z.string().cuid(), catalogEntryId: z.string().cuid() }).strict()
const compatibilityOverrideSchema=z.object({acknowledged:z.literal(true),reason:z.string().trim().min(3).max(1000)}).strict()
const groupLinkSchema = z.object({ reviewIds:z.array(z.string().cuid()).min(1).max(100),masterSwitchId:z.string().cuid(),catalogEntryId:z.string().cuid(),compatibilityOverride:compatibilityOverrideSchema.optional()}).strict()
const verifySchema = z.object({ reviewId: z.string().cuid(), catalogEntryId: z.string().cuid(), manufacturer: z.string().trim().min(1).max(120), technology: z.enum(['MECHANICAL','OPTICAL','MAGNETIC','INDUCTIVE','ELECTRO_CAPACITIVE']) }).strict()
const resolutionSchema = z.object({ reviewId: z.string().cuid(), resolution: z.enum(['MANUALLY_APPROVED','REJECTED','NO_MATCH']), catalogEntryId: z.string().cuid().optional(), reason: z.string().trim().max(1000).optional() }).strict()
const queueActionSchema = z.discriminatedUnion('action',[
  z.object({action:z.literal('DEFER'),reviewIds:z.array(z.string().cuid()).min(1).max(100),reason:z.string().trim().max(1000).optional()}).strict(),
  z.object({action:z.literal('BULK_APPROVE'),reviewIds:z.array(z.string().cuid()).min(1).max(100),catalogEntryId:z.string().cuid(),reason:z.string().trim().max(1000).optional()}).strict(),
  z.object({action:z.literal('GROUP_NO_MATCH'),reviewIds:z.array(z.string().cuid()).min(1).max(100),reason:z.string().trim().max(1000).optional()}).strict(),
])

async function actor() { return adminActor(await auth()) }
function changed(result: unknown) { invalidateForceCurveReviewQueue(prisma); return NextResponse.json(result) }
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'INVALID_REVIEW_OPERATION'
  return NextResponse.json({ error: message }, { status: forceCurveReviewFailureStatus(message) })
}
async function mutationAccess(request: NextRequest) {
  const actorId = await actor()
  if (!actorId) return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  if (!isSameOriginMutation(request)) return { response: NextResponse.json({ error: 'Same-origin request required' }, { status: 403 }) }
  return { actorId }
}

export async function GET(request: NextRequest) {
  if (!await actor()) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const page = Number(request.nextUrl.searchParams.get('page') || 1)
  const pageSize = Number(request.nextUrl.searchParams.get('pageSize') || 50)
  const query = request.nextUrl.searchParams.get('query') || ''
  const bucket = request.nextUrl.searchParams.get('bucket') || 'ALL'
  const status = request.nextUrl.searchParams.get('status') || 'OPEN'
  return NextResponse.json(await getForceCurveReviewQueuePage({ page, pageSize, query, bucket: bucket as never, status: status as never }, prisma))
}

export async function PUT(request: NextRequest) {
  const access = await mutationAccess(request); if ('response' in access) return access.response
  const body=await request.json().catch(()=>null)
  const group=groupLinkSchema.safeParse(body)
  if(group.success) try{return changed(await linkSourceReviewGroup({...group.data,actorId:access.actorId},prisma))}catch(error){return failure(error)}
  const parsed = linkSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: 'Invalid link request' }, { status: 400 })
  try { return changed(await linkSourceReview({ ...parsed.data, actorId: access.actorId }, prisma)) } catch (error) { return failure(error) }
}

export async function PATCH(request: NextRequest) {
  const access = await mutationAccess(request); if ('response' in access) return access.response
  const parsed = verifySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid metadata verification request' }, { status: 400 })
  try { return changed(await verifyReviewMetadata({ ...parsed.data, actorId: access.actorId }, prisma)) } catch (error) { return failure(error) }
}

export async function POST(request: NextRequest) {
  const access = await mutationAccess(request); if ('response' in access) return access.response
  const body=await request.json().catch(() => null)
  const queueAction=queueActionSchema.safeParse(body)
  if(queueAction.success) try {
    return changed(queueAction.data.action==='DEFER'
      ? await deferForceCurveReviews({...queueAction.data,actorId:access.actorId},prisma)
      : queueAction.data.action==='GROUP_NO_MATCH'
        ? await resolveNoMatchGroup({...queueAction.data,actorId:access.actorId},prisma)
        : await bulkApproveForceCurveReviews({...queueAction.data,actorId:access.actorId},prisma))
  } catch(error){ return failure(error) }
  const parsed = resolutionSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: 'Invalid resolution request' }, { status: 400 })
  try { return changed(await resolveForceCurveReview({ ...parsed.data, actorId: access.actorId }, prisma)) } catch (error) { return failure(error) }
}
