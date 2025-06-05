import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sourceId, targetId } = body

    if (!sourceId || !targetId || sourceId === targetId) {
      return NextResponse.json(
        { error: "Invalid merge parameters" },
        { status: 400 }
      )
    }

    // Get both manufacturers
    const [source, target] = await Promise.all([
      prisma.manufacturer.findUnique({ where: { id: sourceId } }),
      prisma.manufacturer.findUnique({ where: { id: targetId } })
    ])

    if (!source || !target) {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 }
      )
    }

    // Update all switches with source manufacturer to use target
    await prisma.switch.updateMany({
      where: {
        manufacturer: {
          equals: source.name,
          mode: 'insensitive'
        }
      },
      data: {
        manufacturer: target.name
      }
    })

    // Merge aliases
    const mergedAliases = Array.from(new Set([
      ...target.aliases,
      ...source.aliases,
      source.name.toLowerCase()
    ]))

    // Update target manufacturer with merged aliases
    await prisma.manufacturer.update({
      where: { id: targetId },
      data: {
        aliases: mergedAliases,
        verified: true // Merged manufacturer should be verified
      }
    })

    // Delete source manufacturer
    await prisma.manufacturer.delete({
      where: { id: sourceId }
    })

    return NextResponse.json({ 
      success: true,
      message: `Merged ${source.name} into ${target.name}`
    })
  } catch (error) {
    console.error('Failed to merge manufacturers:', error)
    return NextResponse.json(
      { error: "Failed to merge manufacturers" },
      { status: 500 }
    )
  }
}