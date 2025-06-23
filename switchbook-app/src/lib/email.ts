import Mailgun from 'mailgun.js'
import formData from 'form-data'
import { randomBytes } from 'crypto'
import { prisma } from './prisma'

// Initialize Mailgun client
const mailgun = new Mailgun(formData)

// Helper function to check if user has email notifications enabled
async function shouldSendEmailNotification(userId?: string, email?: string): Promise<boolean> {
  if (!userId && !email) return true // Default to sending if we can't check
  
  try {
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: email! },
      select: { emailNotifications: true }
    })
    
    return user?.emailNotifications ?? true // Default to true if not found
  } catch (error) {
    console.error('Error checking email notification preference:', error)
    return true // Default to sending on error
  }
}

function getMailgunClient() {
  const apiKey = process.env.MAILGUN_API_KEY
  const domain = process.env.MAILGUN_DOMAIN
  const baseUrl = process.env.MAILGUN_URL || 'https://api.mailgun.net'
  
  if (!apiKey || !domain) {
    console.error('Mailgun configuration missing:', {
      hasApiKey: !!apiKey,
      hasDomain: !!domain,
      domain: domain
    })
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

// Admin notification email functions
export async function sendAdminNewSubmissionEmail(
  adminEmail: string,
  submitterUsername: string,
  switchName: string,
  switchId: string
) {
  // Check if admin has email notifications enabled
  const shouldSend = await shouldSendEmailNotification(undefined, adminEmail)
  if (!shouldSend) {
    return { success: true, skipped: true }
  }

  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://switchbook.app'
  const reviewUrl = `${baseUrl}/admin/master-switches`
  const switchUrl = `${baseUrl}/switches/${switchId}`

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
    to: adminEmail,
    subject: `New Master Switch Submission: ${switchName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">New Master Switch Submission</h1>
        <p>A new master switch has been submitted for review.</p>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #f59e0b;">
          <p><strong>Switch Name:</strong> ${switchName}</p>
          <p><strong>Submitted by:</strong> ${submitterUsername}</p>
          <p><strong>Status:</strong> <span style="color: #f59e0b;">Pending Review</span></p>
        </div>
        
        <p>Please review this submission and decide whether to approve or reject it.</p>
        
        <a href="${reviewUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px; margin: 15px 5px;">Review Submissions</a>
        <a href="${switchUrl}" style="display: inline-block; padding: 10px 20px; background-color: #6B7280; color: white; text-decoration: none; border-radius: 5px; margin: 15px 5px;">View Details</a>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This is an automated notification from Switchbook. You're receiving this because you're an administrator.
        </p>
      </div>
    `,
    text: `
New Master Switch Submission

A new master switch has been submitted for review.

Switch Name: ${switchName}
Submitted by: ${submitterUsername}
Status: Pending Review

Please review this submission at: ${reviewUrl}
View switch details at: ${switchUrl}

This is an automated notification from Switchbook.
    `
  }

  try {
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send admin notification email:', error)
    return { success: false, error: 'Failed to send admin notification email' }
  }
}

export async function sendAdminEditSuggestionEmail(
  adminEmail: string,
  editorUsername: string,
  switchName: string,
  switchId: string,
  editId: string
) {
  // Check if admin has email notifications enabled
  const shouldSend = await shouldSendEmailNotification(undefined, adminEmail)
  if (!shouldSend) {
    return { success: true, skipped: true }
  }

  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://switchbook.app'
  const reviewUrl = `${baseUrl}/admin/master-switches`
  const switchUrl = `${baseUrl}/switches/${switchId}`

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
    to: adminEmail,
    subject: `New Edit Suggestion: ${switchName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">New Edit Suggestion</h1>
        <p>A new edit suggestion has been submitted for review.</p>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #f59e0b;">
          <p><strong>Switch Name:</strong> ${switchName}</p>
          <p><strong>Suggested by:</strong> ${editorUsername}</p>
          <p><strong>Status:</strong> <span style="color: #f59e0b;">Pending Review</span></p>
        </div>
        
        <p>Please review this edit suggestion and decide whether to approve or reject it.</p>
        
        <a href="${reviewUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px; margin: 15px 5px;">Review Edit Suggestions</a>
        <a href="${switchUrl}" style="display: inline-block; padding: 10px 20px; background-color: #6B7280; color: white; text-decoration: none; border-radius: 5px; margin: 15px 5px;">View Switch</a>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This is an automated notification from Switchbook. You're receiving this because you're an administrator.
        </p>
      </div>
    `,
    text: `
New Edit Suggestion

A new edit suggestion has been submitted for review.

Switch Name: ${switchName}
Suggested by: ${editorUsername}
Status: Pending Review

Please review this edit suggestion at: ${reviewUrl}
View switch details at: ${switchUrl}

This is an automated notification from Switchbook.
    `
  }

  try {
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send admin notification email:', error)
    return { success: false, error: 'Failed to send admin notification email' }
  }
}

