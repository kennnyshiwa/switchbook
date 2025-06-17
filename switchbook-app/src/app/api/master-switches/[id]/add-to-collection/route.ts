import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MasterSwitchStatus } from '@prisma/client'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the master switch
    const masterSwitch = await prisma.masterSwitch.findFirst({
      where: {
        id: params.id,
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
        masterSwitchId: params.id
      }
    })

    if (existingSwitch) {
      return NextResponse.json(
        { error: 'Switch already in your collection', switchId: existingSwitch.id },
        { status: 400 }
      )
    }

    // Create the switch in user's collection
    const newSwitch = await prisma.switch.create({
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
        bottomOutForce: masterSwitch.bottomOutForce,
        preTravel: masterSwitch.preTravel,
        bottomOut: masterSwitch.bottomOut,
        manufacturer: masterSwitch.manufacturer,
        notes: masterSwitch.notes,
        imageUrl: masterSwitch.imageUrl,
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