import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all user's switches that are linked to master switches
    const userSwitches = await prisma.switch.findMany({
      where: {
        userId: session.user.id,
        masterSwitchId: { not: null }
      },
      select: {
        id: true,
        name: true,
        masterSwitchId: true,
        masterSwitchVersion: true,
        isModified: true,
        masterSwitch: {
          select: {
            version: true,
            lastModifiedAt: true
          }
        }
      }
    })

    // Check which switches have updates
    const updatesAvailable = []
    let highestMasterVersion = 0

    for (const userSwitch of userSwitches) {
      if (userSwitch.masterSwitch && userSwitch.masterSwitchVersion !== null && 
          userSwitch.masterSwitchVersion < userSwitch.masterSwitch.version) {
        updatesAvailable.push({
          switchId: userSwitch.id,
          switchName: userSwitch.name,
          hasUpdates: true,
          currentVersion: userSwitch.masterSwitchVersion,
          masterVersion: userSwitch.masterSwitch.version
        })
      }
      
      if (userSwitch.masterSwitch && userSwitch.masterSwitch.version > highestMasterVersion) {
        highestMasterVersion = userSwitch.masterSwitch.version
      }
    }

    return NextResponse.json({
      updatesAvailable,
      highestMasterVersion,
      totalSwitchesChecked: userSwitches.length
    })
    
  } catch (error) {
    console.error('Error checking master updates:', error)
    return NextResponse.json(
      { error: 'Failed to check for updates' },
      { status: 500 }
    )
  }
}