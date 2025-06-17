import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { MasterSwitchStatus, Prisma } from '@prisma/client'

// Query params schema
const querySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number),
  search: z.string().optional(),
  manufacturer: z.string().optional(),
  type: z.string().optional(),
  technology: z.string().optional(),
  sort: z.enum(['name', 'viewCount', 'createdAt']).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())
    
    const { 
      page, 
      limit, 
      search, 
      manufacturer, 
      type, 
      technology,
      sort,
      order 
    } = querySchema.parse(params)

    // Build where clause
    const where: Prisma.MasterSwitchWhereInput = {
      status: MasterSwitchStatus.APPROVED,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { chineseName: { contains: search, mode: 'insensitive' } },
          { manufacturer: { contains: search, mode: 'insensitive' } },
        ]
      }),
      ...(manufacturer && { manufacturer: { contains: manufacturer, mode: 'insensitive' } }),
      ...(type && { type: type as any }),
      ...(technology && { technology: technology as any }),
    }

    // Get total count for pagination
    const totalCount = await prisma.masterSwitch.count({ where })

    // Get master switches with pagination
    const masterSwitches = await prisma.masterSwitch.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        submittedBy: {
          select: {
            id: true,
            username: true,
          }
        },
        _count: {
          select: {
            userSwitches: true
          }
        }
      }
    })

    // Check which master switches the user already has in their collection
    const userSwitches = await prisma.switch.findMany({
      where: {
        userId: session.user.id,
        masterSwitchId: {
          in: masterSwitches.map(ms => ms.id)
        }
      },
      select: {
        masterSwitchId: true
      }
    })

    const userSwitchIds = new Set(userSwitches.map(s => s.masterSwitchId))

    // Add "inCollection" flag to each master switch
    const enrichedSwitches = masterSwitches.map(ms => ({
      ...ms,
      inCollection: userSwitchIds.has(ms.id),
      userCount: ms._count.userSwitches
    }))

    return NextResponse.json({
      switches: enrichedSwitches,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        current: page,
        limit
      }
    })
  } catch (error) {
    console.error('Error fetching master switches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch master switches' },
      { status: 500 }
    )
  }
}