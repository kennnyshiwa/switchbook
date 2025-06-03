import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { switchSchema } from "@/lib/validation"
import { z } from "zod"
import { transformSwitchData } from "@/utils/dataTransform"

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = switchSchema.parse(body)
    
    // Transform empty strings to null for optional fields
    const transformedData = transformSwitchData(validatedData)

    const newSwitch = await prisma.switch.create({
      data: {
        ...transformedData,
        userId: session.user.id,
      },
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
    })

    return NextResponse.json(switches)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch switches" },
      { status: 500 }
    )
  }
}