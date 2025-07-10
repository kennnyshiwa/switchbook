import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id } = await params
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get the wishlist item
    const wishlistItem = await prisma.wishlist.findFirst({
      where: {
        id,
        userId: session.user.id
      },
      include: {
        masterSwitch: true
      }
    })

    if (!wishlistItem) {
      return NextResponse.json(
        { error: "Wishlist item not found" },
        { status: 404 }
      )
    }

    // If it's linked to a master switch, add that to collection
    if (wishlistItem.masterSwitchId && wishlistItem.masterSwitch) {
      // Check if already in collection
      const existing = await prisma.switch.findFirst({
        where: {
          userId: session.user.id,
          masterSwitchId: wishlistItem.masterSwitchId
        }
      })

      if (existing) {
        return NextResponse.json(
          { error: "This switch is already in your collection" },
          { status: 400 }
        )
      }

      // Create switch from master switch data
      const newSwitch = await prisma.switch.create({
        data: {
          userId: session.user.id,
          masterSwitchId: wishlistItem.masterSwitchId,
          masterSwitchVersion: wishlistItem.masterSwitch.version,
          name: wishlistItem.masterSwitch.name,
          chineseName: wishlistItem.masterSwitch.chineseName,
          type: wishlistItem.masterSwitch.type,
          technology: wishlistItem.masterSwitch.technology,
          manufacturer: wishlistItem.masterSwitch.manufacturer,
          actuationForce: wishlistItem.masterSwitch.actuationForce,
          bottomOutForce: wishlistItem.masterSwitch.bottomOutForce,
          preTravel: wishlistItem.masterSwitch.preTravel,
          bottomOut: wishlistItem.masterSwitch.bottomOut,
          springWeight: wishlistItem.masterSwitch.springWeight,
          springLength: wishlistItem.masterSwitch.springLength,
          notes: wishlistItem.masterSwitch.notes,
          topHousing: wishlistItem.masterSwitch.topHousing,
          bottomHousing: wishlistItem.masterSwitch.bottomHousing,
          stem: wishlistItem.masterSwitch.stem,
          magnetOrientation: wishlistItem.masterSwitch.magnetOrientation,
          magnetPosition: wishlistItem.masterSwitch.magnetPosition,
          magnetPolarity: wishlistItem.masterSwitch.magnetPolarity,
          initialForce: wishlistItem.masterSwitch.initialForce,
          initialMagneticFlux: wishlistItem.masterSwitch.initialMagneticFlux,
          bottomOutMagneticFlux: wishlistItem.masterSwitch.bottomOutMagneticFlux,
          pcbThickness: wishlistItem.masterSwitch.pcbThickness,
          compatibility: wishlistItem.masterSwitch.compatibility,
          tactileForce: wishlistItem.masterSwitch.tactileForce,
          tactilePosition: wishlistItem.masterSwitch.tactilePosition,
          progressiveSpring: wishlistItem.masterSwitch.progressiveSpring,
          doubleStage: wishlistItem.masterSwitch.doubleStage,
          clickType: wishlistItem.masterSwitch.clickType,
          // Add custom notes if any
          personalNotes: wishlistItem.customNotes
        }
      })

      // Copy master switch images
      if (wishlistItem.masterSwitch.imageUrl) {
        await prisma.switchImage.create({
          data: {
            switchId: newSwitch.id,
            url: wishlistItem.masterSwitch.imageUrl,
            type: 'LINKED',
            order: 0
          }
        })
      }

      // Delete from wishlist
      await prisma.wishlist.delete({
        where: { id }
      })

      return NextResponse.json({ 
        success: true, 
        switchId: newSwitch.id 
      })
    } else {
      // For custom wishlist items, create a new switch
      const newSwitch = await prisma.switch.create({
        data: {
          userId: session.user.id,
          name: wishlistItem.customName || "Unnamed Switch",
          manufacturer: wishlistItem.customManufacturer,
          notes: wishlistItem.customNotes
        }
      })

      // Delete from wishlist
      await prisma.wishlist.delete({
        where: { id }
      })

      return NextResponse.json({ 
        success: true, 
        switchId: newSwitch.id 
      })
    }
  } catch (error) {
    console.error('Error moving to collection:', error)
    return NextResponse.json(
      { error: "Failed to move to collection" },
      { status: 500 }
    )
  }
}