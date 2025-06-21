import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ switches: [] })
    }

    // Search for approved master switches by name
    const masterSwitches = await prisma.masterSwitch.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            chineseName: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        chineseName: true,
        manufacturer: true,
        type: true,
        technology: true,
        actuationForce: true,
        bottomOutForce: true,
        preTravel: true,
        bottomOut: true,
        springWeight: true,
        springLength: true,
        topHousing: true,
        bottomHousing: true,
        stem: true,
        magnetOrientation: true,
        magnetPosition: true,
        magnetPolarity: true,
        initialForce: true,
        initialMagneticFlux: true,
        bottomOutMagneticFlux: true,
        pcbThickness: true,
        compatibility: true,
        notes: true
      },
      take: 10, // Limit results
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ switches: masterSwitches })

  } catch (error) {
    console.error('Error searching master switches:', error)
    return NextResponse.json(
      { error: 'Failed to search master switches' },
      { status: 500 }
    )
  }
}