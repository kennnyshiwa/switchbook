import nodemailer from 'nodemailer'
import { randomBytes } from 'crypto'
import { prisma } from './prisma'

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

export async function sendVerificationEmail(email: string, userId: string) {
  // Generate verification token
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  // Save token to database
  await prisma.verificationToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  })

  const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${token}`

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify your Switchbook account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome to Switchbook!</h1>
        <p>Please verify your email address to complete your registration.</p>
        <p>Click the link below to verify your email:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 5 minutes.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      </div>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error('Failed to send verification email:', error)
    return { success: false, error: 'Failed to send verification email' }
  }
}

export async function sendPasswordResetEmail(email: string, newPassword: string) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Your Switchbook password has been reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password Reset</h1>
        <p>Your password has been reset by an administrator.</p>
        <p>Your new temporary password is: <strong>${newPassword}</strong></p>
        <p>Please log in and change your password immediately.</p>
        <p>If you didn't request this change, please contact support immediately.</p>
      </div>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error('Failed to send password reset email:', error)
    return { success: false, error: 'Failed to send password reset email' }
  }
}