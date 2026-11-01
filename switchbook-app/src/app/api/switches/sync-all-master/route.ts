import { copyMasterFields } from '@/lib/master-switch-modifications'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all user switches that are linked to master switches
    const userSwitches = await prisma.switch.findMany({
      where: {
        userId: session.user.id,
        masterSwitchId: { not: null }
      },
      include: {
        masterSwitch: true
      }
    })

    if (userSwitches.length === 0) {
      return NextResponse.json({ 
        message: 'No switches linked to master database',
        updated: 0 
      })
    }

    let updatedCount = 0
    const updates = []

    for (const userSwitch of userSwitches) {
      if (!userSwitch.masterSwitch) continue

      // Check if the master switch has a newer version
      if (userSwitch.masterSwitchVersion && 
          userSwitch.masterSwitch.version <= userSwitch.masterSwitchVersion) {
        continue // Already up to date
      }

      // Update the switch with master data
      const updateData: any = {
        ...copyMasterFields(userSwitch.masterSwitch),
        masterSwitchVersion: userSwitch.masterSwitch.version,
        isModified: false,
        modifiedFields: []
      }

      await prisma.switch.update({
        where: { id: userSwitch.id },
        data: updateData
      })

      // Sync master switch imageUrl to SwitchImage if it exists
      if (userSwitch.masterSwitch.imageUrl) {
        // Only seed an image-less switch. A switch with its own gallery already
        // shows those photos, and the master primary is often one of them under a
        // rehosted URL, so adding it again duplicates the first image.
        const existingImage = await prisma.switchImage.findFirst({
          where: { switchId: userSwitch.id },
          select: { id: true }
        })

        if (!existingImage) {
          const switchImage = await prisma.switchImage.create({
            data: {
              switchId: userSwitch.id,
              url: userSwitch.masterSwitch.imageUrl,
            type: 'LINKED',
              order: 0
            }
          })

          // Set as primary image if no primary image exists
          const switchWithImages = await prisma.switch.findUnique({
            where: { id: userSwitch.id },
            select: { primaryImageId: true }
          })

          if (!switchWithImages?.primaryImageId) {
            await prisma.switch.update({
              where: { id: userSwitch.id },
              data: { primaryImageId: switchImage.id }
            })
          }
        }
      }

      updates.push({
        id: userSwitch.id,
        previousVersion: userSwitch.masterSwitchVersion || 0,
        name: userSwitch.masterSwitch.name,
        newVersion: userSwitch.masterSwitch.version,
      })

      updatedCount++
    }

    // Record the highest master switch version for dismissal tracking
    const highestVersion = Math.max(...userSwitches
      .map(s => s.masterSwitch?.version || 0)
      .filter(v => v > 0))

    return NextResponse.json({
      message: `Successfully updated ${updatedCount} switches`,
      updated: updatedCount,
      updates,
      highestMasterVersion: highestVersion
    })

  } catch (error) {
    console.error('Error syncing all switches:', error)
    return NextResponse.json(
      { error: 'Failed to sync switches' },
      { status: 500 }
    )
  }
}
