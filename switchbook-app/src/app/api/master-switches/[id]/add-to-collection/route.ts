import { quantitySchema } from '@/lib/validation'
import { z } from 'zod'
import { copyMasterFields } from '@/lib/master-switch-modifications'
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

    const text = await request.text()
    let body: unknown
    try { body = text ? JSON.parse(text) : {} } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const { quantity } = z.object({ quantity: quantitySchema }).parse(body)
    const { id } = await params
    
    // Get the master switch with its linked images
    const masterSwitch = await prisma.masterSwitch.findFirst({
      where: {
        id: id,
        status: MasterSwitchStatus.APPROVED
      },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
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
          quantity,
          // Copy all fields from master switch
          ...copyMasterFields(masterSwitch),
          
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

    // Copy master switch images to the user's switch
    if (masterSwitch.images && masterSwitch.images.length > 0) {
      // Create linked images for all master switch images
      const imageCreates = masterSwitch.images.map((image, index) => 
        prisma.switchImage.create({
          data: {
            switchId: newSwitch.id,
            url: image.url,
            type: image.type,
            order: index,
            caption: image.caption,
            altText: image.altText, remoteUrl: image.remoteUrl, sourceUrl: image.sourceUrl,
            sourceName: image.sourceName, license: image.license, attribution: image.attribution,
            width: image.width,
            height: image.height,
            size: image.size
          }
        })
      )
      
      const createdImages = await Promise.all(imageCreates)
      
      // Set the first image as primary
      if (createdImages[0]) {
        await prisma.switch.update({
          where: { id: newSwitch.id },
          data: { primaryImageId: createdImages[0].id }
        })
      }
    } else if (masterSwitch.imageUrl) {
      // Fallback to imageUrl if no images are linked
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
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    console.error('Error adding master switch to collection:', error)
    return NextResponse.json(
      { error: 'Failed to add switch to collection' },
      { status: 500 }
    )
  }
}
