import { prisma } from '../src/lib/prisma'

const materials = [
  'PA66',
  'Nylon',
  'Polycarbonate',
  'POK',
  'HPE',
  'UHMWPE',
  'POM'
]

async function seedMaterials() {
  console.log('Seeding materials...')
  
  for (let i = 0; i < materials.length; i++) {
    const name = materials[i]
    
    try {
      const existing = await prisma.material.findUnique({
        where: { name }
      })
      
      if (!existing) {
        await prisma.material.create({
          data: {
            name,
            order: i,
            active: true
          }
        })
        console.log(`Created material: ${name}`)
      } else {
        console.log(`Material already exists: ${name}`)
      }
    } catch (error) {
      console.error(`Error creating material ${name}:`, error)
    }
  }
  
  console.log('Materials seeding completed!')
}

seedMaterials()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })