import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email'
import { z } from 'zod'

const resendSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resendSchema.parse(body)

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        message: 'If an account with this email exists and is not verified, a verification email has been sent.',
      })
    }

    // Check if email is already verified
    if (user.emailVerified) {
      return NextResponse.json({
        message: 'If an account with this email exists and is not verified, a verification email has been sent.',
      })
    }

    // Delete any existing verification tokens for this user
    await prisma.verificationToken.deleteMany({
      where: { userId: user.id },
    })

    // Send new verification email
    const result = await sendVerificationEmail(user.email, user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send verification email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'If an account with this email exists and is not verified, a verification email has been sent.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}