import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if master switch exists
    const masterSwitch = await prisma.masterSwitch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userSwitches: true,
            edits: true
          }
        }
      }
    })

    if (!masterSwitch) {
      return NextResponse.json({ error: 'Master switch not found' }, { status: 404 })
    }

    // Check if any users have this switch linked
    if (masterSwitch._count.userSwitches > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete master switch. ${masterSwitch._count.userSwitches} user switch(es) are linked to it.`,
          linkedCount: masterSwitch._count.userSwitches
        }, 
        { status: 400 }
      )
    }

    // Check if there are pending edits
    const pendingEdits = await prisma.masterSwitchEdit.count({
      where: {
        masterSwitchId: id,
        status: 'PENDING'
      }
    })

    if (pendingEdits > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete master switch. ${pendingEdits} pending edit(s) exist.`,
          pendingEdits
        }, 
        { status: 400 }
      )
    }

    // Delete all related data in the correct order
    // 1. Delete all switch images
    await prisma.switchImage.deleteMany({
      where: { masterSwitchId: id }
    })

    // 2. Delete all edit history
    await prisma.masterSwitchEdit.deleteMany({
      where: { masterSwitchId: id }
    })

    // 3. Delete the master switch
    await prisma.masterSwitch.delete({
      where: { id }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Master switch deleted successfully'
    })

  } catch (error) {
    console.error('Failed to delete master switch:', error)
    return NextResponse.json(
      { error: 'Failed to delete master switch' },
      { status: 500 }
    )
  }
}