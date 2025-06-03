import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { switchSchema } from "@/lib/validation"
import { z } from "zod"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  let body: any
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
    console.log("Request body:", JSON.stringify(body, null, 2))
    const validatedData = switchSchema.parse(body)
    
    // Transform empty strings to null for optional fields
    const transformedData = {
      ...validatedData,
      springWeight: validatedData.springWeight || null,
      travel: validatedData.travel || null,
      notes: validatedData.notes || null,
      imageUrl: validatedData.imageUrl || null,
      topHousing: validatedData.topHousing || null,
      bottomHousing: validatedData.bottomHousing || null,
      stem: validatedData.stem || null,
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

    console.error("Switch update error:", error)
    console.error("Request body:", JSON.stringify(body, null, 2))
    return NextResponse.json(
      { error: "Failed to update switch", details: error.message },
      { status: 500 }
    )
  }
}

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
    console.error("Switch deletion error:", error)
    return NextResponse.json(
      { error: "Failed to delete switch" },
      { status: 500 }
    )
  }
}