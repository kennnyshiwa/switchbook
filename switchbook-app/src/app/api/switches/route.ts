import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { switchSchema } from "@/lib/validation"
import { z } from "zod"
import { transformSwitchData } from "@/utils/dataTransform"
import { normalizeManufacturerName } from "@/utils/manufacturerNormalization"
import { withSmartRateLimit } from "@/lib/with-rate-limit"
import { getClientIdentifier } from "@/lib/rate-limit"
import { checkImageValidationRateLimit } from "@/lib/image-security"

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
    
    // Additional rate limiting for image URL validation
    if (body.imageUrl) {
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
      transformedData.manufacturer = await normalizeManufacturerName(
        transformedData.manufacturer, 
        userId
      )
    }

    // Extract masterSwitchId if provided (it's not part of the schema validation)
    const masterSwitchId = body.masterSwitchId

    // If masterSwitchId is provided, verify it exists and is approved
    if (masterSwitchId) {
      const masterSwitch = await prisma.masterSwitch.findUnique({
        where: { id: masterSwitchId },
        select: { status: true, version: true }
      })

      if (!masterSwitch || masterSwitch.status !== 'APPROVED') {
        return NextResponse.json(
          { error: "Invalid master switch" },
          { status: 400 }
        )
      }

      // Create switch linked to master database
      const newSwitch = await prisma.switch.create({
        data: {
          ...transformedData,
          userId,
          masterSwitchId,
          masterSwitchVersion: masterSwitch.version,
          isModified: false
        },
        include: {
          images: {
            orderBy: { order: 'asc' }
          }
        }
      })

      return NextResponse.json(newSwitch)
    }

    // Create regular switch without master link
    const newSwitch = await prisma.switch.create({
      data: {
        ...transformedData,
        userId,
      },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      }
    })

    return NextResponse.json(newSwitch)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
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

export async function GET(request: Request) {
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