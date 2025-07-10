import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all switches for the user
    const switches = await prisma.switch.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        personalTags: true
      }
    })

    // Extract all unique tags
    const allTags = new Set<string>()
    switches.forEach(switchItem => {
      if (switchItem.personalTags && Array.isArray(switchItem.personalTags)) {
        switchItem.personalTags.forEach(tag => allTags.add(tag))
      }
    })

    // Convert to sorted array
    const uniqueTags = Array.from(allTags).sort()

    return NextResponse.json({ tags: uniqueTags })
  } catch (error) {
    console.error('Error fetching user tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}