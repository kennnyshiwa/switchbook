import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendAdminNewSubmissionEmail } from '@/lib/email'

// Schema for master switch submission
const submissionSchema = z.object({
  name: z.string().min(1),
  chineseName: z.string().optional().nullable(),
  manufacturer: z.string().min(1),
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE']).optional().nullable(),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional().nullable(),
  compatibility: z.string().optional().nullable(),
  
  // Force specifications
  initialForce: z.number().optional().nullable(),
  actuationForce: z.number().optional().nullable(),
  bottomOutForce: z.number().optional().nullable(),
  preTravel: z.number().optional().nullable(),
  bottomOut: z.number().optional().nullable(),
  
  // Spring specifications
  springWeight: z.string().optional().nullable(),
  springLength: z.string().optional().nullable(),
  
  // Materials
  topHousing: z.string().optional().nullable(),
  bottomHousing: z.string().optional().nullable(),
  stem: z.string().optional().nullable(),
  
  // Magnetic specifications
  magnetOrientation: z.string().optional().nullable(),
  magnetPosition: z.string().optional().nullable(),
  magnetPolarity: z.string().optional().nullable(),
  initialMagneticFlux: z.number().optional().nullable(),
  bottomOutMagneticFlux: z.number().optional().nullable(),
  pcbThickness: z.string().optional().nullable(),
  
  // Additional info
  notes: z.string().optional().nullable(),
  imageUrl: z.union([z.string().url(), z.null()]).optional(),
  
  // Submission details
  submissionNotes: z.string().min(10),
})

// Helper function to calculate similarity between two strings
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '')
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  if (s1 === s2) return 1
  
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length === 0) return 1
  
  const editDistance = (a: string, b: string): number => {
    const matrix: number[][] = []
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[b.length][a.length]
  }
  
  const distance = editDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await req.json()
    const validated = submissionSchema.parse(body)

    // Check for exact duplicates by name and manufacturer
    const exactMatch = await prisma.masterSwitch.findFirst({
      where: {
        name: {
          equals: validated.name,
          mode: 'insensitive'
        },
        manufacturer: {
          equals: validated.manufacturer,
          mode: 'insensitive'
        },
        status: 'APPROVED'
      }
    })

    if (exactMatch) {
      return NextResponse.json(
        { 
          error: 'A master switch with this exact name and manufacturer already exists',
          existingId: exactMatch.id,
          duplicateType: 'exact'
        }, 
        { status: 400 }
      )
    }
    
    // Check for similar switches (fuzzy matching)
    const allSwitches = await prisma.masterSwitch.findMany({
      where: {
        status: 'APPROVED',
        manufacturer: {
          equals: validated.manufacturer,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        manufacturer: true
      }
    })
    
    const similarSwitches = allSwitches
      .map(sw => ({
        ...sw,
        similarity: calculateSimilarity(sw.name, validated.name)
      }))
      .filter(sw => sw.similarity > 0.8) // 80% similarity threshold
      .sort((a, b) => b.similarity - a.similarity)
    
    // If we found very similar switches, return them for user confirmation
    if (similarSwitches.length > 0 && !body.confirmNotDuplicate) {
      return NextResponse.json(
        {
          error: 'Similar switches found. Please confirm this is not a duplicate.',
          similarSwitches: similarSwitches.slice(0, 5), // Return top 5 similar switches
          requiresConfirmation: true
        },
        { status: 409 } // Conflict status
      )
    }

    // Create the master switch submission with PENDING status
    const masterSwitch = await prisma.masterSwitch.create({
      data: {
        name: validated.name,
        chineseName: validated.chineseName || null,
        manufacturer: validated.manufacturer,
        type: validated.type || null,
        technology: validated.technology || null,
        compatibility: validated.compatibility || null,
        initialForce: validated.initialForce || null,
        actuationForce: validated.actuationForce || null,
        bottomOutForce: validated.bottomOutForce || null,
        preTravel: validated.preTravel || null,
        bottomOut: validated.bottomOut || null,
        springWeight: validated.springWeight || null,
        springLength: validated.springLength || null,
        topHousing: validated.topHousing || null,
        bottomHousing: validated.bottomHousing || null,
        stem: validated.stem || null,
        magnetOrientation: validated.magnetOrientation || null,
        magnetPosition: validated.magnetPosition || null,
        magnetPolarity: validated.magnetPolarity || null,
        initialMagneticFlux: validated.initialMagneticFlux || null,
        bottomOutMagneticFlux: validated.bottomOutMagneticFlux || null,
        pcbThickness: validated.pcbThickness || null,
        notes: validated.notes || null,
        imageUrl: validated.imageUrl || null,
        status: 'PENDING',
        submittedById: session.user.id,
        // Store the full submission data for audit purposes
        originalSubmissionData: validated,
      },
      select: {
        id: true,
        name: true,
        manufacturer: true,
        status: true
      }
    })

    // Get the user who submitted for the email
    const submitter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true }
    })

    // Send notification emails to all admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true }
    })

    // Send emails to all admins asynchronously (don't wait for completion)
    Promise.all(
      admins.map(admin => 
        sendAdminNewSubmissionEmail(
          admin.email,
          submitter?.username || 'Unknown User',
          masterSwitch.name,
          masterSwitch.id
        )
      )
    ).catch(error => {
      console.error('Failed to send admin notification emails:', error)
    })

    return NextResponse.json({
      id: masterSwitch.id,
      message: 'Master switch submitted successfully and is pending review',
      status: masterSwitch.status
    })

  } catch (error) {
    console.error('Master switch submission error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid submission data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit master switch' },
      { status: 500 }
    )
  }
}