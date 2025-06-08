import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { passwordResetSchema } from "@/lib/validation"
import bcrypt from "bcryptjs"
import { z } from "zod"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = passwordResetSchema.parse(body)

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    })

    if (!resetToken) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 })
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id }
      })
      return NextResponse.json({ error: "Reset token has expired" }, { status: 400 })
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update user password and clean up reset token
    await Promise.all([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword }
      }),
      prisma.passwordResetToken.delete({
        where: { id: resetToken.id }
      })
    ])

    return NextResponse.json({ message: "Password has been reset successfully" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 })
    }
    
    console.error("Password reset error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}