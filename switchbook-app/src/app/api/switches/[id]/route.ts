import { imageImportSchema, imageReferenceCreates, primaryReferenceId } from '@/lib/switch-image-references'
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { switchSchema } from "@/lib/validation"
import { z } from "zod"
import { transformSwitchData } from "@/utils/dataTransform"
import { computeMasterModifiedFields } from "@/lib/master-switch-modifications"
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
    
    if (body && typeof body === 'object' && 'id' in body && body.id && body.id !== id) {
      return NextResponse.json({ error: 'Collection Switch ID does not match the update target' }, { status: 400 })
    }
    const imageData = imageImportSchema.parse(body)
    const referenceCreates = imageData.imageReferences === undefined ? undefined : imageReferenceCreates(imageData.imageReferences)
    const validatedData = switchSchema.partial().parse(body)
    
    // Transform empty strings to null for optional fields
    const transformedData = transformSwitchData(validatedData)

    // Check if this switch is linked to a master switch
    const masterSwitch = switchItem.masterSwitchId ? await prisma.masterSwitch.findUnique({
      where: { id: switchItem.masterSwitchId }
    }) : null;
    
    // Track which fields are modified from the master switch
    const modifiedFields: string[] = masterSwitch ? computeMasterModifiedFields({ ...switchItem, ...transformedData }, masterSwitch) : []
    const isModified = modifiedFields.length > 0

    // Update the switch
    const updatedSwitch = await prisma.$transaction(async tx => {
      if (imageData.imageReferences !== undefined) {
        // Remove only owned relations; master-attached records and media bytes
        // survive. A reference import never acquires physical-file ownership.
        await tx.switchImage.updateMany({ where: { switchId: id, masterSwitchId: { not: null } }, data: { switchId: null } })
        await tx.switchImage.deleteMany({ where: { switchId: id, masterSwitchId: null } })
      }
      const updated = await tx.switch.update({
        where: { id },
        data: {
          ...transformedData,
          ...(imageData.imageUrl !== undefined ? { imageUrl: imageData.imageUrl || null } : {}),
          ...(switchItem.masterSwitchId ? { isModified, modifiedFields } : {}),
          ...(imageData.imageReferences !== undefined ? { primaryImageId: null, images: { create: referenceCreates! } } : {}),
        },
        include: { images: { orderBy: { order: 'asc' } } }
      })
      if (!imageData.imageReferences?.length) return updated
      return tx.switch.update({ where: { id }, data: { primaryImageId: primaryReferenceId(imageData.imageReferences, referenceCreates!) },
        include: { images: { orderBy: { order: 'asc' } } } })
    })

    return NextResponse.json(updatedSwitch)
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Create user-friendly error messages for each validation issue
      const fieldErrors = error.errors.map(err => ({ field: err.path.join('.'), message: err.message }))

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

    // Verify the switch belongs to the user and get its images
    const switchItem = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        images: true
      }
    })

    if (!switchItem) {
      return NextResponse.json(
        { error: "Switch not found" },
        { status: 404 }
      )
    }

    // Before deleting the switch, preserve images that are linked to master switches
    if (switchItem.images && switchItem.images.length > 0) {
      // Update images that have a masterSwitchId to remove only the switchId
      // This preserves them for the master switch
      const imagesToPreserve = switchItem.images.filter(img => img.masterSwitchId)
      
      if (imagesToPreserve.length > 0) {
        await prisma.switchImage.updateMany({
          where: {
            id: {
              in: imagesToPreserve.map(img => img.id)
            }
          },
          data: {
            switchId: null // Remove the switch reference but keep the master switch reference
          }
        })
      }

      // Delete images that are ONLY linked to this switch (no masterSwitchId)
      const imagesToDelete = switchItem.images.filter(img => !img.masterSwitchId)
      
      if (imagesToDelete.length > 0) {
        await prisma.switchImage.deleteMany({
          where: {
            id: {
              in: imagesToDelete.map(img => img.id)
            }
          }
        })
      }
    }

    // Now delete the switch
    await prisma.switch.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting switch:', error)
    return NextResponse.json(
      { error: "Failed to delete switch" },
      { status: 500 }
    )
  }
}