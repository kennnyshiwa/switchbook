import { prisma } from '@/lib/prisma'
export type CurveFeedbackInput = { userId:string; masterSwitchId?:string|null; catalogEntryId?:string|null; switchName:string; manufacturer?:string|null; incorrectMatch:string; feedbackType:string; suggestedMatch?:string|null; notes?:string|null }
export async function recordForceCurveFeedback(input: CurveFeedbackInput) {
  const resolvedMaster = input.masterSwitchId ? await prisma.masterSwitch.findUnique({ where: { id: input.masterSwitchId } }) : await prisma.masterSwitch.findFirst({ where: { name: input.switchName, manufacturer: input.manufacturer || null, status: 'APPROVED' } })
  const resolvedCatalog = input.catalogEntryId ? await prisma.forceCurveCatalogEntry.findUnique({ where: { id: input.catalogEntryId, exists: true } }) : await prisma.forceCurveCatalogEntry.findFirst({ where: { exists: true, OR: [{ repositoryPath: input.incorrectMatch }, { displayName: input.incorrectMatch }] } })
  if (input.masterSwitchId && !resolvedMaster || input.catalogEntryId && !resolvedCatalog) throw new Error('Invalid canonical identity')
  return prisma.$transaction(async tx => {
    const review = await tx.forceCurveReviewCase.create({ data: { masterSwitchId: resolvedMaster?.id || null, catalogEntryId: resolvedCatalog?.id || null, kind: 'FEEDBACK', reason: `${input.feedbackType}: ${input.notes || input.incorrectMatch}`, payload: { switchName: input.switchName, manufacturer: input.manufacturer, suggestedMatch: input.suggestedMatch, candidateIds: resolvedCatalog ? [resolvedCatalog.id] : [] } } })
    const feedback = await tx.forceCurveFeedback.create({ data: { userId: input.userId, switchName: input.switchName, manufacturer: input.manufacturer || null, incorrectMatch: input.incorrectMatch, feedbackType: input.feedbackType, suggestedMatch: input.suggestedMatch || null, notes: input.notes || null, masterSwitchId: resolvedMaster?.id || null, catalogEntryId: resolvedCatalog?.id || null, reviewCaseId: review.id } })
    if (resolvedMaster) await tx.forceCurveMapping.updateMany({ where: { masterSwitchId: resolvedMaster.id, state: 'AUTO_APPROVED', ...(resolvedCatalog ? { catalogEntryId: resolvedCatalog.id } : {}) }, data: { state: 'REVIEW_REQUIRED', reason: `User feedback: ${input.feedbackType}` } })
    return feedback
  })
}
