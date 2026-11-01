import { MASTER_TRACKED_SELECT } from '@/lib/master-switch-modifications'
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
        ...MASTER_TRACKED_SELECT
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