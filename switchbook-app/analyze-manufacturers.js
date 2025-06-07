const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeManufacturerData() {
  try {
    console.log('🔍 Analyzing manufacturer data consistency...\n');

    // Fetch all switches with manufacturer data
    console.log('📥 Fetching switches with manufacturer data...');
    const switches = await prisma.switch.findMany({
      select: {
        id: true,
        name: true,
        manufacturer: true,
        user: {
          select: {
            username: true
          }
        }
      },
      where: {
        manufacturer: {
          not: null
        }
      }
    });

    console.log(`Found ${switches.length} switches with manufacturer data\n`);

    // Fetch all manufacturers from the manufacturers table
    console.log('📥 Fetching manufacturers from manufacturers table...');
    const manufacturers = await prisma.manufacturer.findMany({
      select: {
        id: true,
        name: true,
        aliases: true,
        verified: true,
        user: {
          select: {
            username: true
          }
        }
      }
    });

    console.log(`Found ${manufacturers.length} manufacturers in manufacturers table\n`);

    // Create a set of all valid manufacturer names (including aliases)
    const validManufacturerNames = new Set();
    const manufacturerMap = new Map();

    manufacturers.forEach(manufacturer => {
      // Add the main name
      validManufacturerNames.add(manufacturer.name.toLowerCase());
      manufacturerMap.set(manufacturer.name.toLowerCase(), {
        id: manufacturer.id,
        name: manufacturer.name,
        verified: manufacturer.verified,
        addedBy: manufacturer.user?.username || 'Unknown'
      });

      // Add all aliases
      manufacturer.aliases.forEach(alias => {
        validManufacturerNames.add(alias.toLowerCase());
        manufacturerMap.set(alias.toLowerCase(), {
          id: manufacturer.id,
          name: manufacturer.name,
          verified: manufacturer.verified,
          addedBy: manufacturer.user?.username || 'Unknown',
          isAlias: true,
          aliasFor: manufacturer.name
        });
      });
    });

    // Extract unique manufacturer names from switches
    const switchManufacturers = new Set();
    const switchManufacturerDetails = new Map();

    switches.forEach(switchItem => {
      if (switchItem.manufacturer) {
        const manufacturerLower = switchItem.manufacturer.toLowerCase();
        switchManufacturers.add(manufacturerLower);
        
        if (!switchManufacturerDetails.has(manufacturerLower)) {
          switchManufacturerDetails.set(manufacturerLower, {
            originalName: switchItem.manufacturer,
            count: 0,
            examples: []
          });
        }
        
        const details = switchManufacturerDetails.get(manufacturerLower);
        details.count++;
        if (details.examples.length < 3) {
          details.examples.push({
            switchName: switchItem.name,
            user: switchItem.user.username
          });
        }
      }
    });

    // Find manufacturers in switches that don't exist in manufacturers table
    const missingManufacturers = [];
    switchManufacturers.forEach(manufacturerLower => {
      if (!validManufacturerNames.has(manufacturerLower)) {
        const details = switchManufacturerDetails.get(manufacturerLower);
        missingManufacturers.push({
          name: details.originalName,
          count: details.count,
          examples: details.examples
        });
      }
    });

    // Display results
    console.log('📊 ANALYSIS RESULTS\n');
    console.log('='.repeat(60));
    
    console.log('\n📈 SUMMARY:');
    console.log(`• Total unique manufacturer names in switches: ${switchManufacturers.size}`);
    console.log(`• Total manufacturers in manufacturers table: ${manufacturers.length}`);
    console.log(`• Valid manufacturer names (including aliases): ${validManufacturerNames.size}`);
    console.log(`• Missing manufacturers: ${missingManufacturers.length}`);

    if (missingManufacturers.length > 0) {
      console.log('\n❌ MANUFACTURERS MISSING FROM MANUFACTURERS TABLE:');
      console.log('-'.repeat(60));
      
      missingManufacturers
        .sort((a, b) => b.count - a.count) // Sort by frequency
        .forEach((manufacturer, index) => {
          console.log(`\n${index + 1}. "${manufacturer.name}"`);
          console.log(`   📊 Used in ${manufacturer.count} switch(es)`);
          console.log(`   📝 Example switches:`);
          manufacturer.examples.forEach(example => {
            console.log(`      • "${example.switchName}" (by ${example.user})`);
          });
        });

      console.log('\n📋 SQL TO ADD MISSING MANUFACTURERS:');
      console.log('-'.repeat(60));
      missingManufacturers.forEach(manufacturer => {
        console.log(`INSERT INTO "Manufacturer" (id, name, verified, "createdAt", "updatedAt") VALUES (gen_random_uuid(), '${manufacturer.name.replace(/'/g, "''")}', false, NOW(), NOW());`);
      });
    } else {
      console.log('\n✅ All manufacturer names in switches exist in the manufacturers table!');
    }

    console.log('\n📋 EXISTING MANUFACTURERS IN TABLE:');
    console.log('-'.repeat(60));
    manufacturers
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((manufacturer, index) => {
        const status = manufacturer.verified ? '✅ Verified' : '⏳ Unverified';
        console.log(`${index + 1}. "${manufacturer.name}" ${status} (added by ${manufacturer.user?.username || 'Unknown'})`);
        if (manufacturer.aliases.length > 0) {
          console.log(`   🏷️  Aliases: ${manufacturer.aliases.map(alias => `"${alias}"`).join(', ')}`);
        }
      });

    console.log('\n' + '='.repeat(60));
    console.log('✨ Analysis complete!');

  } catch (error) {
    console.error('❌ Error analyzing manufacturer data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
analyzeManufacturerData();