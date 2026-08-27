import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordForceCurveFeedback } from '@/lib/force-curve-feedback'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { masterSwitchId, catalogEntryId, switchName, manufacturer, incorrectMatch, feedbackType, suggestedMatch, notes } = await request.json()
    
    if (!switchName || !incorrectMatch || !feedbackType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate feedback type
    const validFeedbackTypes = ['incorrect_match', 'no_match_found', 'suggest_match']
    if (!validFeedbackTypes.includes(feedbackType)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    let feedback
    try { feedback = await recordForceCurveFeedback({ userId: session.user.id, masterSwitchId, catalogEntryId, switchName, manufacturer, incorrectMatch, feedbackType, suggestedMatch, notes }) }
    catch (error) { if (error instanceof Error && error.message === 'Invalid canonical identity') return NextResponse.json({ error: error.message }, { status: 400 }); throw error }

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
