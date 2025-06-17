import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { MasterSwitchStatus } from '@prisma/client'

// Schema for edit suggestion
const editSuggestionSchema = z.object({
  name: z.string().min(1),
  chineseName: z.string().optional().nullable(),
  manufacturer: z.string().min(1),
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE']).optional().nullable(),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional().nullable(),
  compatibility: z.string().optional().nullable(),
  actuationForce: z.number().optional().nullable(),
  bottomOutForce: z.number().optional().nullable(),
  preTravel: z.number().optional().nullable(),
  totalTravel: z.number().optional().nullable(),
  springForce: z.string().optional().nullable(),
  springLength: z.string().optional().nullable(),
  topHousingMaterial: z.string().optional().nullable(),
  bottomHousingMaterial: z.string().optional().nullable(),
  stemMaterial: z.string().optional().nullable(),
  stemColor: z.string().optional().nullable(),
  preLubed: z.boolean().optional().nullable(),
  releaseYear: z.number().optional().nullable(),
  lifespan: z.string().optional().nullable(),
  productUrl: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  editReason: z.string().min(10),
  changedFields: z.array(z.string()).min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const validated = editSuggestionSchema.parse(body)

    // Check if master switch exists and is approved
    const masterSwitch = await prisma.masterSwitch.findUnique({
      where: { id },
      select: {
        status: true,
        name: true,
        version: true,
      }
    })

    if (!masterSwitch) {
      return NextResponse.json(
        { error: 'Master switch not found' },
        { status: 404 }
      )
    }

    if (masterSwitch.status !== MasterSwitchStatus.APPROVED) {
      return NextResponse.json(
        { error: 'Can only suggest edits for approved switches' },
        { status: 400 }
      )
    }

    // Get current data for previousData field
    const currentData = await prisma.masterSwitch.findUnique({
      where: { id },
    });

    if (!currentData) {
      return NextResponse.json(
        { error: 'Master switch not found' },
        { status: 404 }
      )
    }

    // Create the edit suggestion
    const editSuggestion = await prisma.masterSwitchEdit.create({
      data: {
        masterSwitchId: id,
        editedById: session.user.id,
        previousData: currentData as any,
        changedFields: validated.changedFields,
        // Store the proposed changes in newData
        newData: {
          name: validated.name,
          chineseName: validated.chineseName,
          manufacturer: validated.manufacturer,
          type: validated.type,
          technology: validated.technology,
          compatibility: validated.compatibility,
          actuationForce: validated.actuationForce,
          bottomOutForce: validated.bottomOutForce,
          preTravel: validated.preTravel,
          bottomOut: validated.totalTravel, // Map totalTravel to bottomOut
          springWeight: validated.springForce, // Map springForce to springWeight
          springLength: validated.springLength,
          topHousing: validated.topHousingMaterial, // Map to shorter field names
          bottomHousing: validated.bottomHousingMaterial,
          stem: validated.stemMaterial,
          notes: validated.notes,
          imageUrl: validated.imageUrl,
          // Store additional fields in the JSON
          stemColor: validated.stemColor,
          preLubed: validated.preLubed,
          releaseYear: validated.releaseYear,
          lifespan: validated.lifespan,
          productUrl: validated.productUrl,
          editReason: validated.editReason,
        },
      },
      select: {
        id: true,
        masterSwitch: {
          select: {
            name: true,
          }
        }
      }
    })

    // TODO: Send notification email to admins about new edit suggestion

    return NextResponse.json({
      id: editSuggestion.id,
      message: 'Edit suggestion submitted successfully and is pending review',
    })

  } catch (error) {
    console.error('Edit suggestion submission error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid submission data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit edit suggestion' },
      { status: 500 }
    )
  }
}