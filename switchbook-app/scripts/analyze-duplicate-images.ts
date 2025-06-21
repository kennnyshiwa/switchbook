import { prisma } from '../src/lib/prisma'

async function analyzeDuplicateImages() {
  console.log('Analyzing duplicate images in the database...')
  
  try {
    // Check duplicate images for switches
    console.log('\n1. Analyzing duplicate images for switches...')
    
    const switchDuplicates = await prisma.$queryRaw<Array<{
      switchId: string;
      switchName: string;
      url: string;
      count: bigint;
      imageIds: string[];
    }>>`
      SELECT 
        si."switchId",
        s."name" as "switchName",
        si."url",
        COUNT(*) as count,
        ARRAY_AGG(si."id" ORDER BY si."uploadedAt" ASC) as "imageIds"
      FROM "SwitchImage" si
      JOIN "Switch" s ON s."id" = si."switchId"
      WHERE si."switchId" IS NOT NULL
      GROUP BY si."switchId", s."name", si."url"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `
    
    if (switchDuplicates.length > 0) {
      console.log(`Found ${switchDuplicates.length} duplicate image groups for switches:`)
      for (const dup of switchDuplicates.slice(0, 10)) { // Show first 10
        console.log(`  - Switch "${dup.switchName}" (${dup.switchId}): ${Number(dup.count)} copies of ${dup.url}`)
      }
      if (switchDuplicates.length > 10) {
        console.log(`  ... and ${switchDuplicates.length - 10} more`)
      }
    } else {
      console.log('No duplicate images found for switches.')
    }
    
    // Check duplicate images for master switches
    console.log('\n2. Analyzing duplicate images for master switches...')
    
    const masterSwitchDuplicates = await prisma.$queryRaw<Array<{
      masterSwitchId: string;
      masterSwitchName: string;
      url: string;
      count: bigint;
      imageIds: string[];
    }>>`
      SELECT 
        si."masterSwitchId",
        ms."name" as "masterSwitchName",
        si."url",
        COUNT(*) as count,
        ARRAY_AGG(si."id" ORDER BY si."uploadedAt" ASC) as "imageIds"
      FROM "SwitchImage" si
      JOIN "MasterSwitch" ms ON ms."id" = si."masterSwitchId"
      WHERE si."masterSwitchId" IS NOT NULL
      GROUP BY si."masterSwitchId", ms."name", si."url"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `
    
    if (masterSwitchDuplicates.length > 0) {
      console.log(`Found ${masterSwitchDuplicates.length} duplicate image groups for master switches:`)
      for (const dup of masterSwitchDuplicates.slice(0, 10)) { // Show first 10
        console.log(`  - MasterSwitch "${dup.masterSwitchName}" (${dup.masterSwitchId}): ${Number(dup.count)} copies of ${dup.url}`)
      }
      if (masterSwitchDuplicates.length > 10) {
        console.log(`  ... and ${masterSwitchDuplicates.length - 10} more`)
      }
    } else {
      console.log('No duplicate images found for master switches.')
    }
    
    // Summary statistics
    console.log('\n3. Summary statistics:')
    
    const totalImages = await prisma.switchImage.count()
    const switchImages = await prisma.switchImage.count({
      where: { switchId: { not: null } }
    })
    const masterSwitchImages = await prisma.switchImage.count({
      where: { masterSwitchId: { not: null } }
    })
    
    console.log(`Total images in database: ${totalImages}`)
    console.log(`Images linked to switches: ${switchImages}`)
    console.log(`Images linked to master switches: ${masterSwitchImages}`)
    
    // Calculate total duplicate images
    const totalDuplicateImagesSwitch = switchDuplicates.reduce((sum, dup) => sum + (Number(dup.count) - 1), 0)
    const totalDuplicateImagesMaster = masterSwitchDuplicates.reduce((sum, dup) => sum + (Number(dup.count) - 1), 0)
    
    console.log(`\nTotal duplicate images that could be removed:`)
    console.log(`  - From switches: ${totalDuplicateImagesSwitch}`)
    console.log(`  - From master switches: ${totalDuplicateImagesMaster}`)
    console.log(`  - Total: ${totalDuplicateImagesSwitch + totalDuplicateImagesMaster}`)
    
  } catch (error) {
    console.error('Error analyzing duplicates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the analysis
analyzeDuplicateImages()