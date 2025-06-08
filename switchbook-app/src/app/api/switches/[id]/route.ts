import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { switchSchema } from "@/lib/validation"
import { z } from "zod"
import { transformSwitchData } from "@/utils/dataTransform"
import { normalizeManufacturerName } from "@/utils/manufacturerNormalization"
import { getClientIdentifier } from "@/lib/rate-limit"
import { checkImageValidationRateLimit } from "@/lib/image-security"
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
    
    // Additional rate limiting for image URL validation
    if (body && typeof body === 'object' && 'imageUrl' in body && body.imageUrl) {
      const clientIP = getClientIdentifier(request)
      if (!checkImageValidationRateLimit(clientIP)) {
        return NextResponse.json(
          { error: "Too many image validation requests. Please try again later." },
          { status: 429 }
        )
      }
    }
    
    const validatedData = switchSchema.parse(body)
    
    // Transform empty strings to null for optional fields
    const transformedData = transformSwitchData(validatedData)

    // Normalize manufacturer name if provided
    if (transformedData.manufacturer) {
      transformedData.manufacturer = await normalizeManufacturerName(transformedData.manufacturer)
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

    // Update the switch
    const updatedSwitch = await prisma.switch.update({
      where: { id },
      data: transformedData,
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