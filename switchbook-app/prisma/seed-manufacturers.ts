import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const manufacturers = [
  { name: 'ABT', aliases: ['abt'] },
  { name: 'Aflion', aliases: ['aflion'] },
  { name: 'Alps', aliases: ['alps', 'ALPS'] },
  { name: 'Aristotle', aliases: ['aristotle'] },
  { name: 'BSUN', aliases: ['bsun', 'Bsun'] },
  { name: 'Burgess', aliases: ['burgess'] },
  { name: 'Cherry', aliases: ['cherry', 'Cherry MX', 'cherry mx', 'GMK Cherry'] },
  { name: 'Duhuk Lumia', aliases: ['duhuk lumia', 'duhuk', 'lumia'] },
  { name: 'Gateron', aliases: ['gateron', 'GATERON'] },
  { name: 'Grain Gold', aliases: ['grain gold', 'graingold'] },
  { name: 'Greetech', aliases: ['greetech', 'GREETECH'] },
  { name: 'Haimu', aliases: ['haimu', 'HAIMU'] },
  { name: 'HMX', aliases: ['hmx'] },
  { name: 'Huano', aliases: ['huano', 'HUANO'] },
  { name: 'Jedel', aliases: ['jedel', 'JEDEL'] },
  { name: 'Jerrzi', aliases: ['jerrzi', 'JERRZI'] },
  { name: 'Jixian', aliases: ['jixian', 'JIXIAN'] },
  { name: 'JWICK', aliases: ['jwick', 'Jwick'] },
  { name: 'JWK', aliases: ['jwk', 'Jwk'] },
  { name: 'Kailh', aliases: ['kailh', 'KAILH'] },
  { name: 'Keygeek', aliases: ['keygeek', 'KEYGEEK', 'KeyGeek'] },
  { name: 'KTT', aliases: ['ktt'] },
  { name: 'LCET', aliases: ['lcet', 'Lcet'] },
  { name: 'Lichicx', aliases: ['lichicx', 'LICHICX'] },
  { name: 'NewGiant', aliases: ['newgiant', 'New Giant', 'new giant'] },
  { name: 'Omron', aliases: ['omron', 'OMRON'] },
  { name: 'Outemu', aliases: ['outemu', 'OUTEMU'] },
  { name: 'Raesha', aliases: ['raesha', 'RAESHA'] },
  { name: 'SOAI/Leobog', aliases: ['soai', 'leobog', 'SOAI', 'Leobog', 'LEOBOG'] },
  { name: 'SP Star', aliases: ['sp star', 'spstar', 'SP-Star'] },
  { name: 'Swikeys', aliases: ['swikeys', 'SWIKEYS'] },
  { name: 'Tecsee', aliases: ['tecsee', 'TECSEE'] },
  { name: 'TTC', aliases: ['ttc'] },
  { name: 'Unknown', aliases: ['unknown', 'UNKNOWN', 'N/A', 'n/a'] },
  { name: 'Varmilo', aliases: ['varmilo', 'VARMILO'] },
  { name: 'Weipeng', aliases: ['weipeng', 'WEIPENG'] },
  { name: 'Xiang Min', aliases: ['xiang min', 'xiangmin', 'XIANG MIN'] },
  { name: 'Yusya', aliases: ['yusya', 'YUSYA'] },
  { name: 'Zorro', aliases: ['zorro', 'ZORRO'] }
]

async function seed() {
  console.log('Seeding manufacturers...')
  
  for (const manufacturer of manufacturers) {
    try {
      await prisma.manufacturer.create({
        data: {
          name: manufacturer.name,
          aliases: manufacturer.aliases,
          verified: true, // Pre-populated manufacturers are verified
        }
      })
      console.log(`Created manufacturer: ${manufacturer.name}`)
    } catch (error) {
      // Skip if already exists
      console.log(`Manufacturer ${manufacturer.name} already exists, skipping...`)
    }
  }
  
  console.log('Seeding complete!')
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })