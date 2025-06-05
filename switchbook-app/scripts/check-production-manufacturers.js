const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProductionManufacturers() {
  try {
    console.log('🔍 Checking manufacturer table in production database...\n');

    // Check if manufacturer table exists and count entries
    const manufacturerCount = await prisma.manufacturer.count();
    console.log(`📊 Total manufacturers in table: ${manufacturerCount}\n`);

    if (manufacturerCount > 0) {
      // Show existing manufacturers
      const manufacturers = await prisma.manufacturer.findMany({
        orderBy: { name: 'asc' }
      });

      console.log('📋 Existing manufacturers:');
      manufacturers.forEach((m, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${m.name} (${m.verified ? 'verified' : 'unverified'})`);
        if (m.aliases.length > 0) {
          console.log(`    Aliases: ${m.aliases.join(', ')}`);
        }
      });
    }

    // Check existing switches and their manufacturers
    console.log('\n🔧 Checking switch manufacturers...');
    const switches = await prisma.switch.findMany({
      select: { manufacturer: true },
      where: { manufacturer: { not: null } }
    });

    const manufacturerCounts = {};
    switches.forEach(sw => {
      if (sw.manufacturer && sw.manufacturer.trim()) {
        const name = sw.manufacturer.trim();
        manufacturerCounts[name] = (manufacturerCounts[name] || 0) + 1;
      }
    });

    const sortedManufacturers = Object.entries(manufacturerCounts)
      .sort(([,a], [,b]) => b - a);

    console.log('\n📈 Manufacturers currently used in switches:');
    sortedManufacturers.forEach(([name, count]) => {
      console.log(`• ${name}: ${count} switches`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionManufacturers();