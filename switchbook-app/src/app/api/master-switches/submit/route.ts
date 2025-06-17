import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema for master switch submission
const submissionSchema = z.object({
  name: z.string().min(1),
  chineseName: z.string().optional().nullable(),
  manufacturer: z.string().min(1),
  brand: z.string().optional().nullable(),
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE']).optional().nullable(),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional().nullable(),
  compatibility: z.string().optional().nullable(),
  
  // Force specifications
  actuationForce: z.number().optional().nullable(),
  bottomOutForce: z.number().optional().nullable(),
  preTravel: z.number().optional().nullable(),
  totalTravel: z.number().optional().nullable(),
  
  // Spring specifications
  springType: z.string().optional().nullable(),
  springForce: z.string().optional().nullable(),
  springMaterialType: z.string().optional().nullable(),
  springLength: z.string().optional().nullable(),
  
  // Materials
  topHousingMaterial: z.string().optional().nullable(),
  bottomHousingMaterial: z.string().optional().nullable(),
  stemMaterial: z.string().optional().nullable(),
  stemColor: z.string().optional().nullable(),
  
  // Magnetic specifications
  magneticActuationPoint: z.number().optional().nullable(),
  magneticBottomOut: z.number().optional().nullable(),
  magneticInitialPosition: z.number().optional().nullable(),
  
  // Additional info
  preLubed: z.boolean().optional().nullable(),
  releaseYear: z.number().optional().nullable(),
  lifespan: z.string().optional().nullable(),
  productUrl: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  
  // Submission details
  submissionNotes: z.string().min(10),
})

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await req.json()
    const validated = submissionSchema.parse(body)

    // Check for duplicates by name and manufacturer
    const existing = await prisma.masterSwitch.findFirst({
      where: {
        name: {
          equals: validated.name,
          mode: 'insensitive'
        },
        manufacturer: {
          equals: validated.manufacturer,
          mode: 'insensitive'
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { 
          error: 'A master switch with this name and manufacturer already exists',
          existingId: existing.id 
        }, 
        { status: 400 }
      )
    }

    // Create the master switch submission with PENDING status
    const masterSwitch = await prisma.masterSwitch.create({
      data: {
        name: validated.name,
        chineseName: validated.chineseName || null,
        manufacturer: validated.manufacturer,
        type: validated.type || null,
        technology: validated.technology || null,
        compatibility: validated.compatibility || null,
        actuationForce: validated.actuationForce || null,
        bottomOutForce: validated.bottomOutForce || null,
        preTravel: validated.preTravel || null,
        bottomOut: validated.totalTravel || null,
        springWeight: validated.springForce || null,
        springLength: validated.springLength || null,
        topHousing: validated.topHousingMaterial || null,
        bottomHousing: validated.bottomHousingMaterial || null,
        stem: validated.stemMaterial || null,
        notes: validated.notes || null,
        imageUrl: validated.imageUrl || null,
        status: 'PENDING',
        submittedById: session.user.id,
        // Store the full submission data for audit purposes
        originalSubmissionData: validated,
      },
      select: {
        id: true,
        name: true,
        manufacturer: true,
        status: true
      }
    })

    // TODO: Send notification email to admins about new submission

    return NextResponse.json({
      id: masterSwitch.id,
      message: 'Master switch submitted successfully and is pending review',
      status: masterSwitch.status
    })

  } catch (error) {
    console.error('Master switch submission error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid submission data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit master switch' },
      { status: 500 }
    )
  }
}