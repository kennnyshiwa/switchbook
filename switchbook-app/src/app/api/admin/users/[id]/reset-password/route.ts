import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { sendPasswordResetEmail } from "@/lib/email"
import crypto from "crypto"
import { withRateLimit } from "@/lib/with-rate-limit"
import { strictRateLimit } from "@/lib/rate-limit"

interface RouteParams {
  params: Promise<{ id: string }>
}

function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    const randomBytes = crypto.randomBytes(1)
    const randomIndex = randomBytes[0] % chars.length
    password += chars.charAt(randomIndex)
  }
  return password
}

async function adminPasswordResetHandler(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    const { id: userId } = await params
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Don't allow resetting own password through this endpoint
    if (user.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot reset your own password through admin panel" },
        { status: 400 }
      )
    }

    // Generate new password
    const newPassword = generateRandomPassword()
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    // Send email with new password
    await sendPasswordResetEmail(user.email, newPassword)

    return NextResponse.json({
      message: "Password reset successfully",
      success: true,
    })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit(strictRateLimit, adminPasswordResetHandler)