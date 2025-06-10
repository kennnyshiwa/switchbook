import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { switchName, manufacturer, incorrectMatch, feedbackType, suggestedMatch, notes } = await request.json()
    
    if (!switchName || !incorrectMatch || !feedbackType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate feedback type
    const validFeedbackTypes = ['incorrect_match', 'no_match_found', 'suggest_match']
    if (!validFeedbackTypes.includes(feedbackType)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    // Create feedback entry
    const feedback = await prisma.forceCurveFeedback.create({
      data: {
        userId: session.user.id,
        switchName,
        manufacturer: manufacturer || null,
        incorrectMatch,
        feedbackType,
        suggestedMatch: suggestedMatch || null,
        notes: notes || null
      }
    })

    // If this is an incorrect match, we should also invalidate the cache for this switch
    // so it gets re-checked with potentially improved matching
    if (feedbackType === 'incorrect_match') {
      await prisma.forceCurveCache.deleteMany({
        where: {
          switchName,
          manufacturer: manufacturer || null
        }
      })
    }

    return NextResponse.json({ success: true, feedbackId: feedback.id })
  } catch (error) {
    console.error('Error saving force curve feedback:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    // Only admins can view all feedback
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const switchName = searchParams.get('switchName')
    const manufacturer = searchParams.get('manufacturer')

    let where = {}
    if (switchName) {
      where = {
        switchName,
        manufacturer: manufacturer || null
      }
    }

    const feedback = await prisma.forceCurveFeedback.findMany({
      where,
      include: {
        user: {
          select: {
            username: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to recent 100 entries
    })

    return NextResponse.json(feedback)
  } catch (error) {
    console.error('Error fetching force curve feedback:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}