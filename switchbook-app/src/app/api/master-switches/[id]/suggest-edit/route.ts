import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { MasterSwitchStatus } from '@prisma/client'
import { sendAdminEditSuggestionEmail } from '@/lib/email'

// Schema for edit suggestion
const editSuggestionSchema = z.object({
  name: z.string().min(1),
  chineseName: z.string().optional().nullable(),
  manufacturer: z.string().min(1),
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE']).optional().nullable(),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional().nullable(),
  magnetOrientation: z.string().optional().nullable(),
  magnetPosition: z.string().optional().nullable(),
  magnetPolarity: z.string().optional().nullable(),
  initialForce: z.number().optional().nullable(),
  initialMagneticFlux: z.number().optional().nullable(),
  bottomOutMagneticFlux: z.number().optional().nullable(),
  pcbThickness: z.string().optional().nullable(),
  compatibility: z.string().optional().nullable(),
  springWeight: z.string().optional().nullable(),
  springLength: z.string().optional().nullable(),
  actuationForce: z.number().optional().nullable(),
  bottomOutForce: z.number().optional().nullable(),
  preTravel: z.number().optional().nullable(),
  bottomOut: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  topHousing: z.string().optional().nullable(),
  bottomHousing: z.string().optional().nullable(),
  stem: z.string().optional().nullable(),
  frankenTop: z.string().optional().nullable(),
  frankenBottom: z.string().optional().nullable(),
  frankenStem: z.string().optional().nullable(),
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
          magnetOrientation: validated.magnetOrientation,
          magnetPosition: validated.magnetPosition,
          magnetPolarity: validated.magnetPolarity,
          initialForce: validated.initialForce,
          initialMagneticFlux: validated.initialMagneticFlux,
          bottomOutMagneticFlux: validated.bottomOutMagneticFlux,
          pcbThickness: validated.pcbThickness,
          compatibility: validated.compatibility,
          springWeight: validated.springWeight,
          springLength: validated.springLength,
          actuationForce: validated.actuationForce,
          bottomOutForce: validated.bottomOutForce,
          preTravel: validated.preTravel,
          bottomOut: validated.bottomOut,
          notes: validated.notes,
          imageUrl: validated.imageUrl,
          topHousing: validated.topHousing,
          bottomHousing: validated.bottomHousing,
          stem: validated.stem,
          frankenTop: validated.frankenTop,
          frankenBottom: validated.frankenBottom,
          frankenStem: validated.frankenStem,
          editReason: validated.editReason,
        },
      },
      select: {
        id: true,
        masterSwitch: {
          select: {
            name: true,
          }
        },
        editedBy: {
          select: {
            username: true
          }
        }
      }
    })

    // Send notification emails to all admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true }
    })

    // Send emails to all admins asynchronously (don't wait for completion)
    Promise.all(
      admins.map(admin => 
        sendAdminEditSuggestionEmail(
          admin.email,
          editSuggestion.editedBy.username,
          editSuggestion.masterSwitch.name,
          id,
          editSuggestion.id
        )
      )
    ).catch(error => {
      console.error('Failed to send admin notification emails:', error)
    })

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