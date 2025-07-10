import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const verified = searchParams.get('verified')

    const manufacturers = await prisma.manufacturer.findMany({
      where: verified !== null ? { verified: verified === 'true' } : undefined,
      include: {
        user: {
          select: { username: true }
        }
      },
      orderBy: [
        { verified: 'asc' }, // Unverified first
        { createdAt: 'desc' }
      ]
    })

    // Get usage count for each manufacturer
    const manufacturersWithCount = await Promise.all(
      manufacturers.map(async (manufacturer) => {
        const count = await prisma.switch.count({
          where: {
            manufacturer: {
              equals: manufacturer.name,
              mode: 'insensitive'
            }
          }
        })
        return { ...manufacturer, usageCount: count }
      })
    )

    return NextResponse.json(manufacturersWithCount)
  } catch (error) {
    // Failed to fetch manufacturers
    return NextResponse.json(
      { error: "Failed to fetch manufacturers" },
      { status: 500 }
    )
  }
}