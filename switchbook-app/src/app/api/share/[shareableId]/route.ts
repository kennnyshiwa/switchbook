import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareableId: string }> }
) {
  try {
    const { shareableId } = await params

    const user = await prisma.user.findUnique({
      where: { shareableId },
      select: {
        username: true,
        showForceCurves: true,
        switches: {
          orderBy: { createdAt: "desc" },
          include: {
            images: {
              orderBy: { order: 'asc' }
            }
          }
        },
        forceCurvePreferences: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching share collection:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}