import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { registerSchema } from "@/lib/validation"
import { sendVerificationEmail, addUserToMailingList } from "@/lib/email"
import { z } from "zod"
import { withRateLimit } from "@/lib/with-rate-limit"
import { authRateLimit } from "@/lib/rate-limit"

async function registerHandler(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = registerSchema.parse(body)
    
    // Check if user already exists (case-insensitive username check)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { 
            username: {
              equals: validatedData.username,
              mode: 'insensitive'
            }
          }
        ]
      }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email or username already exists" },
        { status: 400 }
      )
    }
    
    // Check if this is the first user
    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12)
    
    // Create user (first user becomes admin)
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        username: validatedData.username,
        password: hashedPassword,
        role: isFirstUser ? 'ADMIN' : 'USER',
      },
      select: {
        id: true,
        email: true,
        username: true,
        shareableId: true,
        role: true,
      }
    })
    
    // Send verification email
    const emailResult = await sendVerificationEmail(user.email, user.id)
    
    if (!emailResult.success) {
      // User created but email failed - log error but don't fail registration
      console.error("Failed to send verification email:", emailResult.error)
    }
    
    // Add user to mailing list if emailMarketing is enabled (default is true for new users)
    addUserToMailingList(user.email, user.username).catch(error => {
      console.error("Failed to add user to mailing list:", error)
    })
    
    return NextResponse.json({
      message: isFirstUser 
        ? "Admin account created successfully! Please check your email to verify your account." 
        : "User created successfully. Please check your email to verify your account.",
      user,
      requiresEmailVerification: true,
      isAdmin: isFirstUser
    }, { status: 201 })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit(authRateLimit, registerHandler)