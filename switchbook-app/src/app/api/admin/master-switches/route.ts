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

    const submissions = await prisma.masterSwitch.findMany({
      where,
      select: {
        id: true,
        name: true,
        manufacturer: true,
        type: true,
        status: true,
        createdAt: true,
        originalSubmissionData: true,
        submittedBy: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100,
    })

    return NextResponse.json(submissions)
  } catch (error) {
    console.error('Error fetching master switch submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
