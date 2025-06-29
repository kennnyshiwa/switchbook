import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { MasterSwitchStatus } from '@prisma/client'
import { sendAdminEditSuggestionEmail } from '@/lib/email'

// Helper for optional string fields
const optionalString = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return null;
  return String(val);
}, z.string().nullable().optional());

// Schema for edit suggestion - using preprocessors to handle various input types
const editSuggestionSchema = z.object({
  name: z.preprocess((val) => {
    if (val === null || val === undefined) return '';
    return String(val);
  }, z.string().min(1, 'Name is required')),
  chineseName: optionalString,
  manufacturer: z.preprocess((val) => {
    if (val === null || val === undefined) return '';
    return String(val);
  }, z.string().min(1, 'Manufacturer is required')),
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE']).optional().nullable(),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional().nullable(),
  magnetOrientation: optionalString,
  magnetPosition: optionalString,
  magnetPolarity: optionalString,
  initialForce: z.number().optional().nullable(),
  initialMagneticFlux: z.number().optional().nullable(),
  bottomOutMagneticFlux: z.number().optional().nullable(),
  pcbThickness: optionalString,
  compatibility: optionalString,
  springWeight: optionalString,
  springLength: optionalString,
  actuationForce: z.number().optional().nullable(),
  tactileForce: z.number().optional().nullable(),
  tactilePosition: z.number().optional().nullable(),
  bottomOutForce: z.number().optional().nullable(),
  preTravel: z.number().optional().nullable(),
  bottomOut: z.number().optional().nullable(),
  notes: optionalString,
  imageUrl: z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'string' && val.trim() !== '') {
      // Validate URL format
      try {
        new URL(val);
        return val;
      } catch {
        throw new Error('Invalid URL format');
      }
    }
    return null;
  }, z.string().nullable().optional()),
  topHousing: optionalString,
  bottomHousing: optionalString,
  stem: optionalString,
  frankenTop: optionalString,
  frankenBottom: optionalString,
  frankenStem: optionalString,
  clickType: z.enum(['CLICK_LEAF', 'CLICK_BAR', 'CLICK_JACKET']).optional().nullable(),
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
    
    // Debug logging
    console.log('Received edit suggestion body:', JSON.stringify(body, null, 2))
    
    let validated;
    try {
      validated = editSuggestionSchema.parse(body);
    } catch (error) {
      console.error('Validation error:', error);
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

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
          clickType: validated.clickType,
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