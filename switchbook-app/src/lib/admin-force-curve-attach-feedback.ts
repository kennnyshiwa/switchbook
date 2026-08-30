export function forceCurveAttachErrorMessage(code?: string) {
  if (code === 'APPROVED_MASTER_REQUIRED') {
    return 'This MasterSwitch cannot be attached yet because its approved record is missing manufacturer or technology. Complete the MasterSwitch metadata, then retry.'
  }
  if (code === 'INCOMPATIBLE_IDENTITY') return 'That MasterSwitch does not exactly match this catalog switch. Choose a compatible result.'
  if (code === 'REVIEW_CANDIDATE_REQUIRED') return 'The source evidence changed while this page was open. Refresh the queue, search again, and select the exact MasterSwitch.'
  return code || 'Link failed'
}
