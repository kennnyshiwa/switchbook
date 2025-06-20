import { prisma } from '../src/lib/prisma'

async function checkPrimaryImages() {
  console.log('Checking primary image IDs...')
  
  try {
    // Check switches with images but no primaryImageId
    const switchesWithImagesNoPrimary = await prisma.switch.findMany({
      where: {
        images: { some: {} },
        primaryImageId: null
      },
      include: {
        images: {
          orderBy: { order: 'asc' },
          take: 1
        }
      }
    })
    
    console.log(`Found ${switchesWithImagesNoPrimary.length} switches with images but no primaryImageId`)
    
    if (switchesWithImagesNoPrimary.length > 0) {
      console.log('\nFixing missing primaryImageId...')
      
      for (const sw of switchesWithImagesNoPrimary) {
        if (sw.images.length > 0) {
          await prisma.switch.update({
            where: { id: sw.id },
            data: { primaryImageId: sw.images[0].id }
          })
        }
      }
      
      console.log('Fixed!')
    }
    
    // Check if there are any orphaned primaryImageIds
    const switchesWithInvalidPrimary = await prisma.switch.findMany({
      where: {
        primaryImageId: { not: null },
        images: { none: {} }
      }
    })
    
    console.log(`\nFound ${switchesWithInvalidPrimary.length} switches with invalid primaryImageId`)
    
    if (switchesWithInvalidPrimary.length > 0) {
      console.log('Clearing invalid primaryImageIds...')
      
      await prisma.switch.updateMany({
        where: {
          id: { in: switchesWithInvalidPrimary.map(s => s.id) }
        },
        data: { primaryImageId: null }
      })
      
      console.log('Cleared!')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPrimaryImages()