const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function prepareMigrationData() {
  try {
    console.log('🚀 Preparing manufacturer migration data...\n');

    // Get all unique manufacturers with case variations
    const switches = await prisma.switch.findMany({
      select: {
        manufacturer: true,
      },
    });

    // Create a normalized manufacturer mapping
    const manufacturerNormalization = {};
    const caseVariations = {};
    
    switches.forEach(switch_ => {
      const manufacturer = switch_.manufacturer;
      if (manufacturer && manufacturer.trim() !== '') {
        const trimmed = manufacturer.trim();
        const normalized = trimmed.toLowerCase();
        
        if (!caseVariations[normalized]) {
          caseVariations[normalized] = new Set();
        }
        caseVariations[normalized].add(trimmed);
      }
    });

    // Create suggested normalized names
    console.log('📝 Suggested manufacturer normalization mapping:');
    console.log('─'.repeat(60));
    
    const migrationMap = {};
    
    Object.entries(caseVariations).forEach(([normalized, variants]) => {
      const variantArray = Array.from(variants);
      
      // Choose the "canonical" version (prefer capitalized first letter)
      let canonical = variantArray.find(v => v[0] === v[0].toUpperCase()) || variantArray[0];
      
      // Special cases for known brands
      const specialCases = {
        'gateron': 'Gateron',
        'kailh': 'Kailh',
        'cherry': 'Cherry',
        'bsun': 'BSUN',
        'haimu': 'Haimu',
        'tecsee': 'Tecsee',
        'leobog': 'Leobog',
        'jwick': 'JWICK',
        'outemu': 'Outemu',
        'ttc': 'TTC',
        'hmx': 'HMX'
      };
      
      if (specialCases[normalized]) {
        canonical = specialCases[normalized];
      }
      
      migrationMap[normalized] = {
        canonical: canonical,
        variants: variantArray,
        aliases: variantArray.filter(v => v !== canonical)
      };
      
      console.log(`${canonical}:`);
      if (variantArray.length > 1) {
        console.log(`  Aliases: ${variantArray.filter(v => v !== canonical).join(', ')}`);
      }
      console.log('');
    });

    // Generate SQL for creating manufacturers
    console.log('\n🔧 SQL for creating Manufacturer records:');
    console.log('─'.repeat(60));
    
    Object.values(migrationMap).forEach(({ canonical, aliases }) => {
      const aliasesArray = aliases.length > 0 ? `ARRAY[${aliases.map(a => `'${a.replace(/'/g, "''")}'`).join(', ')}]` : 'ARRAY[]::text[]';
      console.log(`INSERT INTO "Manufacturer" (name, aliases, verified) VALUES ('${canonical.replace(/'/g, "''")}', ${aliasesArray}, true);`);
    });

    // Count how many switches would be affected
    console.log('\n📊 Migration impact:');
    console.log('─'.repeat(60));
    console.log(`• ${Object.keys(migrationMap).length} unique manufacturers to create`);
    console.log(`• ${switches.filter(s => s.manufacturer && s.manufacturer.trim()).length} switches with manufacturers`);
    console.log(`• ${switches.filter(s => !s.manufacturer || !s.manufacturer.trim()).length} switches without manufacturers (will remain null)`);

  } catch (error) {
    console.error('❌ Error preparing migration data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

prepareMigrationData();