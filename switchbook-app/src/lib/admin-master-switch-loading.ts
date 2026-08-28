export type AdminMasterSwitchFilter = 'all' | 'pending' | 'approved' | 'rejected'

export async function loadAdminMasterSwitchData(filter: AdminMasterSwitchFilter, fetcher: typeof fetch = fetch) {
  const [submissionsResponse, editsResponse] = await Promise.all([
    fetcher(`/api/admin/master-switches?status=${filter}`),
    fetcher(`/api/admin/master-switch-edits?status=${filter}`),
  ])
  return {
    submissions: submissionsResponse.ok ? await submissionsResponse.json() : [],
    edits: editsResponse.ok ? await editsResponse.json() : [],
  }
}