export async function sendMasterSwitchApprovalEmail(
  userEmail: string,
  switchName: string,
  switchId: string
) {
  // Check if user has email notifications enabled
  const shouldSend = await shouldSendEmailNotification(undefined, userEmail)
  if (!shouldSend) {
    return { success: true, skipped: true }
  }

  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://switchbook.app'
  const switchUrl = `${baseUrl}/switches/${switchId}`

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
    to: userEmail,
    subject: 'Your Master Switch Has Been Approved! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Great News!</h1>
        <p>Your master switch submission has been approved and is now live in our database.</p>
        
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #10b981;">
          <p><strong>Switch Name:</strong> ${switchName}</p>
          <p><strong>Status:</strong> <span style="color: #10b981;">Approved</span></p>
        </div>
        
        <p>Your contribution helps the mechanical keyboard community discover and learn about different switches. Thank you!</p>
        
        <a href="${switchUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">View Your Switch</a>
        
        <p>Other users can now:</p>
        <ul>
          <li>Add this switch to their collections</li>
          <li>View detailed specifications</li>
          <li>Suggest improvements or corrections</li>
        </ul>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          Thank you for contributing to Switchbook!
        </p>
      </div>
    `,
  }

  try {
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send approval email:', error)
    return { success: false, error: 'Failed to send approval email' }
  }
}

export async function sendMasterSwitchRejectionEmail(
  userEmail: string,
  switchName: string,
  reason: string
) {
  // Check if user has email notifications enabled
  const shouldSend = await shouldSendEmailNotification(undefined, userEmail)
  if (!shouldSend) {
    return { success: true, skipped: true }
  }

  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://switchbook.app'
  const submitUrl = `${baseUrl}/switches/submit`

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
    to: userEmail,
    subject: 'Update on Your Master Switch Submission',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Submission Update</h1>
        <p>Thank you for your master switch submission. After review, we need some changes before it can be approved.</p>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #f59e0b;">
          <p><strong>Switch Name:</strong> ${switchName}</p>
          <p><strong>Status:</strong> <span style="color: #f59e0b;">Needs Revision</span></p>
          <p><strong>Feedback:</strong> ${reason}</p>
        </div>
        
        <p>Don't worry! You can address the feedback and resubmit. Here are some tips:</p>
        <ul>
          <li>Check if a similar switch already exists in our database</li>
          <li>Ensure all specifications are accurate and from official sources</li>
          <li>Include clear, descriptive information</li>
        </ul>
        
        <a href="${submitUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">Submit Another Switch</a>
        
        <p>If you have questions about the feedback, feel free to reach out to our community on Discord.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          Thank you for helping improve Switchbook!
        </p>
      </div>
    `,
  }

  try {
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send rejection email:', error)
    return { success: false, error: 'Failed to send rejection email' }
  }
}

export async function sendEditSuggestionApprovalEmail(
  userEmail: string,
  switchName: string,
  switchId: string
) {
  // Check if user has email notifications enabled
  const shouldSend = await shouldSendEmailNotification(undefined, userEmail)
  if (!shouldSend) {
    return { success: true, skipped: true }
  }

  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://switchbook.app'
  const historyUrl = `${baseUrl}/switches/${switchId}/history`

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
    to: userEmail,
    subject: 'Your Edit Suggestion Has Been Approved! ✅',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Edit Approved!</h1>
        <p>Your edit suggestion has been reviewed and approved. The master switch has been updated with your changes.</p>
        
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #10b981;">
          <p><strong>Switch:</strong> ${switchName}</p>
          <p><strong>Status:</strong> <span style="color: #10b981;">Changes Applied</span></p>
        </div>
        
        <p>Thank you for helping keep our switch database accurate and up-to-date!</p>
        
        <a href="${historyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">View Edit History</a>
        
        <p>Your contribution helps ensure everyone has access to accurate switch information.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          Thank you for contributing to Switchbook!
        </p>
      </div>
    `,
  }

  try {
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send edit approval email:', error)
    return { success: false, error: 'Failed to send edit approval email' }
  }
}

export async function sendEditSuggestionRejectionEmail(
  userEmail: string,
  switchName: string,
  switchId: string,
  reason: string
) {
  // Check if user has email notifications enabled
  const shouldSend = await shouldSendEmailNotification(undefined, userEmail)
  if (!shouldSend) {
    return { success: true, skipped: true }
  }

  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://switchbook.app'
  const switchUrl = `${baseUrl}/switches/${switchId}`

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
    to: userEmail,
    subject: 'Update on Your Edit Suggestion',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Edit Suggestion Update</h1>
        <p>Thank you for your edit suggestion. After review, we've decided not to apply these changes at this time.</p>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #f59e0b;">
          <p><strong>Switch:</strong> ${switchName}</p>
          <p><strong>Status:</strong> <span style="color: #f59e0b;">Not Applied</span></p>
          <p><strong>Reason:</strong> ${reason}</p>
        </div>
        
        <p>This doesn't mean your contribution wasn't valued. Edit decisions consider various factors including:</p>
        <ul>
          <li>Verification of information sources</li>
          <li>Consistency with existing data standards</li>
          <li>Community consensus on specifications</li>
        </ul>
        
        <a href="${switchUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0;">View Switch</a>
        
        <p>Feel free to suggest other improvements or join the discussion on our Discord server.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          Thank you for helping improve Switchbook!
        </p>
      </div>
    `,
  }

  try {
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send edit rejection email:', error)
    return { success: false, error: 'Failed to send edit rejection email' }
  }
}

