import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendUserPasswordResetEmail } from "@/lib/email"
import { passwordResetRequestSchema } from "@/lib/validation"
import { z } from "zod"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = passwordResetRequestSchema.parse(body)

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({ message: "If an account with this email exists, a password reset link has been sent." })
    }

    // Clean up any existing password reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    })

    // Send password reset email
    const result = await sendUserPasswordResetEmail(email, user.id)

    if (!result.success) {
      return NextResponse.json({ error: "Failed to send password reset email" }, { status: 500 })
    }

    return NextResponse.json({ message: "If an account with this email exists, a password reset link has been sent." })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }
    
    console.error("Password reset request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}