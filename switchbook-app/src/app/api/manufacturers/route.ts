import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase() || ''

    // If no query, return all verified manufacturers
    if (!query) {
      const manufacturers = await prisma.manufacturer.findMany({
        where: { verified: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true }
      })
      return NextResponse.json(manufacturers)
    }

    // Search manufacturers by name and aliases
    const manufacturers = await prisma.manufacturer.findMany({
      where: {
        AND: [
          { verified: true },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { aliases: { has: query } }
            ]
          }
        ]
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, aliases: true }
    })

    // Also check for exact alias matches for better results
    const exactAliasMatches = await prisma.manufacturer.findMany({
      where: {
        verified: true,
        aliases: {
          hasSome: [query, query.toLowerCase(), query.toUpperCase()]
        }
      },
      select: { id: true, name: true }
    })

    // Combine and deduplicate results
    const combinedResults = [...manufacturers, ...exactAliasMatches]
    const uniqueResults = Array.from(
      new Map(combinedResults.map(item => [item.id, item])).values()
    )

    return NextResponse.json(uniqueResults)
  } catch (error) {
    console.error('Failed to fetch manufacturers:', error)
    return NextResponse.json(
      { error: "Failed to fetch manufacturers" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: "Invalid manufacturer name" },
        { status: 400 }
      )
    }

    // Check if manufacturer already exists
    const existing = await prisma.manufacturer.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { aliases: { has: name.toLowerCase() } }
        ]
      }
    })

    if (existing) {
      return NextResponse.json(existing)
    }

    // Create new unverified manufacturer
    const manufacturer = await prisma.manufacturer.create({
      data: {
        name,
        aliases: [name.toLowerCase()],
        verified: false,
        addedBy: session.user.id
      }
    })

    return NextResponse.json(manufacturer)
  } catch (error) {
    console.error('Failed to create manufacturer:', error)
    return NextResponse.json(
      { error: "Failed to create manufacturer" },
      { status: 500 }
    )
  }
}