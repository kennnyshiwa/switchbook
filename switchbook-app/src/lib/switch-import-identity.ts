/** Names (even name + maker) never authorize overwriting an owned variant. */
export function resolveImportIdentities<T extends { id?: string; name: string; manufacturer?: string; overwrite?: boolean; importAction?: 'create' | 'overwrite' }>(rows: T[], owned: { id: string; name: string; manufacturer?: string | null }[]) {
  const ownedById = new Map(owned.map(row => [row.id, row]))
  const ownedNames = new Set(owned.map(row => row.name.toLowerCase()))
  const names = new Map<string, number>()
  const ids = new Map<string, number>()
  for (const row of rows) {
    names.set(row.name.toLowerCase(), (names.get(row.name.toLowerCase()) ?? 0) + 1)
    if (row.id) ids.set(row.id, (ids.get(row.id) ?? 0) + 1)
  }
  return rows.map(row => {
    const target = row.id ? ownedById.get(row.id) : undefined
    const repeatedId = !!row.id && (ids.get(row.id) ?? 0) > 1
    const identityChanged = !!target && (row.name !== target.name || (row.manufacturer !== undefined && row.manufacturer !== (target.manufacturer ?? '')))
    const existingId = row.importAction !== 'create' && target && !repeatedId && !identityChanged ? target.id : undefined
    const nameCollision = ownedNames.has(row.name.toLowerCase()) || (names.get(row.name.toLowerCase()) ?? 0) > 1
    const isDuplicate = !!target || repeatedId || nameCollision
    const identityMessage = repeatedId ? 'Repeated collection ID in this file: overwrite blocked. Skip or create a separate entry.'
      : identityChanged ? 'Identity changed from the exported row: overwrite blocked. Skip or create a separate entry.'
      : existingId ? 'Owned collection ID matched. Overwrite updates only supplied fields.'
      : isDuplicate ? 'Names are not unique identities. Skip or create a separate entry; export Collection Switch ID to enable overwrite.'
      : row.id ? 'Source ID is not in this account. Creates a new owned entry with a fresh ID.' : 'New entry'
    return { ...row, overwrite: row.importAction === 'overwrite' && !existingId ? false : row.overwrite, existingId, isDuplicate, identityMessage }
  })
}
