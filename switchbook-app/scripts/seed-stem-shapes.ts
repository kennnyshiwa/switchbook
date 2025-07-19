import { prisma } from '../src/lib/prisma'

const stemShapes = [
  'Dustproof',
  'Box',
  'MX',
  'Alps',
  'Mitsumi'
]

async function seedStemShapes() {
  console.log('Seeding stem shapes...')
  
  for (let i = 0; i < stemShapes.length; i++) {
    const name = stemShapes[i]
    
    try {
      await prisma.stemShape.create({
        data: {
          name,
          order: i
        }
      })
      console.log(`Created stem shape: ${name}`)
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`Stem shape already exists: ${name}`)
      } else {
        console.error(`Failed to create stem shape ${name}:`, error)
      }
    }
  }
  
  console.log('Stem shapes seeding completed!')
}

seedStemShapes()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })