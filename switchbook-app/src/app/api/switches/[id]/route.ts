import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { switchSchema } from "@/lib/validation"
import { z } from "zod"
import { transformSwitchData } from "@/utils/dataTransform"
import { normalizeManufacturerName } from "@/utils/manufacturerNormalization"
import { withSmartRateLimit } from "@/lib/with-rate-limit"

interface RouteParams {
  params: Promise<{ id: string }>
}

async function updateSwitchHandler(request: NextRequest, { params }: RouteParams) {
  let body: unknown
  try {
    const session = await auth()
    const { id } = await params
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    body = await request.json()
    
    // Verify the switch belongs to the user first to get current data
    const switchItem = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!switchItem) {
      return NextResponse.json(
        { error: "Switch not found" },
        { status: 404 }
      )
    }

    // Rate limiting removed as imageUrl field is deprecated
    
    const validatedData = switchSchema.parse(body)
    
    // Transform empty strings to null for optional fields
    const transformedData = transformSwitchData(validatedData)

    // Normalize manufacturer name if provided
    if (transformedData.manufacturer) {
      transformedData.manufacturer = await normalizeManufacturerName(
        transformedData.manufacturer, 
        session.user.id
      )
    }

    // Check if this switch is linked to a master switch
    const masterSwitch = switchItem.masterSwitchId ? await prisma.masterSwitch.findUnique({
      where: { id: switchItem.masterSwitchId }
    }) : null;
    
    let isModified = false;
    let modifiedFields: string[] = [];
    
    if (masterSwitch) {
      // Track which fields are modified from the master switch
      const fieldsToCheck = [
        'name', 'chineseName', 'type', 'technology', 'manufacturer',
        'actuationForce', 'bottomOutForce', 'preTravel', 'bottomOut',
        'springWeight', 'springLength', 'notes',
        'topHousing', 'bottomHousing', 'stem',
        'magnetOrientation', 'magnetPosition', 'magnetPolarity',
        'initialForce', 'initialMagneticFlux', 'bottomOutMagneticFlux',
        'pcbThickness', 'compatibility'
      ];
      
      for (const field of fieldsToCheck) {
        const newValue = (transformedData as any)[field];
        const masterValue = (masterSwitch as any)[field];
        
        // Compare values, treating null/undefined/empty string as equivalent
        const normalize = (val: any) => val === null || val === undefined || val === '' ? null : val;
        
        if (normalize(newValue) !== normalize(masterValue)) {
          modifiedFields.push(field);
        }
      }
      
      isModified = modifiedFields.length > 0;
    }

    // Update the switch
    const updatedSwitch = await prisma.switch.update({
      where: { id },
      data: {
        ...transformedData,
        ...(switchItem.masterSwitchId ? {
          isModified,
          modifiedFields: modifiedFields
        } : {})
      },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      }
    })

    return NextResponse.json(updatedSwitch)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update switch", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const PUT = withSmartRateLimit(updateSwitchHandler)

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id } = await params
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify the switch belongs to the user
    const switchItem = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!switchItem) {
      return NextResponse.json(
        { error: "Switch not found" },
        { status: 404 }
      )
    }

    await prisma.switch.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete switch" },
      { status: 500 }
    )
  }
}