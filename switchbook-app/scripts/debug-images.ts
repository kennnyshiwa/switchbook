import { prisma } from '../src/lib/prisma'

async function debugImages() {
  console.log('Checking image data...')
  
  try {
    // Check a few switches with images
    const switchesWithImages = await prisma.switch.findMany({
      where: {
        images: { some: {} }
      },
      take: 5,
      include: {
        images: true
      }
    })
    
    console.log(`\nFound ${switchesWithImages.length} switches with images:`)
    
    for (const sw of switchesWithImages) {
      console.log(`\nSwitch: ${sw.name}`)
      console.log(`  Original imageUrl: ${sw.imageUrl}`)
      console.log(`  Primary image ID: ${sw.primaryImageId}`)
      console.log(`  Images (${sw.images.length}):`)
      
      for (const img of sw.images) {
        console.log(`    - ID: ${img.id}`)
        console.log(`      URL: ${img.url}`)
        console.log(`      Type: ${img.type}`)
        console.log(`      Order: ${img.order}`)
      }
    }
    
    // Check switches that still have imageUrl but no images
    const switchesWithUrlNoImages = await prisma.switch.findMany({
      where: {
        imageUrl: { not: null },
        images: { none: {} }
      },
      take: 5
    })
    
    console.log(`\n\nFound ${switchesWithUrlNoImages.length} switches with imageUrl but no images:`)
    for (const sw of switchesWithUrlNoImages) {
      console.log(`  - ${sw.name}: ${sw.imageUrl}`)
    }
    
    // Check total counts
    const totalSwitches = await prisma.switch.count()
    const switchesWithImageUrl = await prisma.switch.count({
      where: { imageUrl: { not: null } }
    })
    const switchesWithImagesCount = await prisma.switch.count({
      where: { images: { some: {} } }
    })
    
    console.log(`\n\nStatistics:`)
    console.log(`  Total switches: ${totalSwitches}`)
    console.log(`  Switches with imageUrl: ${switchesWithImageUrl}`)
    console.log(`  Switches with images: ${switchesWithImagesCount}`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugImages()