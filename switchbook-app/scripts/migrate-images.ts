import { prisma } from '../src/lib/prisma'

async function migrateExistingImages() {
  console.log('Starting image migration...')
  
  try {
    // Get all switches with imageUrl but no images
    const switchesWithUrls = await prisma.switch.findMany({
      where: {
        imageUrl: { not: null },
        images: { none: {} }
      }
    })
    
    console.log(`Found ${switchesWithUrls.length} switches with imageUrl to migrate`)
    
    let migrated = 0
    let failed = 0
    
    for (const switchItem of switchesWithUrls) {
      try {
        if (!switchItem.imageUrl) continue
        
        // Create a linked image record
        const image = await prisma.switchImage.create({
          data: {
            switchId: switchItem.id,
            url: switchItem.imageUrl,
            type: 'LINKED',
            order: 0,
            caption: null
          }
        })
        
        // Set as primary image
        await prisma.switch.update({
          where: { id: switchItem.id },
          data: { primaryImageId: image.id }
        })
        
        migrated++
        if (migrated % 100 === 0) {
          console.log(`Migrated ${migrated} switches...`)
        }
      } catch (error) {
        console.error(`Failed to migrate switch ${switchItem.id}:`, error)
        failed++
      }
    }
    
    // Also migrate master switches
    const masterSwitchesWithUrls = await prisma.masterSwitch.findMany({
      where: {
        imageUrl: { not: null },
        images: { none: {} }
      }
    })
    
    console.log(`Found ${masterSwitchesWithUrls.length} master switches with imageUrl to migrate`)
    
    for (const masterSwitch of masterSwitchesWithUrls) {
      try {
        if (!masterSwitch.imageUrl) continue
        
        // Create a linked image record
        const image = await prisma.switchImage.create({
          data: {
            masterSwitchId: masterSwitch.id,
            url: masterSwitch.imageUrl,
            type: 'LINKED',
            order: 0,
            caption: null
          }
        })
        
        // Set as primary image
        await prisma.masterSwitch.update({
          where: { id: masterSwitch.id },
          data: { primaryImageId: image.id }
        })
        
        migrated++
      } catch (error) {
        console.error(`Failed to migrate master switch ${masterSwitch.id}:`, error)
        failed++
      }
    }
    
    console.log(`\nMigration complete!`)
    console.log(`Successfully migrated: ${migrated}`)
    console.log(`Failed: ${failed}`)
    
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateExistingImages()