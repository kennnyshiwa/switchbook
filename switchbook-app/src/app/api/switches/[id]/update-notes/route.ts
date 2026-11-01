import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'
import { computeMasterModifiedFields } from '@/lib/master-switch-modifications'
const updateNotesSchema = switchSchema.pick({ notes: true, personalNotes: true })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    
    // Validate the request body
    const validated = updateNotesSchema.parse(body)

    // Verify the switch belongs to the user
    const existingSwitch = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingSwitch) {
      return NextResponse.json(
        { error: 'Switch not found' },
        { status: 404 }
      )
    }

    const master = existingSwitch.masterSwitchId ? await prisma.masterSwitch.findUnique({ where: { id: existingSwitch.masterSwitchId } }) : null
    const modifiedFields = master ? computeMasterModifiedFields({ ...existingSwitch, ...validated }, master) : []
    // Update only supplied notes fields
    const updatedSwitch = await prisma.switch.update({
      where: { id },
      data: {
        ...validated,
        ...(master ? { modifiedFields, isModified: modifiedFields.length > 0 } : {}),
      },
    })

    return NextResponse.json(updatedSwitch)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating switch notes:', error)
    return NextResponse.json(
      { error: 'Failed to update switch notes' },
      { status: 500 }
    )
  }
}