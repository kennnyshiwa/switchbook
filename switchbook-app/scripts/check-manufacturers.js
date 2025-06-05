const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkManufacturers() {
  try {
    console.log('🔍 Analyzing manufacturer data in Switch table...\n');

    // Get all switches with their manufacturer field
    const switches = await prisma.switch.findMany({
      select: {
        id: true,
        name: true,
        manufacturer: true,
      },
    });

    console.log(`📊 Total switches in database: ${switches.length}\n`);

    // Count switches by manufacturer (including null/empty)
    const manufacturerCounts = {};
    const caseVariations = new Set();

    switches.forEach(switch_ => {
      const manufacturer = switch_.manufacturer;
      
      if (!manufacturer || manufacturer.trim() === '') {
        manufacturerCounts['[NULL/EMPTY]'] = (manufacturerCounts['[NULL/EMPTY]'] || 0) + 1;
      } else {
        const trimmed = manufacturer.trim();
        manufacturerCounts[trimmed] = (manufacturerCounts[trimmed] || 0) + 1;
        caseVariations.add(trimmed);
      }
    });

    // Sort manufacturers by count (descending)
    const sortedManufacturers = Object.entries(manufacturerCounts)
      .sort(([,a], [,b]) => b - a);

    console.log('📈 Manufacturer usage counts:');
    console.log('─'.repeat(50));
    sortedManufacturers.forEach(([manufacturer, count]) => {
      const percentage = ((count / switches.length) * 100).toFixed(1);
      console.log(`${manufacturer.padEnd(25)} | ${count.toString().padStart(4)} switches (${percentage}%)`);
    });

    // Check for potential case variations
    console.log('\n🔤 Checking for case variations...');
    console.log('─'.repeat(50));
    
    const lowercaseMap = {};
    const variations = [];
    
    Array.from(caseVariations).forEach(manufacturer => {
      const lowercase = manufacturer.toLowerCase();
      if (!lowercaseMap[lowercase]) {
        lowercaseMap[lowercase] = [];
      }
      lowercaseMap[lowercase].push(manufacturer);
    });

    Object.entries(lowercaseMap).forEach(([lowercase, variants]) => {
      if (variants.length > 1) {
        variations.push({
          base: lowercase,
          variants: variants,
          totalCount: variants.reduce((sum, variant) => sum + manufacturerCounts[variant], 0)
        });
      }
    });

    if (variations.length > 0) {
      console.log('Found potential case variations:');
      variations.forEach(({ base, variants, totalCount }) => {
        console.log(`\n• "${base}" variations (${totalCount} total switches):`);
        variants.forEach(variant => {
          console.log(`  - "${variant}" (${manufacturerCounts[variant]} switches)`);
        });
      });
    } else {
      console.log('No case variations detected.');
    }

    // Show unique manufacturers (excluding null/empty)
    const uniqueManufacturers = Array.from(caseVariations).sort();
    console.log(`\n📋 Unique manufacturers (${uniqueManufacturers.length} total):`);
    console.log('─'.repeat(50));
    uniqueManufacturers.forEach((manufacturer, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${manufacturer}`);
    });

    // Show some example switches for each manufacturer
    console.log('\n🔧 Sample switches by manufacturer:');
    console.log('─'.repeat(50));
    
    for (const manufacturer of uniqueManufacturers.slice(0, 5)) { // Show top 5
      const examples = switches
        .filter(s => s.manufacturer && s.manufacturer.trim() === manufacturer)
        .slice(0, 3) // Show up to 3 examples
        .map(s => s.name);
      
      console.log(`${manufacturer}:`);
      examples.forEach(name => console.log(`  • ${name}`));
      if (manufacturerCounts[manufacturer] > 3) {
        console.log(`  ... and ${manufacturerCounts[manufacturer] - 3} more`);
      }
      console.log();
    }

  } catch (error) {
    console.error('❌ Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkManufacturers();