const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateManufacturers() {
  try {
    console.log('🔄 Starting manufacturer migration...\n');

    // Step 1: Create canonical manufacturers in the Manufacturer table
    const canonicalManufacturers = [
      { name: 'Gateron', aliases: ['gateron'] },
      { name: 'BSUN', aliases: ['bsun'] },
      { name: 'Kailh', aliases: ['kailh'] },
      { name: 'Haimu', aliases: ['haimu'] },
      { name: 'JWICK', aliases: ['jwick'] },
      { name: 'Cherry', aliases: ['cherry'] },
      { name: 'Tecsee', aliases: ['tecsee'] },
      { name: 'Leobog', aliases: ['leobog'] },
      { name: 'TTC', aliases: [] },
      { name: 'gaote', aliases: [] },
      { name: 'hejin', aliases: [] },
      { name: 'Outemu', aliases: [] },
      { name: 'raesha', aliases: [] },
      { name: 'HMX', aliases: [] },
      { name: 'Keygeek', aliases: [] },
      { name: 'Jerrzi', aliases: [] },
      { name: 'huannuo', aliases: [] },
      { name: 'Grain Gold', aliases: [] },
      { name: 'SWK (Swikeys)', aliases: ['swk'] },
      { name: 'LCET', aliases: [] },
      { name: 'dareu', aliases: [] },
      { name: 'Lichicx', aliases: [] },
      { name: 'Huano', aliases: [] },
      { name: 'Duhuk Lumia', aliases: [] },
      { name: 'KTT', aliases: [] },
      { name: 'Jixian', aliases: [] },
    ];

    console.log('📝 Creating canonical manufacturers...');
    for (const manufacturer of canonicalManufacturers) {
      try {
        await prisma.manufacturer.create({
          data: {
            name: manufacturer.name,
            aliases: manufacturer.aliases,
            verified: true, // Mark as verified since these are from existing data
          }
        });
        console.log(`✅ Created: ${manufacturer.name}`);
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`ℹ️  Already exists: ${manufacturer.name}`);
        } else {
          throw error;
        }
      }
    }

    // Step 2: Update switches to use canonical manufacturer names
    console.log('\n🔧 Updating switch manufacturer references...');
    
    const manufacturerMappings = {
      'gateron': 'Gateron',
      'Gateron': 'Gateron',
      'bsun': 'BSUN',
      'BSUN': 'BSUN',
      'kailh': 'Kailh',
      'Kailh': 'Kailh',
      'haimu': 'Haimu',
      'Haimu': 'Haimu',
      'jwick': 'JWICK',
      'JWICK': 'JWICK',
      'cherry': 'Cherry',
      'Cherry': 'Cherry',
      'tecsee': 'Tecsee',
      'Tecsee': 'Tecsee',
      'leobog': 'Leobog',
      'Leobog': 'Leobog',
      'swk': 'SWK (Swikeys)',
      'SWK (Swikeys)': 'SWK (Swikeys)',
    };

    let updateCount = 0;
    for (const [oldName, newName] of Object.entries(manufacturerMappings)) {
      const result = await prisma.switch.updateMany({
        where: { manufacturer: oldName },
        data: { manufacturer: newName }
      });
      
      if (result.count > 0) {
        console.log(`📝 Updated ${result.count} switches: "${oldName}" → "${newName}"`);
        updateCount += result.count;
      }
    }

    // Step 3: Handle special cases (multi-manufacturer entries)
    console.log('\n⚠️  Special cases that need manual review:');
    const specialCases = await prisma.switch.findMany({
      where: {
        manufacturer: {
          contains: ','
        }
      },
      select: {
        id: true,
        name: true,
        manufacturer: true
      }
    });

    specialCases.forEach(sw => {
      console.log(`• ${sw.name}: "${sw.manufacturer}"`);
    });

    // Step 4: Handle unknown/null manufacturers
    const unknownSwitches = await prisma.switch.findMany({
      where: {
        OR: [
          { manufacturer: null },
          { manufacturer: '' },
          { manufacturer: '?' }
        ]
      },
      select: {
        id: true,
        name: true,
        manufacturer: true
      }
    });

    if (unknownSwitches.length > 0) {
      console.log('\n❓ Switches with unknown/missing manufacturers:');
      unknownSwitches.forEach(sw => {
        console.log(`• ${sw.name}: "${sw.manufacturer || '[NULL]'}"`);
      });
    }

    console.log(`\n✅ Migration completed! Updated ${updateCount} switches.`);
    console.log('🔍 Check the admin panel at /admin/manufacturers to review the results.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateManufacturers();