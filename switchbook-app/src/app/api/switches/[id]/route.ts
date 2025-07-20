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

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id } = await params
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const switchItem = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!switchItem) {
      return NextResponse.json(
        { error: "Switch not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(switchItem)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch switch" },
      { status: 500 }
    )
  }
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
        'topHousingColor', 'bottomHousingColor', 'stemColor', 'stemShape', 'markings',
        'magnetOrientation', 'magnetPosition', 'magnetPolarity',
        'initialForce', 'initialMagneticFlux', 'bottomOutMagneticFlux',
        'pcbThickness', 'compatibility', 'tactileForce',
        'progressiveSpring', 'doubleStage', 'clickType'
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
      // Create user-friendly error messages for each validation issue
      const fieldErrors = error.errors.map(err => {
        const field = err.path.join('.')
        let message = ''
        
        switch (field) {
          case 'name':
            message = 'Switch name is required'
            break
          case 'manufacturer':
            message = 'Manufacturer field cannot exceed 100 characters'
            break
          case 'notes':
            message = 'Notes cannot exceed 500 characters'
            break
          case 'personalNotes':
            message = 'Personal notes cannot exceed 500 characters'
            break
          case 'markings':
            message = 'Markings cannot exceed 500 characters'
            break
          case 'actuationForce':
          case 'bottomOutForce':
          case 'tactileForce':
            message = `${field.replace(/([A-Z])/g, ' $1').trim()} must be between 0 and 1000 grams`
            break
          case 'preTravel':
          case 'bottomOut':
          case 'tactilePosition':
            message = `${field.replace(/([A-Z])/g, ' $1').trim()} must be between 0 and 10 mm`
            break
          case 'initialMagneticFlux':
          case 'bottomOutMagneticFlux':
            message = `${field.replace(/([A-Z])/g, ' $1').trim()} must be between 0 and 10000`
            break
          case 'personalTags':
            if (err.code === 'too_big' && err.message.includes('50')) {
              message = 'Each tag cannot exceed 50 characters'
            } else {
              message = err.message
            }
            break
          default:
            // For enum fields, provide clearer messages
            if (err.code === 'invalid_enum_value') {
              message = `Invalid ${field}. Please select from the available options`
            } else {
              message = err.message
            }
        }
        
        return { field, message }
      })
      
      const errorMessage = fieldErrors.length === 1 
        ? fieldErrors[0].message
        : `Please fix the following issues: ${fieldErrors.map(e => e.message).join(', ')}`
      
      return NextResponse.json(
        { 
          error: errorMessage,
          fieldErrors,
          details: error.errors 
        },
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