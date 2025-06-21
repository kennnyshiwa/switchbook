import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const linkSchema = z.object({
  userSwitchId: z.string().min(1, 'User switch ID is required')
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: masterSwitchId } = await context.params
    const body = await req.json()
    const { userSwitchId } = linkSchema.parse(body)

    // Check if the master switch exists and is approved
    const masterSwitch = await prisma.masterSwitch.findUnique({
      where: { 
        id: masterSwitchId,
        status: 'APPROVED'
      }
    })

    if (!masterSwitch) {
      return NextResponse.json(
        { error: 'Master switch not found or not approved' },
        { status: 404 }
      )
    }

    // Check if the user switch exists and belongs to the user
    const userSwitch = await prisma.switch.findUnique({
      where: { 
        id: userSwitchId,
        userId: session.user.id
      }
    })

    if (!userSwitch) {
      return NextResponse.json(
        { error: 'Switch not found in your collection' },
        { status: 404 }
      )
    }

    // Check if the switch is already linked to a master switch
    if (userSwitch.masterSwitchId) {
      return NextResponse.json(
        { error: 'This switch is already linked to a master switch' },
        { status: 400 }
      )
    }

    // Move the user's notes to personal notes if they exist
    const personalNotes = userSwitch.notes ? 
      `${userSwitch.personalNotes ? userSwitch.personalNotes + '\n\n' : ''}Previous notes: ${userSwitch.notes}` : 
      userSwitch.personalNotes

    // Update the user switch to link it to the master switch
    // This will override all details with master switch data
    const updatedSwitch = await prisma.switch.update({
      where: { id: userSwitchId },
      data: {
        masterSwitchId: masterSwitchId,
        name: masterSwitch.name,
        chineseName: masterSwitch.chineseName,
        type: masterSwitch.type,
        technology: masterSwitch.technology,
        manufacturer: masterSwitch.manufacturer,
        actuationForce: masterSwitch.actuationForce,
        bottomOutForce: masterSwitch.bottomOutForce,
        preTravel: masterSwitch.preTravel,
        bottomOut: masterSwitch.bottomOut,
        springWeight: masterSwitch.springWeight,
        springLength: masterSwitch.springLength,
        topHousing: masterSwitch.topHousing,
        bottomHousing: masterSwitch.bottomHousing,
        stem: masterSwitch.stem,
        notes: masterSwitch.notes,
        personalNotes: personalNotes,
        // Magnetic properties
        magnetOrientation: masterSwitch.magnetOrientation,
        magnetPosition: masterSwitch.magnetPosition,
        magnetPolarity: masterSwitch.magnetPolarity,
        initialForce: masterSwitch.initialForce,
        initialMagneticFlux: masterSwitch.initialMagneticFlux,
        bottomOutMagneticFlux: masterSwitch.bottomOutMagneticFlux,
        pcbThickness: masterSwitch.pcbThickness,
        compatibility: masterSwitch.compatibility,
        // Reset modified fields since we're syncing with master
        isModified: false,
        modifiedFields: [],
        masterSwitchVersion: masterSwitch.version
      }
    })

    // If master switch has an imageUrl, create a linked image for the user's switch
    if (masterSwitch.imageUrl) {
      // Check if this image URL already exists for this switch
      const existingImage = await prisma.switchImage.findFirst({
        where: {
          switchId: userSwitchId,
          url: masterSwitch.imageUrl
        }
      })

      if (!existingImage) {
        const switchImage = await prisma.switchImage.create({
          data: {
            switchId: userSwitchId,
            url: masterSwitch.imageUrl,
            type: 'LINKED',
            order: 0
          }
        })

        // Set as primary image if no primary image exists
        const switchWithImages = await prisma.switch.findUnique({
          where: { id: userSwitchId },
          select: { primaryImageId: true }
        })

        if (!switchWithImages?.primaryImageId) {
          await prisma.switch.update({
            where: { id: userSwitchId },
            data: { primaryImageId: switchImage.id }
          })
        }
      }
    }

    return NextResponse.json({
      message: 'Switch successfully linked to master switch',
      switchId: updatedSwitch.id
    })

  } catch (error) {
    console.error('Error linking switch:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to link switch' },
      { status: 500 }
    )
  }
}