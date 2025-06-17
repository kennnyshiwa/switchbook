import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const statusFilter = searchParams.get('status') || 'all'

    const where = statusFilter === 'all' 
      ? {} 
      : { status: statusFilter.toUpperCase() as any }

    const editSuggestions = await prisma.masterSwitchEdit.findMany({
      where,
      include: {
        masterSwitch: {
          select: {
            id: true,
            name: true,
            manufacturer: true,
          }
        },
        editedBy: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        }
      },
      orderBy: {
        editedAt: 'desc'
      }
    })

    return NextResponse.json(editSuggestions)
  } catch (error) {
    console.error('Error fetching edit suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch edit suggestions' },
      { status: 500 }
    )
  }
}