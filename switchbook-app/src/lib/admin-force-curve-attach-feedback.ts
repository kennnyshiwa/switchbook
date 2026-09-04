export function forceCurveAttachErrorMessage(code?: string) {
  if (code === 'APPROVED_MASTER_REQUIRED') {
    return 'This MasterSwitch cannot be attached yet. Select an approved MasterSwitch with a manufacturer, then retry.'
  }
  if (code === 'INCOMPATIBLE_IDENTITY') return 'That MasterSwitch does not exactly match this catalog switch. Choose a compatible result.'
  if (code === 'REVIEW_CANDIDATE_REQUIRED') return 'This card does not contain a complete attachable source-review group. Review its evidence and select the exact catalog candidate.'
  if (code === 'INCOMPLETE_SOURCE_GROUP') return 'This source group is incomplete or changed. Refresh this card, verify every open evidence row is present, then retry.'
  return code || 'Link failed'
}

export function forceCurveReviewFailureStatus(message: string) {
  const conflicts = ['ATTACHED_REVIEW_IMMUTABLE','ATTACH_REPLAY_MISMATCH','INCOMPLETE_SOURCE_GROUP','REVIEW_ALREADY_LINKED','INCOMPATIBLE_IDENTITY','AMBIGUOUS_REVIEW_IDENTITY','CONFLICTING_OPEN_REVIEW','CONFLICTING_APPROVED_MAPPING','LINKED_MASTER_REQUIRED']
  const notFound = ['OPEN_SOURCE_REVIEW_REQUIRED','OPEN_REVIEW_REQUIRED']
  return conflicts.includes(message) ? 409 : notFound.includes(message) ? 404 : 400
}
