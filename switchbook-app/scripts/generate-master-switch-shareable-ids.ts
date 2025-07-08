import { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient()

async function generateShareableIds() {
  try {
    // Find all approved master switches without shareableId
    const approvedSwitches = await prisma.masterSwitch.findMany({
      where: {
        status: 'APPROVED',
        shareableId: null
      }
    })

    console.log(`Found ${approvedSwitches.length} approved switches without shareable IDs`)

    // Update each switch with a unique shareableId
    for (const masterSwitch of approvedSwitches) {
      const shareableId = nanoid(10)
      
      await prisma.masterSwitch.update({
        where: { id: masterSwitch.id },
        data: { shareableId }
      })
      
      console.log(`Generated shareable ID for ${masterSwitch.manufacturer} ${masterSwitch.name}: ${shareableId}`)
    }

    console.log('✅ All shareable IDs generated successfully')
  } catch (error) {
    console.error('Error generating shareable IDs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

generateShareableIds()