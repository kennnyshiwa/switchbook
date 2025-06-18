import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
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
  topHousing: z.string().optional(),
  bottomHousing: z.string().optional(),
  stem: z.string().optional(),
  springWeight: z.string().optional(),
  springLength: z.string().optional(),
  compatibility: z.string().optional(),
  magnetOrientation: z.string().optional(),
  magnetPosition: z.string().optional(),
  magnetPolarity: z.string().optional(),
  pcbThickness: z.string().optional(),
  actuationForceMin: z.string().optional().transform(val => val ? Number(val) : undefined),
  actuationForceMax: z.string().optional().transform(val => val ? Number(val) : undefined),
  bottomOutForceMin: z.string().optional().transform(val => val ? Number(val) : undefined),
  bottomOutForceMax: z.string().optional().transform(val => val ? Number(val) : undefined),
  preTravelMin: z.string().optional().transform(val => val ? Number(val) : undefined),
  preTravelMax: z.string().optional().transform(val => val ? Number(val) : undefined),
  bottomOutMin: z.string().optional().transform(val => val ? Number(val) : undefined),
  bottomOutMax: z.string().optional().transform(val => val ? Number(val) : undefined),
  initialForceMin: z.string().optional().transform(val => val ? Number(val) : undefined),
  initialForceMax: z.string().optional().transform(val => val ? Number(val) : undefined),
  initialMagneticFluxMin: z.string().optional().transform(val => val ? Number(val) : undefined),
  initialMagneticFluxMax: z.string().optional().transform(val => val ? Number(val) : undefined),
  bottomOutMagneticFluxMin: z.string().optional().transform(val => val ? Number(val) : undefined),
  bottomOutMagneticFluxMax: z.string().optional().transform(val => val ? Number(val) : undefined),
  sort: z.enum(['name', 'viewCount', 'createdAt']).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
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
      topHousing,
      bottomHousing,
      stem,
      springWeight,
      springLength,
      compatibility,
      magnetOrientation,
      magnetPosition,
      magnetPolarity,
      pcbThickness,
      actuationForceMin,
      actuationForceMax,
      bottomOutForceMin,
      bottomOutForceMax,
      preTravelMin,
      preTravelMax,
      bottomOutMin,
      bottomOutMax,
      initialForceMin,
      initialForceMax,
      initialMagneticFluxMin,
      initialMagneticFluxMax,
      bottomOutMagneticFluxMin,
      bottomOutMagneticFluxMax,
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
      ...(topHousing && { topHousing: { contains: topHousing, mode: 'insensitive' } }),
      ...(bottomHousing && { bottomHousing: { contains: bottomHousing, mode: 'insensitive' } }),
      ...(stem && { stem: { contains: stem, mode: 'insensitive' } }),
      ...(springWeight && { springWeight: { contains: springWeight, mode: 'insensitive' } }),
      ...(springLength && { springLength: { contains: springLength, mode: 'insensitive' } }),
      ...(compatibility && { compatibility: { contains: compatibility, mode: 'insensitive' } }),
      ...(magnetOrientation && { magnetOrientation: { contains: magnetOrientation, mode: 'insensitive' } }),
      ...(magnetPosition && { magnetPosition: { contains: magnetPosition, mode: 'insensitive' } }),
      ...(magnetPolarity && { magnetPolarity: { contains: magnetPolarity, mode: 'insensitive' } }),
      ...(pcbThickness && { pcbThickness: { contains: pcbThickness, mode: 'insensitive' } }),
      // Force ranges
      ...((actuationForceMin !== undefined || actuationForceMax !== undefined) && {
        actuationForce: {
          ...(actuationForceMin !== undefined && { gte: actuationForceMin }),
          ...(actuationForceMax !== undefined && { lte: actuationForceMax }),
        }
      }),
      ...((bottomOutForceMin !== undefined || bottomOutForceMax !== undefined) && {
        bottomOutForce: {
          ...(bottomOutForceMin !== undefined && { gte: bottomOutForceMin }),
          ...(bottomOutForceMax !== undefined && { lte: bottomOutForceMax }),
        }
      }),
      ...((preTravelMin !== undefined || preTravelMax !== undefined) && {
        preTravel: {
          ...(preTravelMin !== undefined && { gte: preTravelMin }),
          ...(preTravelMax !== undefined && { lte: preTravelMax }),
        }
      }),
      ...((bottomOutMin !== undefined || bottomOutMax !== undefined) && {
        bottomOut: {
          ...(bottomOutMin !== undefined && { gte: bottomOutMin }),
          ...(bottomOutMax !== undefined && { lte: bottomOutMax }),
        }
      }),
      ...((initialForceMin !== undefined || initialForceMax !== undefined) && {
        initialForce: {
          ...(initialForceMin !== undefined && { gte: initialForceMin }),
          ...(initialForceMax !== undefined && { lte: initialForceMax }),
        }
      }),
      ...((initialMagneticFluxMin !== undefined || initialMagneticFluxMax !== undefined) && {
        initialMagneticFlux: {
          ...(initialMagneticFluxMin !== undefined && { gte: initialMagneticFluxMin }),
          ...(initialMagneticFluxMax !== undefined && { lte: initialMagneticFluxMax }),
        }
      }),
      ...((bottomOutMagneticFluxMin !== undefined || bottomOutMagneticFluxMax !== undefined) && {
        bottomOutMagneticFlux: {
          ...(bottomOutMagneticFluxMin !== undefined && { gte: bottomOutMagneticFluxMin }),
          ...(bottomOutMagneticFluxMax !== undefined && { lte: bottomOutMagneticFluxMax }),
        }
      }),
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