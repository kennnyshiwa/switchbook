import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  renderSwitchLabel,
  type LabelSwitchType,
  type LabelTechnology,
  type LabelClickType,
} from "@/lib/switch-label"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const switchItem = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      // Measurements only. Colours, markings and images are visible on the
      // switch itself, so they would spend label space for nothing.
      select: {
        name: true,
        type: true,
        technology: true,
        manufacturer: true,

        actuationForce: true,
        bottomOutForce: true,
        initialForce: true,
        tactileForce: true,
        tactilePosition: true,
        preTravel: true,
        bottomOut: true,

        springWeight: true,
        springLength: true,
        progressiveSpring: true,
        doubleStage: true,

        stem: true,
        stemShape: true,
        topHousing: true,
        bottomHousing: true,
        compatibility: true,
        clickType: true,

        initialMagneticFlux: true,
        bottomOutMagneticFlux: true,
        magnetPolarity: true,
        magnetOrientation: true,
        magnetPosition: true,
        pcbThickness: true,

        isModified: true,
        frankenTop: true,
        frankenStem: true,
        frankenBottom: true,

        notes: true,
        personalNotes: true,
      },
    })

    if (!switchItem) {
      return NextResponse.json({ error: "Switch not found" }, { status: 404 })
    }

    const html = renderSwitchLabel({
      ...switchItem,
      type: switchItem.type as LabelSwitchType | null,
      technology: switchItem.technology as LabelTechnology | null,
      clickType: switchItem.clickType as LabelClickType | null,
    })

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // The label reflects live switch data; a stale cached copy would
        // print the wrong specs after an edit.
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate label" },
      { status: 500 }
    )
  }
}
