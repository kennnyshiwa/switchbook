import { imageImportSchema, imageReferenceCreates, primaryReferenceId } from '@/lib/switch-image-references'
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { switchSchema } from "@/lib/validation"
import { z } from "zod"
import { transformSwitchData } from "@/utils/dataTransform"
import { computeMasterModifiedFields, MASTER_TRACKED_SELECT, copyMasterFields } from "@/lib/master-switch-modifications"
import { withSmartRateLimit } from "@/lib/with-rate-limit"

async function createSwitchHandler(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Check user's current switch count to prevent excessive accumulation
    const currentSwitchCount = await prisma.switch.count({
      where: { userId }
    })

    if (currentSwitchCount >= 25000) {
      return NextResponse.json(
        { 
          error: "Switch limit reached. Maximum 25,000 switches per user.",
          currentCount: currentSwitchCount,
          maxAllowed: 25000,
          suggestion: "You have an impressive collection! Consider organizing your switches or contact support if you need a higher limit."
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    
    const imageData = imageImportSchema.parse(body)
    const referenceCreates = imageData.imageReferences === undefined ? undefined : imageReferenceCreates(imageData.imageReferences)
    const validatedData = switchSchema.parse(body)
    
    // Transform empty strings to null for optional fields
    const transformedData = transformSwitchData(validatedData)

    // Extract masterSwitchId if provided (it's not part of the schema validation)
    const masterSwitchId = body.masterSwitchId

    // If masterSwitchId is provided, verify it exists and is approved
    if (masterSwitchId) {
      const masterSwitch = await prisma.masterSwitch.findUnique({
        where: { id: masterSwitchId },
        select: {
          status: true,
          version: true,
          imageUrl: true,
          images: { orderBy: { order: 'asc' } },
          ...MASTER_TRACKED_SELECT
        }
      })

      if (!masterSwitch || masterSwitch.status !== 'APPROVED') {
        return NextResponse.json(
          { error: "Invalid master switch" },
          { status: 400 }
        )
      }

      // Native imports retain snapshot specs/version. Fresh catalog adds seed
      // omitted specs from the master; explicit form values still win.
      const requestedVersion = body.masterSwitchVersion
      const isRelink = Object.prototype.hasOwnProperty.call(body, 'masterSwitchVersion')
      const parsedVersion = Number(requestedVersion)
      const masterSwitchVersion = isRelink && requestedVersion === null ? null : isRelink && Number.isInteger(parsedVersion) && parsedVersion >= 1 && parsedVersion <= masterSwitch.version
        ? parsedVersion
        : masterSwitch.version
      const linkedData = isRelink ? transformedData : { ...copyMasterFields(masterSwitch), ...transformedData }
      const modifiedFields = computeMasterModifiedFields(linkedData, masterSwitch)

      // Copy image records, not their master IDs or ownership. Keep the same
      // gallery-first / legacy URL fallback as the dedicated collection route.
      // Explicitly selected photos in the add modal take precedence and are
      // uploaded separately; do not consume their slots with inherited images.
      const images = imageData.imageReferences !== undefined ? referenceCreates! : body.copyMasterImages === false ? [] : masterSwitch.images.length > 0
        ? masterSwitch.images.map((image, order) => ({
            url: image.url,
            type: image.type,
            order,
            caption: image.caption,
            altText: image.altText, remoteUrl: image.remoteUrl, sourceUrl: image.sourceUrl,
            sourceName: image.sourceName, license: image.license, attribution: image.attribution,
            width: image.width,
            height: image.height,
            size: image.size
          }))
        : masterSwitch.imageUrl
          ? [{ url: masterSwitch.imageUrl, type: 'LINKED' as const, order: 0 }]
          : []

      // A failed image copy must not leave a successful but image-less switch.
      const newSwitch = await prisma.$transaction(async (tx) => {
        const created = await tx.switch.create({
          data: {
            ...linkedData,
            imageUrl: imageData.imageUrl || null,
            userId,
            masterSwitchId,
            masterSwitchVersion,
            isModified: modifiedFields.length > 0,
            modifiedFields,
            images: { create: images }
          },
          include: { images: { orderBy: { order: 'asc' } } }
        })

        if (created.images.length === 0) return created

        return tx.switch.update({
          where: { id: created.id },
          data: { primaryImageId: imageData.imageReferences !== undefined ? primaryReferenceId(imageData.imageReferences, referenceCreates!) : created.images[0].id },
          include: { images: { orderBy: { order: 'asc' } } }
        })
      })

      return NextResponse.json(newSwitch)
    }

    // Create regular switch without master link
    const newSwitch = await prisma.$transaction(async tx => {
      const created = await tx.switch.create({
        data: { ...transformedData, userId, imageUrl: imageData.imageUrl || null,
          ...(imageData.imageReferences !== undefined ? { images: { create: referenceCreates! } } : {}) },
        include: { images: { orderBy: { order: 'asc' } } }
      })
      if (!imageData.imageReferences?.length) return created
      return tx.switch.update({ where: { id: created.id },
        data: { primaryImageId: primaryReferenceId(imageData.imageReferences, referenceCreates!) },
        include: { images: { orderBy: { order: 'asc' } } } })
    })

    return NextResponse.json(newSwitch)
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
      { error: "Failed to create switch" },
      { status: 500 }
    )
  }
}

export const POST = withSmartRateLimit(createSwitchHandler)

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const switches = await prisma.switch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      }
    })

    return NextResponse.json(switches)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch switches" },
      { status: 500 }
    )
  }
}