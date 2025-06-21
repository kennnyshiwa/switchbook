import { PrismaClient, MasterSwitchStatus, SwitchType, SwitchTechnology } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get the first admin user to be the approver
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  })

  if (!adminUser) {
    console.error('No admin user found. Please create an admin user first.')
    return
  }

  console.log('Seeding master switches...')

  const masterSwitches = [
    {
      name: 'Cherry MX Red',
      chineseName: '樱桃红轴',
      type: SwitchType.LINEAR,
      technology: SwitchTechnology.MECHANICAL,
      manufacturer: 'Cherry',
      actuationForce: 45,
      bottomOutForce: 60,
      preTravel: 2.0,
      bottomOut: 4.0,
      springWeight: '45g',
      springLength: '14mm',
      topHousing: 'Nylon',
      bottomHousing: 'Nylon',
      stem: 'POM',
      compatibility: 'MX-style',
      notes: 'Classic linear switch, smooth and light. Popular for gaming.',
      submittedById: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(),
      status: MasterSwitchStatus.APPROVED,
    },
    {
      name: 'Gateron Yellow',
      chineseName: '佳达隆黄轴',
      type: SwitchType.LINEAR,
      technology: SwitchTechnology.MECHANICAL,
      manufacturer: 'Gateron',
      actuationForce: 50,
      bottomOutForce: 65,
      preTravel: 2.0,
      bottomOut: 4.0,
      springWeight: '50g',
      springLength: '13.5mm',
      topHousing: 'Polycarbonate',
      bottomHousing: 'Nylon',
      stem: 'POM',
      compatibility: 'MX-style',
      notes: 'Smooth budget linear with a slightly heavier weight than reds.',
      submittedById: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(),
      status: MasterSwitchStatus.APPROVED,
    },
    {
      name: 'Holy Panda',
      type: SwitchType.TACTILE,
      technology: SwitchTechnology.MECHANICAL,
      manufacturer: 'Drop',
      actuationForce: 67,
      bottomOutForce: 67,
      preTravel: 1.9,
      bottomOut: 3.8,
      springWeight: '67g',
      springLength: '14mm',
      topHousing: 'Polycarbonate',
      bottomHousing: 'Nylon',
      stem: 'POM',
      frankenTop: 'Invyr Panda',
      frankenBottom: 'Invyr Panda',
      frankenStem: 'Halo',
      compatibility: 'MX-style',
      notes: 'Legendary tactile frankenswitch combining Invyr Panda housing with Halo stems.',
      submittedById: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(),
      status: MasterSwitchStatus.APPROVED,
    },
    {
      name: 'Kailh Box White',
      chineseName: '凯华Box白轴',
      type: SwitchType.CLICKY,
      technology: SwitchTechnology.MECHANICAL,
      manufacturer: 'Kailh',
      actuationForce: 50,
      bottomOutForce: 60,
      preTravel: 1.8,
      bottomOut: 3.6,
      springWeight: '50g',
      springLength: '13mm',
      topHousing: 'Polycarbonate',
      bottomHousing: 'Nylon',
      stem: 'POM',
      compatibility: 'MX-style',
      notes: 'Crisp clicky switch with box design for better stability and dust resistance.',
      submittedById: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(),
      status: MasterSwitchStatus.APPROVED,
    },
    {
      name: 'Wooting Lekker',
      type: SwitchType.LINEAR,
      technology: SwitchTechnology.MAGNETIC,
      manufacturer: 'Wooting',
      actuationForce: 45,
      bottomOutForce: 60,
      preTravel: 1.5,
      bottomOut: 4.0,
      springWeight: '45g',
      springLength: '15mm',
      magnetOrientation: 'Horizontal',
      magnetPosition: 'Center',
      magnetPolarity: 'North',
      initialMagneticFlux: 35,
      bottomOutMagneticFlux: 3500,
      pcbThickness: '1.6mm',
      compatibility: 'Wooting Lekker',
      notes: 'Analog magnetic switch with adjustable actuation point.',
      submittedById: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(),
      status: MasterSwitchStatus.APPROVED,
    },
    {
      name: 'Boba U4T',
      type: SwitchType.TACTILE,
      technology: SwitchTechnology.MECHANICAL,
      manufacturer: 'Gazzew',
      actuationForce: 62,
      bottomOutForce: 68,
      preTravel: 2.0,
      bottomOut: 4.0,
      springWeight: '62g',
      springLength: '14mm',
      topHousing: 'Proprietary Plastic',
      bottomHousing: 'Proprietary Plastic',
      stem: 'POM',
      compatibility: 'MX-style',
      notes: 'Strong tactile bump with minimal pre-travel. Thocky sound signature.',
      submittedById: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(),
      status: MasterSwitchStatus.APPROVED,
    },
  ]

  for (const switchData of masterSwitches) {
    const existing = await prisma.masterSwitch.findFirst({
      where: { 
        name: switchData.name,
        manufacturer: switchData.manufacturer 
      }
    })

    if (!existing) {
      await prisma.masterSwitch.create({
        data: switchData
      })
      console.log(`✓ Created ${switchData.name}`)
    } else {
      console.log(`- Skipped ${switchData.name} (already exists)`)
    }
  }

  console.log('Master switches seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })