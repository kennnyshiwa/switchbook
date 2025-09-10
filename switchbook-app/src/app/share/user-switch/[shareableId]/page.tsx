import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import ShareUserSwitchPageClient from './page-client'

interface Props {
  params: Promise<{ shareableId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareableId } = await params

  try {
    const switchItem = await prisma.switch.findUnique({
      where: { shareableId },
      include: {
        user: {
          select: {
            username: true
          }
        },
        images: true
      }
    })

    if (!switchItem) {
      return {
        title: 'Switch Not Found - Switchbook',
        description: 'This switch could not be found.'
      }
    }

    const switchName = switchItem.name || switchItem.chineseName || 'Unknown Switch'
    const fullName = switchItem.manufacturer ? `${switchItem.manufacturer} ${switchName}` : switchName
    const description = `View ${fullName} from ${switchItem.user.username}'s collection on Switchbook. ${
      switchItem.type ? `Type: ${switchItem.type.replace('_', ' ')}. ` : ''
    }${
      switchItem.actuationForce ? `Actuation: ${switchItem.actuationForce}g. ` : ''
    }Join the community to track your switch collection.`

    // Get the switch image URL
    const primaryImage = switchItem.primaryImageId
      ? switchItem.images.find(img => img.id === switchItem.primaryImageId)
      : switchItem.images[0]
    const imageUrl = primaryImage?.url || switchItem.imageUrl

    return {
      title: `${fullName} - ${switchItem.user.username}'s Collection - Switchbook`,
      description,
      openGraph: {
        title: `${fullName} - ${switchItem.user.username}'s Collection`,
        description,
        type: 'website',
        siteName: 'Switchbook',
        images: imageUrl ? [{
          url: imageUrl,
          width: 1200,
          height: 1200,
          alt: fullName
        }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${fullName} - ${switchItem.user.username}'s Collection`,
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

export default function ShareUserSwitchPage() {
  return <ShareUserSwitchPageClient />
}