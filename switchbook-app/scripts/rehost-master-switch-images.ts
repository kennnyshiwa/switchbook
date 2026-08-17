import { prisma } from '../src/lib/prisma'
import { rehostRemoteImage } from '../src/lib/remote-image'

const REMOTE_HOST = 'https://i.ibb.co/'

async function rehostOrCreatePrimaryImage(masterSwitch: {
  id: string
  imageUrl: string | null
  images: { id: string; order: number }[]
  primaryImageId: string | null
}, remoteUrl: string) {
  const rehosted = await rehostRemoteImage(remoteUrl, `master-switches/${masterSwitch.id}`)
  const image = await prisma.switchImage.create({
    data: {
      masterSwitchId: masterSwitch.id,
      url: rehosted.url,
      type: 'UPLOADED',
      order: masterSwitch.images.length,
      width: rehosted.width,
      height: rehosted.height,
      size: rehosted.size,
    },
  })

  await prisma.masterSwitch.update({
    where: { id: masterSwitch.id },
    data: {
      imageUrl: rehosted.url,
      primaryImageId: masterSwitch.primaryImageId || image.id,
    },
  })
}

async function main() {
  const masterSwitches = await prisma.masterSwitch.findMany({
    where: {
      OR: [
        { imageUrl: { contains: REMOTE_HOST } },
        { images: { some: { url: { contains: REMOTE_HOST } } } },
      ],
    },
    include: {
      images: {
        orderBy: { order: 'asc' },
      },
    },
  })

  console.log(`Found ${masterSwitches.length} master switches with ibb.co-hosted images`)

  let updatedImages = 0
  let createdImages = 0
  let updatedPrimaryUrls = 0

  for (const masterSwitch of masterSwitches) {
    console.log(`Rehosting images for ${masterSwitch.name} (${masterSwitch.id})`)
    const replacements = new Map<string, string>()

    for (const image of masterSwitch.images) {
      if (!image.url.startsWith(REMOTE_HOST)) {
        continue
      }

      const rehosted = await rehostRemoteImage(image.url, `master-switches/${masterSwitch.id}`)
      await prisma.switchImage.update({
        where: { id: image.id },
        data: {
          url: rehosted.url,
          type: 'UPLOADED',
          width: rehosted.width,
          height: rehosted.height,
          size: rehosted.size,
        },
      })

      replacements.set(image.url, rehosted.url)
      updatedImages += 1
    }

    if (masterSwitch.imageUrl?.startsWith(REMOTE_HOST)) {
      const replacement = replacements.get(masterSwitch.imageUrl)

      if (replacement) {
        await prisma.masterSwitch.update({
          where: { id: masterSwitch.id },
          data: {
            imageUrl: replacement,
          },
        })
      } else {
        await rehostOrCreatePrimaryImage(masterSwitch, masterSwitch.imageUrl)
        createdImages += 1
      }

      updatedPrimaryUrls += 1
    }
  }

  console.log(`Updated existing image records: ${updatedImages}`)
  console.log(`Created new uploaded image records: ${createdImages}`)
  console.log(`Updated master switch primary image URLs: ${updatedPrimaryUrls}`)
}

main()
  .catch((error) => {
    console.error('Failed to rehost master switch images:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
