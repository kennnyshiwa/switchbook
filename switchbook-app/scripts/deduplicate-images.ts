import { prisma } from '../src/lib/prisma'

async function deduplicateImages() {
  console.log('Starting image deduplication process...')
  
  try {
    // First, let's analyze the duplicate situation
    console.log('\n1. Analyzing duplicate images...')
    
    // Find switches with duplicate images
    const switchesWithDuplicates = await prisma.$queryRaw<Array<{
      switchId: string;
      url: string;
      count: bigint;
      imageIds: string[];
    }>>`
      SELECT 
        "switchId",
        "url",
        COUNT(*) as count,
        ARRAY_AGG("id" ORDER BY "uploadedAt" ASC) as "imageIds"
      FROM "SwitchImage"
      WHERE "switchId" IS NOT NULL
      GROUP BY "switchId", "url"
      HAVING COUNT(*) > 1
    `
    
    console.log(`Found ${switchesWithDuplicates.length} duplicate image groups for switches`)
    
    // Find master switches with duplicate images
    const masterSwitchesWithDuplicates = await prisma.$queryRaw<Array<{
      masterSwitchId: string;
      url: string;
      count: bigint;
      imageIds: string[];
    }>>`
      SELECT 
        "masterSwitchId",
        "url",
        COUNT(*) as count,
        ARRAY_AGG("id" ORDER BY "uploadedAt" ASC) as "imageIds"
      FROM "SwitchImage"
      WHERE "masterSwitchId" IS NOT NULL
      GROUP BY "masterSwitchId", "url"
      HAVING COUNT(*) > 1
    `
    
    console.log(`Found ${masterSwitchesWithDuplicates.length} duplicate image groups for master switches`)
    
    // Process regular switches
    if (switchesWithDuplicates.length > 0) {
      console.log('\n2. Processing duplicate images for switches...')
      
      for (const group of switchesWithDuplicates) {
        const [keepId, ...deleteIds] = group.imageIds
        
        console.log(`  - Switch ${group.switchId}: keeping ${keepId}, deleting ${deleteIds.length} duplicates of URL: ${group.url}`)
        
        // Check if the switch's primaryImageId is one of the duplicates we're about to delete
        const switchData = await prisma.switch.findUnique({
          where: { id: group.switchId },
          select: { primaryImageId: true }
        })
        
        if (switchData?.primaryImageId && deleteIds.includes(switchData.primaryImageId)) {
          // Update primaryImageId to the image we're keeping
          await prisma.switch.update({
            where: { id: group.switchId },
            data: { primaryImageId: keepId }
          })
          console.log(`    Updated primaryImageId from ${switchData.primaryImageId} to ${keepId}`)
        }
        
        // Delete the duplicate images
        await prisma.switchImage.deleteMany({
          where: { id: { in: deleteIds } }
        })
      }
    }
    
    // Process master switches
    if (masterSwitchesWithDuplicates.length > 0) {
      console.log('\n3. Processing duplicate images for master switches...')
      
      for (const group of masterSwitchesWithDuplicates) {
        const [keepId, ...deleteIds] = group.imageIds
        
        console.log(`  - MasterSwitch ${group.masterSwitchId}: keeping ${keepId}, deleting ${deleteIds.length} duplicates of URL: ${group.url}`)
        
        // Check if the master switch's primaryImageId is one of the duplicates we're about to delete
        const masterSwitchData = await prisma.masterSwitch.findUnique({
          where: { id: group.masterSwitchId },
          select: { primaryImageId: true }
        })
        
        if (masterSwitchData?.primaryImageId && deleteIds.includes(masterSwitchData.primaryImageId)) {
          // Update primaryImageId to the image we're keeping
          await prisma.masterSwitch.update({
            where: { id: group.masterSwitchId },
            data: { primaryImageId: keepId }
          })
          console.log(`    Updated primaryImageId from ${masterSwitchData.primaryImageId} to ${keepId}`)
        }
        
        // Delete the duplicate images
        await prisma.switchImage.deleteMany({
          where: { id: { in: deleteIds } }
        })
      }
    }
    
    // Final verification
    console.log('\n4. Verifying deduplication...')
    
    const remainingDuplicatesSwitch = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM (
        SELECT "switchId", "url", COUNT(*) as cnt
        FROM "SwitchImage"
        WHERE "switchId" IS NOT NULL
        GROUP BY "switchId", "url"
        HAVING COUNT(*) > 1
      ) as duplicates
    `
    
    const remainingDuplicatesMaster = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM (
        SELECT "masterSwitchId", "url", COUNT(*) as cnt
        FROM "SwitchImage"
        WHERE "masterSwitchId" IS NOT NULL
        GROUP BY "masterSwitchId", "url"
        HAVING COUNT(*) > 1
      ) as duplicates
    `
    
    console.log(`Remaining duplicate groups for switches: ${remainingDuplicatesSwitch[0]?.count || 0}`)
    console.log(`Remaining duplicate groups for master switches: ${remainingDuplicatesMaster[0]?.count || 0}`)
    
    console.log('\nDeduplication complete!')
    
  } catch (error) {
    console.error('Error during deduplication:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the deduplication
deduplicateImages()