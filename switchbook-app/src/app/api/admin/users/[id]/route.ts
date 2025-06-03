import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id: userId } = await params
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Don't allow deleting own account through this endpoint
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account through admin panel" },
        { status: 400 }
      )
    }

    // Delete user and all related data (cascading delete)
    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({
      message: "User deleted successfully",
      success: true,
    })
  } catch (error) {
    console.error("User deletion error:", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}