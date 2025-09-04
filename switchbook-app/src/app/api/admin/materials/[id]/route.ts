import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { name, active, order } = body

    // First get the current material to know the old name
    const currentMaterial = await prisma.material.findUnique({
      where: { id }
    })

    if (!currentMaterial) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      )
    }

    // Update the material
    const material = await prisma.material.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(active !== undefined && { active }),
        ...(order !== undefined && { order })
      }
    })

    // If the name changed, cascade update all switches
    if (name && name !== currentMaterial.name) {
      const oldName = currentMaterial.name
      
      // Update all master switches with this material
      const masterSwitchUpdates = await prisma.$transaction([
        prisma.masterSwitch.updateMany({
          where: { topHousing: oldName },
          data: { topHousing: name }
        }),
        prisma.masterSwitch.updateMany({
          where: { bottomHousing: oldName },
          data: { bottomHousing: name }
        }),
        prisma.masterSwitch.updateMany({
          where: { stem: oldName },
          data: { stem: name }
        })
      ])

      // Update all user switches with this material
      const userSwitchUpdates = await prisma.$transaction([
        prisma.switch.updateMany({
          where: { topHousing: oldName },
          data: { topHousing: name }
        }),
        prisma.switch.updateMany({
          where: { bottomHousing: oldName },
          data: { bottomHousing: name }
        }),
        prisma.switch.updateMany({
          where: { stem: oldName },
          data: { stem: name }
        })
      ])

      const totalUpdated = 
        masterSwitchUpdates.reduce((sum, result) => sum + result.count, 0) +
        userSwitchUpdates.reduce((sum, result) => sum + result.count, 0)

      console.log(`Material name updated from "${oldName}" to "${name}". Updated ${totalUpdated} switch records.`)
      
      return NextResponse.json({
        ...material,
        cascadeUpdate: {
          oldName,
          newName: name,
          totalUpdated
        }
      })
    }

    return NextResponse.json(material)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Material name already exists' },
        { status: 400 }
      )
    }
    
    console.error('Failed to update material:', error)
    return NextResponse.json(
      { error: 'Failed to update material' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    
    // Soft delete by setting active to false
    await prisma.material.update({
      where: { id },
      data: { active: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete material:', error)
    return NextResponse.json(
      { error: 'Failed to delete material' },
      { status: 500 }
    )
  }
}