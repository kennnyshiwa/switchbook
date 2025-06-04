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
    const { showForceCurves } = body

    if (typeof showForceCurves !== 'boolean') {
      return NextResponse.json({ error: "Invalid showForceCurves value" }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { showForceCurves },
      select: { showForceCurves: true }
    })

    return NextResponse.json({ success: true, showForceCurves: updatedUser.showForceCurves })
  } catch (error) {
    console.error("Error updating user settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}