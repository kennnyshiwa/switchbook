import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { PERSONAL_NOTES_TOO_LONG_ERROR, SWITCH_NOTES_MAX, SWITCH_PERSONAL_NOTES_MAX } from '@/lib/validation'

// Same limits as switchSchema so the switch stays editable afterwards.
// EditSwitchModal merges notes into personal notes here before linking; an
// over-long merge is rejected (no write) instead of being truncated.
const updateNotesSchema = z.object({
  notes: z.string().max(SWITCH_NOTES_MAX, `Notes cannot exceed ${SWITCH_NOTES_MAX} characters`),
  personalNotes: z.string().max(SWITCH_PERSONAL_NOTES_MAX, PERSONAL_NOTES_TOO_LONG_ERROR)
})

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

    // Update only the notes fields
    const updatedSwitch = await prisma.switch.update({
      where: { id },
      data: {
        notes: validated.notes,
        personalNotes: validated.personalNotes,
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