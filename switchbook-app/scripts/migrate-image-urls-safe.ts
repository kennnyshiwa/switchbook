import { prisma } from '../src/lib/prisma'

async function migrateImageUrlsSafely() {
  console.log('Starting safe image URL migration...')
  
  try {
    // Step 1: Migrate Switch imageUrls
    console.log('\n1. Migrating imageUrls from Switch table...')
    
    const switchesWithImageUrl = await prisma.switch.findMany({
      where: {
        imageUrl: { not: null },
        imageUrl: { not: '' }
      },
      include: {
        images: true
      }
    })
    
    console.log(`Found ${switchesWithImageUrl.length} switches with imageUrl`)
    
    let switchesMigrated = 0
    let switchesSkipped = 0
    
    for (const sw of switchesWithImageUrl) {
      // Check if this URL already exists in SwitchImage for this switch
      const existingImage = sw.images.find(img => img.url === sw.imageUrl)
      
      if (existingImage) {
        console.log(`  - Switch ${sw.id}: Image already exists for URL ${sw.imageUrl}`)
        switchesSkipped++
        
        // If no primaryImageId is set, set it to the existing image
        if (!sw.primaryImageId) {
          await prisma.switch.update({
            where: { id: sw.id },
            data: { primaryImageId: existingImage.id }
          })
          console.log(`    Set primaryImageId to ${existingImage.id}`)
        }
      } else {
        // Create new SwitchImage
        const newImage = await prisma.switchImage.create({
          data: {
            switchId: sw.id,
            url: sw.imageUrl,
            type: 'LINKED',
            order: 0
          }
        })
        
        // Update primaryImageId if not set
        if (!sw.primaryImageId) {
          await prisma.switch.update({
            where: { id: sw.id },
            data: { primaryImageId: newImage.id }
          })
        }
        
        console.log(`  - Switch ${sw.id}: Created new image ${newImage.id}`)
        switchesMigrated++
      }
    }
    
    console.log(`Switches: ${switchesMigrated} migrated, ${switchesSkipped} skipped (already existed)`)
    
    // Step 2: Migrate MasterSwitch imageUrls
    console.log('\n2. Migrating imageUrls from MasterSwitch table...')
    
    const masterSwitchesWithImageUrl = await prisma.masterSwitch.findMany({
      where: {
        imageUrl: { not: null },
        imageUrl: { not: '' }
      },
      include: {
        images: true
      }
    })
    
    console.log(`Found ${masterSwitchesWithImageUrl.length} master switches with imageUrl`)
    
    let masterSwitchesMigrated = 0
    let masterSwitchesSkipped = 0
    
    for (const ms of masterSwitchesWithImageUrl) {
      // Check if this URL already exists in SwitchImage for this master switch
      const existingImage = ms.images.find(img => img.url === ms.imageUrl)
      
      if (existingImage) {
        console.log(`  - MasterSwitch ${ms.id}: Image already exists for URL ${ms.imageUrl}`)
        masterSwitchesSkipped++
        
        // If no primaryImageId is set, set it to the existing image
        if (!ms.primaryImageId) {
          await prisma.masterSwitch.update({
            where: { id: ms.id },
            data: { primaryImageId: existingImage.id }
          })
          console.log(`    Set primaryImageId to ${existingImage.id}`)
        }
      } else {
        // Create new SwitchImage
        const newImage = await prisma.switchImage.create({
          data: {
            masterSwitchId: ms.id,
            url: ms.imageUrl,
            type: 'LINKED',
            order: 0
          }
        })
        
        // Update primaryImageId if not set
        if (!ms.primaryImageId) {
          await prisma.masterSwitch.update({
            where: { id: ms.id },
            data: { primaryImageId: newImage.id }
          })
        }
        
        console.log(`  - MasterSwitch ${ms.id}: Created new image ${newImage.id}`)
        masterSwitchesMigrated++
      }
    }
    
    console.log(`Master switches: ${masterSwitchesMigrated} migrated, ${masterSwitchesSkipped} skipped (already existed)`)
    
    // Summary
    console.log('\n3. Migration Summary:')
    console.log(`Total switches processed: ${switchesWithImageUrl.length}`)
    console.log(`  - New images created: ${switchesMigrated}`)
    console.log(`  - Skipped (already existed): ${switchesSkipped}`)
    console.log(`Total master switches processed: ${masterSwitchesWithImageUrl.length}`)
    console.log(`  - New images created: ${masterSwitchesMigrated}`)
    console.log(`  - Skipped (already existed): ${masterSwitchesSkipped}`)
    
    console.log('\nMigration complete!')
    
  } catch (error) {
    console.error('Error during migration:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateImageUrlsSafely()