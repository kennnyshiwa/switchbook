import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Allowed domains for force curve URLs to prevent SSRF
const ALLOWED_DOMAINS = [
  'raw.githubusercontent.com',
  'github.com',
  'api.github.com'
]

const PreferenceSchema = z.object({
  switchName: z.string().min(1),
  manufacturer: z.string().nullable().optional(),
  selectedFolder: z.string().min(1),
  selectedUrl: z.string().url().refine((url) => {
    try {
      const urlObj = new URL(url)
      return ALLOWED_DOMAINS.includes(urlObj.hostname)
    } catch {
      return false
    }
  }, {
    message: "URL must be from an allowed domain (GitHub only)"
  }),
})

export async function POST(request: NextRequest) {
  let session: any = null
  let validatedData: any = null
  
  try {
    session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    validatedData = PreferenceSchema.parse(body)

    const whereClause = {
      userId: session.user.id,
      switchName: validatedData.switchName,
      manufacturer: validatedData.manufacturer || null,
    }

    // Check if preference already exists
    const existing = await prisma.forceCurvePreference.findFirst({
      where: whereClause
    })

    let preference
    if (existing) {
      // Update existing preference
      preference = await prisma.forceCurvePreference.update({
        where: { id: existing.id },
        data: {
          selectedFolder: validatedData.selectedFolder,
          selectedUrl: validatedData.selectedUrl,
        }
      })
    } else {
      // Create new preference
      preference = await prisma.forceCurvePreference.create({
        data: {
          ...whereClause,
          selectedFolder: validatedData.selectedFolder,
          selectedUrl: validatedData.selectedUrl,
        }
      })
    }

    return NextResponse.json(preference)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors)
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Error saving force curve preference:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      whereClause: {
        userId: session?.user?.id,
        switchName: validatedData?.switchName,
        manufacturer: validatedData?.manufacturer || null,
      }
    })
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const switchName = searchParams.get('switchName')
    const manufacturer = searchParams.get('manufacturer')

    if (!switchName) {
      return NextResponse.json({ error: 'switchName is required' }, { status: 400 })
    }

    const preference = await prisma.forceCurvePreference.findFirst({
      where: {
        userId: session.user.id,
        switchName,
        manufacturer: manufacturer || null,
      },
    })

    return NextResponse.json(preference)
  } catch (error) {
    console.error('Error fetching force curve preference:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}