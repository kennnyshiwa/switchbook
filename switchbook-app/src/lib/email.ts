import Mailgun from 'mailgun.js'
import formData from 'form-data'
import { randomBytes } from 'crypto'
import { prisma } from './prisma'

// Initialize Mailgun client
const mailgun = new Mailgun(formData)

function getMailgunClient() {
  const apiKey = process.env.MAILGUN_API_KEY
  const domain = process.env.MAILGUN_DOMAIN
  const baseUrl = process.env.MAILGUN_URL || 'https://api.mailgun.net'
  
  if (!apiKey || !domain) {
    console.error('Mailgun configuration missing. Please set MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables.')
    return null
  }
  
  return mailgun.client({
    username: 'api',
    key: apiKey,
    url: baseUrl
  })
}

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

  const baseUrl = process.env.NEXTAUTH_URL || 'https://switchbook.app'
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`
  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
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
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send verification email:', error)
    return { success: false, error: 'Failed to send verification email' }
  }
}

export async function sendUserPasswordResetEmail(email: string, userId: string) {
  // Generate password reset token
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  // Save token to database
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL || 'https://switchbook.app'
  const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`
  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
    to: email,
    subject: 'Reset your Switchbook password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password Reset Request</h1>
        <p>You requested to reset your password for your Switchbook account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
      </div>
    `,
  }

  try {
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send password reset email:', error)
    return { success: false, error: 'Failed to send password reset email' }
  }
}

export async function sendPasswordResetEmail(email: string, newPassword: string) {
  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
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
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send password reset email:', error)
    return { success: false, error: 'Failed to send password reset email' }
  }
}