import type { MetadataRoute } from 'next'
import { MasterSwitchStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://switchbook.app'
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/switches/browse`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/credits`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ]

  let switchRoutes: MetadataRoute.Sitemap = []

  try {
    const switches = await prisma.masterSwitch.findMany({
      where: {
        status: MasterSwitchStatus.APPROVED,
      },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    switchRoutes = switches.map((masterSwitch) => ({
      url: `${baseUrl}/switches/${masterSwitch.id}`,
      lastModified: masterSwitch.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))
  } catch (error) {
    console.error('Failed to build dynamic sitemap entries:', error)
  }

  return [...staticRoutes, ...switchRoutes]
}
