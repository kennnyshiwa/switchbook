import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get the user's switch
    const userSwitch = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        masterSwitch: true,
      }
    })

    if (!userSwitch) {
      return NextResponse.json(
        { error: 'Switch not found' },
        { status: 404 }
      )
    }

    if (!userSwitch.masterSwitchId || !userSwitch.masterSwitch) {
      return NextResponse.json(
        { error: 'This switch is not linked to a master switch' },
        { status: 400 }
      )
    }

    // Update the user's switch with master switch data
    const updatedSwitch = await prisma.switch.update({
      where: { id },
      data: {
        name: userSwitch.masterSwitch.name,
        chineseName: userSwitch.masterSwitch.chineseName,
        type: userSwitch.masterSwitch.type,
        technology: userSwitch.masterSwitch.technology,
        magnetOrientation: userSwitch.masterSwitch.magnetOrientation,
        magnetPosition: userSwitch.masterSwitch.magnetPosition,
        magnetPolarity: userSwitch.masterSwitch.magnetPolarity,
        initialForce: userSwitch.masterSwitch.initialForce,
        initialMagneticFlux: userSwitch.masterSwitch.initialMagneticFlux,
        bottomOutMagneticFlux: userSwitch.masterSwitch.bottomOutMagneticFlux,
        pcbThickness: userSwitch.masterSwitch.pcbThickness,
        compatibility: userSwitch.masterSwitch.compatibility,
        springWeight: userSwitch.masterSwitch.springWeight,
        springLength: userSwitch.masterSwitch.springLength,
        actuationForce: userSwitch.masterSwitch.actuationForce,
        bottomOutForce: userSwitch.masterSwitch.bottomOutForce,
        preTravel: userSwitch.masterSwitch.preTravel,
        bottomOut: userSwitch.masterSwitch.bottomOut,
        manufacturer: userSwitch.masterSwitch.manufacturer,
        notes: userSwitch.masterSwitch.notes,
        topHousing: userSwitch.masterSwitch.topHousing,
        bottomHousing: userSwitch.masterSwitch.bottomHousing,
        stem: userSwitch.masterSwitch.stem,
        tactileForce: userSwitch.masterSwitch.tactileForce,
        tactilePosition: userSwitch.masterSwitch.tactilePosition,
        progressiveSpring: userSwitch.masterSwitch.progressiveSpring,
        doubleStage: userSwitch.masterSwitch.doubleStage,
        clickType: userSwitch.masterSwitch.clickType,
        imageUrl: userSwitch.masterSwitch.imageUrl,
        // Reset tracking fields
        isModified: false,
        modifiedFields: [],
        masterSwitchVersion: userSwitch.masterSwitch.version,
      }
    })

    // Sync master switch imageUrl if it exists
    if (userSwitch.masterSwitch.imageUrl) {
      // Check if this image URL already exists for this switch
      const existingImage = await prisma.switchImage.findFirst({
        where: {
          switchId: id,
          url: userSwitch.masterSwitch.imageUrl
        }
      })

      if (!existingImage) {
        const switchImage = await prisma.switchImage.create({
          data: {
            switchId: id,
            url: userSwitch.masterSwitch.imageUrl,
            type: 'LINKED',
            order: 0
          }
        })

        // Set as primary image if no primary image exists
        const switchWithImages = await prisma.switch.findUnique({
          where: { id },
          select: { primaryImageId: true }
        })

        if (!switchWithImages?.primaryImageId) {
          await prisma.switch.update({
            where: { id },
            data: { primaryImageId: switchImage.id }
          })
        }
      }
    }

    return NextResponse.json({
      message: 'Switch synced with master database',
      switch: updatedSwitch
    })

  } catch (error) {
    console.error('Error syncing switch:', error)
    return NextResponse.json(
      { error: 'Failed to sync switch' },
      { status: 500 }
    )
  }
}

// GET endpoint to check if switch has updates available
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get the user's switch with master switch data
    const userSwitch = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        masterSwitch: {
          select: {
            id: true,
            name: true,
            chineseName: true,
            type: true,
            technology: true,
            manufacturer: true,
            actuationForce: true,
            bottomOutForce: true,
            preTravel: true,
            bottomOut: true,
            springWeight: true,
            springLength: true,
            notes: true,
            topHousing: true,
            bottomHousing: true,
            stem: true,
            magnetOrientation: true,
            magnetPosition: true,
            magnetPolarity: true,
            initialForce: true,
            initialMagneticFlux: true,
            bottomOutMagneticFlux: true,
            pcbThickness: true,
            compatibility: true,
            tactileForce: true,
            tactilePosition: true,
            progressiveSpring: true,
            doubleStage: true,
            clickType: true,
            imageUrl: true,
            version: true,
            lastModifiedAt: true,
          }
        },
      }
    })

    if (!userSwitch) {
      return NextResponse.json(
        { error: 'Switch not found' },
        { status: 404 }
      )
    }

    if (!userSwitch.masterSwitchId || !userSwitch.masterSwitch) {
      return NextResponse.json({
        hasUpdates: false,
        isLinkedToMaster: false,
      })
    }

    // Check if master switch has been updated
    const hasUpdates = userSwitch.masterSwitchVersion !== null && 
                      userSwitch.masterSwitchVersion < userSwitch.masterSwitch.version

    // Calculate differences if there are updates
    const differences: Record<string, { current: any; master: any }> = {}
    if (hasUpdates) {
      const masterSwitch = userSwitch.masterSwitch
      const fieldsToCheck = [
        'name', 'chineseName', 'type', 'technology', 'manufacturer',
        'actuationForce', 'bottomOutForce', 'preTravel', 'bottomOut',
        'springWeight', 'springLength', 'notes',
        'topHousing', 'bottomHousing', 'stem',
        'magnetOrientation', 'magnetPosition', 'magnetPolarity',
        'initialForce', 'initialMagneticFlux', 'bottomOutMagneticFlux',
        'pcbThickness', 'compatibility', 'tactileForce', 'tactilePosition',
        'progressiveSpring', 'doubleStage', 'clickType', 'imageUrl'
      ]

      for (const field of fieldsToCheck) {
        const userValue = (userSwitch as any)[field]
        const masterValue = (masterSwitch as any)[field]
        
        if (userValue !== masterValue) {
          differences[field] = {
            current: userValue,
            master: masterValue
          }
        }
      }
    }

    return NextResponse.json({
      hasUpdates,
      isLinkedToMaster: true,
      isModified: userSwitch.isModified,
      masterVersion: userSwitch.masterSwitch.version,
      userVersion: userSwitch.masterSwitchVersion,
      masterLastModified: userSwitch.masterSwitch.lastModifiedAt,
      differences
    })

  } catch (error) {
    console.error('Error checking switch updates:', error)
    return NextResponse.json(
      { error: 'Failed to check updates' },
      { status: 500 }
    )
  }
}