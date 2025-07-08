import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import ShareMasterSwitchPageClient from './page-client'

interface Props {
  params: Promise<{ shareableId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareableId } = await params

  try {
    const masterSwitch = await prisma.masterSwitch.findFirst({
      where: { 
        shareableId,
        status: 'APPROVED'
      },
      include: {
        images: true
      }
    })

    if (!masterSwitch) {
      return {
        title: 'Switch Not Found - Switchbook',
        description: 'This switch could not be found in the Switchbook database.'
      }
    }

    const switchName = `${masterSwitch.manufacturer} ${masterSwitch.name}`
    const description = `View ${switchName} mechanical keyboard switch details on Switchbook. ${
      masterSwitch.type ? `Type: ${masterSwitch.type.replace('_', ' ')}. ` : ''
    }${
      masterSwitch.actuationForce ? `Actuation: ${masterSwitch.actuationForce}g. ` : ''
    }Join the community to track your switch collection.`

    // Get the switch image URL
    const primaryImage = masterSwitch.primaryImageId
      ? masterSwitch.images.find(img => img.id === masterSwitch.primaryImageId)
      : masterSwitch.images[0]
    const imageUrl = primaryImage?.url || masterSwitch.imageUrl

    return {
      title: `${switchName} - Switchbook`,
      description,
      openGraph: {
        title: switchName,
        description,
        type: 'website',
        siteName: 'Switchbook',
        images: imageUrl ? [{
          url: imageUrl,
          width: 1200,
          height: 1200,
          alt: switchName
        }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title: switchName,
        description,
        images: imageUrl ? [imageUrl] : undefined,
      }
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: 'Switchbook',
      description: 'The mechanical keyboard switch database'
    }
  }
}

export default function ShareMasterSwitchPage() {
  return <ShareMasterSwitchPageClient />
}