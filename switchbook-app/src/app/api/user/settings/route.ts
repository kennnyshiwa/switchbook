import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { addUserToMailingList, removeUserFromMailingList } from "@/lib/email"

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

    // Handle emailMarketing
    if ('emailMarketing' in body) {
      if (typeof body.emailMarketing !== 'boolean') {
        return NextResponse.json({ error: "Invalid emailMarketing value" }, { status: 400 })
      }
      updateData.emailMarketing = body.emailMarketing
    }

    // Ensure we have something to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    // Get user email before updating
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, username: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { 
        showForceCurves: true,
        emailNotifications: true,
        emailMarketing: true 
      }
    })

    // Handle mailing list subscription/unsubscription
    if ('emailMarketing' in body) {
      if (body.emailMarketing) {
        // Add to mailing list
        addUserToMailingList(user.email, user.username).catch(error => {
          console.error("Failed to add user to mailing list:", error)
        })
      } else {
        // Remove from mailing list
        removeUserFromMailingList(user.email).catch(error => {
          console.error("Failed to remove user from mailing list:", error)
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      ...updatedUser
    })
  } catch (error) {
    console.error("Error updating user settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}