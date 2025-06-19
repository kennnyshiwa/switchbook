import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const updateData: any = {}

    // Handle showForceCurves
    if ('showForceCurves' in body) {
      if (typeof body.showForceCurves !== 'boolean') {
        return NextResponse.json({ error: "Invalid showForceCurves value" }, { status: 400 })
      }
      updateData.showForceCurves = body.showForceCurves
    }

    // Handle emailNotifications
    if ('emailNotifications' in body) {
      if (typeof body.emailNotifications !== 'boolean') {
        return NextResponse.json({ error: "Invalid emailNotifications value" }, { status: 400 })
      }
      updateData.emailNotifications = body.emailNotifications
    }

    // Ensure we have something to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { 
        showForceCurves: true,
        emailNotifications: true 
      }
    })

    return NextResponse.json({ 
      success: true, 
      ...updatedUser
    })
  } catch (error) {
    console.error("Error updating user settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}