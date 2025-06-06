import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const mergeAccountsSchema = z.object({
  sourceUserId: z.string().min(1, "Source user ID is required"),
  targetUserId: z.string().min(1, "Target user ID is required"),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sourceUserId, targetUserId } = mergeAccountsSchema.parse(body)

    if (sourceUserId === targetUserId) {
      return NextResponse.json({ error: "Cannot merge user with themselves" }, { status: 400 })
    }

    // Get both users
    const [sourceUser, targetUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: sourceUserId },
        include: {
          switches: true,
          accounts: true,
          forceCurvePreferences: true,
          verificationTokens: true,
          passwordResetTokens: true,
        }
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        include: {
          switches: true,
          accounts: true,
        }
      })
    ])

    if (!sourceUser || !targetUser) {
      return NextResponse.json({ error: "One or both users not found" }, { status: 404 })
    }

    // Prevent merging admin accounts or merging into the current admin
    if (sourceUser.role === 'ADMIN' || targetUser.id === session.user.id) {
      return NextResponse.json({ 
        error: "Cannot merge admin accounts or merge into the current admin user" 
      }, { status: 400 })
    }

    // Perform the merge in a transaction
    await prisma.$transaction(async (tx) => {
      // Move switches from source to target
      if (sourceUser.switches.length > 0) {
        await tx.switch.updateMany({
          where: { userId: sourceUserId },
          data: { userId: targetUserId }
        })
      }

      // Move OAuth accounts from source to target
      if (sourceUser.accounts.length > 0) {
        await tx.account.updateMany({
          where: { userId: sourceUserId },
          data: { userId: targetUserId }
        })
      }

      // Move force curve preferences from source to target
      if (sourceUser.forceCurvePreferences.length > 0) {
        await tx.forceCurvePreference.updateMany({
          where: { userId: sourceUserId },
          data: { userId: targetUserId }
        })
      }

      // Clean up verification and password reset tokens (these are tied to the source user)
      if (sourceUser.verificationTokens.length > 0) {
        await tx.verificationToken.deleteMany({
          where: { userId: sourceUserId }
        })
      }

      if (sourceUser.passwordResetTokens.length > 0) {
        await tx.passwordResetToken.deleteMany({
          where: { userId: sourceUserId }
        })
      }

      // Delete the source user
      await tx.user.delete({
        where: { id: sourceUserId }
      })
    })

    return NextResponse.json({ 
      message: "Accounts merged successfully",
      switchesMoved: sourceUser.switches.length,
      accountsMoved: sourceUser.accounts.length,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email
      }
    })

  } catch (error) {
    console.error("Error merging accounts:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid request data", 
        details: error.errors 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: "Failed to merge accounts" 
    }, { status: 500 })
  }
}