// Add user to Mailgun mailing list
export async function addUserToMailingList(email: string, name: string = '') {
  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  const mailingListAddress = process.env.MAILGUN_MAILING_LIST
  
  if (!mailingListAddress) {
    console.warn('MAILGUN_MAILING_LIST not configured, skipping mailing list addition')
    return { success: true, skipped: true }
  }

  try {
    // Add member to mailing list
    await client.lists.members.createMember(mailingListAddress, {
      address: email,
      name: name,
      subscribed: true,
      vars: {
        joined_date: new Date().toISOString(),
        source: 'registration'
      }
    })
    
    console.log(`Successfully added ${email} to mailing list`)
    return { success: true }
  } catch (error: any) {
    // If member already exists, that's okay
    if (error.status === 400 && error.message?.includes('already exists')) {
      console.log(`User ${email} already in mailing list`)
      return { success: true, alreadyExists: true }
    }
    
    console.error('Failed to add user to mailing list:', error)
    return { success: false, error: 'Failed to add to mailing list' }
  }
}

export async function sendNewManufacturerNotification(
  manufacturerName: string, 
  submittedBy: string,
  userEmail?: string,
  originalName?: string,
  isNewManufacturer: boolean = true
) {
  const client = getMailgunClient()
  
  if (!client) {
    return { success: false, error: 'Email service not configured' }
  }

  // Get all admin users with email notifications enabled
  const adminUsers = await prisma.user.findMany({
    where: { 
      role: 'ADMIN',
      emailNotifications: true 
    },
    select: { email: true, username: true }
  })

  if (adminUsers.length === 0) {
    console.warn('No admin users found to notify about new manufacturer submission')
    return { success: true, warning: 'No admin users to notify' }
  }

  // Use production URL for admin links, but fall back to environment URL if needed
  const envUrl = process.env.NEXTAUTH_URL
  const baseUrl = (envUrl && envUrl.includes('localhost')) ? envUrl : 'https://switchbook.app'
  const adminUrl = `${baseUrl}/admin/manufacturers`

  const subject = isNewManufacturer 
    ? 'New Switch Manufacturer Pending Verification'
    : 'Unverified Manufacturer Usage Detected'

  const title = isNewManufacturer 
    ? 'New Manufacturer Submission'
    : 'Unverified Manufacturer Usage'

  const description = isNewManufacturer
    ? 'A new switch manufacturer has been submitted and requires verification:'
    : 'A user has submitted a switch using an unverified manufacturer that requires your attention:'

  const messageData = {
    from: process.env.MAILGUN_FROM || process.env.EMAIL_FROM || 'noreply@switchbook.app',
    to: adminUsers.map(admin => admin.email).join(', '),
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">${title}</h1>
        <p>${description}</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>Manufacturer Name:</strong> ${manufacturerName}</p>
          ${originalName && originalName !== manufacturerName ? `<p><strong>Original Submission:</strong> ${originalName} <em>(auto-capitalized)</em></p>` : ''}
          <p><strong>Submitted by:</strong> ${submittedBy}${userEmail ? ` (${userEmail})` : ''}</p>
          <p><strong>Submission Time:</strong> ${new Date().toLocaleString()}</p>
          ${!isNewManufacturer ? `<p><strong>Status:</strong> <span style="color: #f59e0b;">Unverified</span></p>` : ''}
        </div>
        
        <p>Please review this ${isNewManufacturer ? 'submission' : 'manufacturer'} in the admin panel:</p>
        <a href="${adminUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 5px;">Review Manufacturers</a>
        
        <p>You can verify, edit, or reject this manufacturer ${isNewManufacturer ? 'submission' : 'entry'} from the admin panel.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This is an automated notification from Switchbook. 
          If you no longer wish to receive these notifications, please contact the system administrator.
        </p>
      </div>
    `,
  }

  try {
    await client.messages.create(process.env.MAILGUN_DOMAIN!, messageData)
    return { success: true }
  } catch (error) {
    console.error('Failed to send new manufacturer notification:', error)
    return { success: false, error: 'Failed to send notification email' }
  }
}