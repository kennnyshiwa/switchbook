import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MasterSwitchStatus } from '@prisma/client'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    
    // Get the master switch
    const masterSwitch = await prisma.masterSwitch.findFirst({
      where: {
        id: id,
        status: MasterSwitchStatus.APPROVED
      }
    })

    if (!masterSwitch) {
      return NextResponse.json(
        { error: 'Master switch not found' },
        { status: 404 }
      )
    }

    // Check if user already has this switch
    const existingSwitch = await prisma.switch.findFirst({
      where: {
        userId: session.user.id,
        masterSwitchId: id
      }
    })

    if (existingSwitch) {
      return NextResponse.json(
        { error: 'Switch already in your collection', switchId: existingSwitch.id },
        { status: 400 }
      )
    }

    // Track view - only increment if last view was more than 30 seconds ago
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000)
    
    const recentView = await prisma.masterSwitchView.findFirst({
      where: {
        masterSwitchId: id,
        userId: session.user.id,
        viewedAt: {
          gte: thirtySecondsAgo
        }
      },
      orderBy: {
        viewedAt: 'desc'
      }
    })

    // Use transaction to create switch and track view
    const [newSwitch] = await prisma.$transaction(async (tx) => {
      // Create the switch in user's collection
      const switch_ = await tx.switch.create({
        data: {
          // Copy all fields from master switch
          name: masterSwitch.name,
          chineseName: masterSwitch.chineseName,
          type: masterSwitch.type,
          technology: masterSwitch.technology,
          magnetOrientation: masterSwitch.magnetOrientation,
          magnetPosition: masterSwitch.magnetPosition,
          magnetPolarity: masterSwitch.magnetPolarity,
          initialForce: masterSwitch.initialForce,
          initialMagneticFlux: masterSwitch.initialMagneticFlux,
          bottomOutMagneticFlux: masterSwitch.bottomOutMagneticFlux,
          pcbThickness: masterSwitch.pcbThickness,
          compatibility: masterSwitch.compatibility,
          springWeight: masterSwitch.springWeight,
          springLength: masterSwitch.springLength,
          actuationForce: masterSwitch.actuationForce,
          tactileForce: masterSwitch.tactileForce,
          bottomOutForce: masterSwitch.bottomOutForce,
          progressiveSpring: masterSwitch.progressiveSpring,
          doubleStage: masterSwitch.doubleStage,
          preTravel: masterSwitch.preTravel,
          bottomOut: masterSwitch.bottomOut,
          manufacturer: masterSwitch.manufacturer,
          notes: masterSwitch.notes,
          topHousing: masterSwitch.topHousing,
          bottomHousing: masterSwitch.bottomHousing,
          stem: masterSwitch.stem,
          frankenTop: masterSwitch.frankenTop,
          frankenBottom: masterSwitch.frankenBottom,
          frankenStem: masterSwitch.frankenStem,
          
          // Set master switch reference
          masterSwitchId: masterSwitch.id,
          masterSwitchVersion: masterSwitch.version,
          isModified: false,
          
          // Set user reference
          userId: session.user.id
        }
      })

      // Track view if last view was more than 30 seconds ago
      if (!recentView) {
        await tx.masterSwitchView.create({
          data: {
            masterSwitchId: id,
            userId: session.user.id
          }
        })
        
        await tx.masterSwitch.update({
          where: { id: id },
          data: { viewCount: { increment: 1 } }
        })
      }

      return [switch_]
    })

    // If master switch has an imageUrl, create a linked image for the user's switch
    if (masterSwitch.imageUrl) {
      const switchImage = await prisma.switchImage.create({
        data: {
          switchId: newSwitch.id,
          url: masterSwitch.imageUrl,
          type: 'LINKED',
          order: 0
        }
      })

      // Set as primary image
      await prisma.switch.update({
        where: { id: newSwitch.id },
        data: { primaryImageId: switchImage.id }
      })
    }

    return NextResponse.json({
      message: 'Switch added to your collection',
      switchId: newSwitch.id
    })
  } catch (error) {
    console.error('Error adding master switch to collection:', error)
    return NextResponse.json(
      { error: 'Failed to add switch to collection' },
      { status: 500 }
    )
  }
}