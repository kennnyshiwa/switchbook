import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ id: string }>
}

// DELETE wishlist item
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id } = await params
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify the wishlist item belongs to the user
    const wishlistItem = await prisma.wishlist.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!wishlistItem) {
      return NextResponse.json(
        { error: "Wishlist item not found" },
        { status: 404 }
      )
    }

    await prisma.wishlist.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting wishlist item:', error)
    return NextResponse.json(
      { error: "Failed to delete wishlist item" },
      { status: 500 }
    )
  }
}

// PATCH update wishlist item (e.g., priority, notes)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id } = await params
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const data = await request.json()
    const { customNotes, priority } = data

    // Verify the wishlist item belongs to the user
    const wishlistItem = await prisma.wishlist.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!wishlistItem) {
      return NextResponse.json(
        { error: "Wishlist item not found" },
        { status: 404 }
      )
    }

    const updated = await prisma.wishlist.update({
      where: { id },
      data: {
        ...(customNotes !== undefined && { customNotes }),
        ...(priority !== undefined && { priority })
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

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating wishlist item:', error)
    return NextResponse.json(
      { error: "Failed to update wishlist item" },
      { status: 500 }
    )
  }
}