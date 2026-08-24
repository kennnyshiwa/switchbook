import { Prisma } from '@prisma/client'

export type MasterSwitchSort = 'name' | 'viewCount' | 'createdAt' | 'popular' | 'userCount'

/**
 * Keep the public sort aliases independent from Prisma column names. In
 * particular, userCount is a relation aggregate rather than a database field.
 */
export function masterSwitchOrderBy(
  sort: MasterSwitchSort,
  order: Prisma.SortOrder,
): Prisma.MasterSwitchOrderByWithRelationInput[] {
  const stableId: Prisma.MasterSwitchOrderByWithRelationInput = { id: 'asc' }

  if (sort === 'userCount') {
    return [{ userSwitches: { _count: order } }, stableId]
  }

  if (sort === 'popular') {
    return [{ viewCount: order }, { userSwitches: { _count: order } }, stableId]
  }

  return [{ [sort]: order }, stableId]
}
