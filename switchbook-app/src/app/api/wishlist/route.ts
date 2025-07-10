import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET wishlist items
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const wishlistItems = await prisma.wishlist.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        masterSwitch: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              take: 1
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(wishlistItems)
  } catch (error) {
    console.error('Error fetching wishlist:', error)
    return NextResponse.json(
      { error: "Failed to fetch wishlist" },
      { status: 500 }
    )
  }
}

// POST new wishlist item
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const data = await request.json()
    const { masterSwitchId, customName, customManufacturer, customNotes } = data

    // If masterSwitchId is provided, check if it already exists in wishlist
    if (masterSwitchId) {
      const existing = await prisma.wishlist.findFirst({
        where: {
          userId: session.user.id,
          masterSwitchId
        }
      })

      if (existing) {
        return NextResponse.json(
          { error: "This switch is already in your wishlist" },
          { status: 400 }
        )
      }
    }

    const wishlistItem = await prisma.wishlist.create({
      data: {
        userId: session.user.id,
        masterSwitchId,
        customName,
        customManufacturer,
        customNotes
      },
      include: {
        masterSwitch: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              take: 1
            }
          }
        }
      }
    })

    return NextResponse.json(wishlistItem)
  } catch (error) {
    console.error('Error creating wishlist item:', error)
    return NextResponse.json(
      { error: "Failed to add to wishlist" },
      { status: 500 }
    )
  }
}