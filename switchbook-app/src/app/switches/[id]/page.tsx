import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { MasterSwitchStatus } from '@prisma/client'
import MasterSwitchDetailPageClient from './page-client'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ submitted?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  try {
    const masterSwitch = await prisma.masterSwitch.findFirst({
      where: {
        id,
        status: MasterSwitchStatus.APPROVED,
      },
      include: {
        images: true,
      },
    })

    if (!masterSwitch) {
      return {
        title: 'Switch Not Found | Switchbook',
        description: 'This switch could not be found in the Switchbook database.',
      }
    }

    const switchName = [masterSwitch.manufacturer, masterSwitch.name].filter(Boolean).join(' ')
    const description = [
      `View ${switchName} on Switchbook.`,
      masterSwitch.type ? `Type: ${masterSwitch.type.replace('_', ' ')}.` : null,
      masterSwitch.technology ? `Technology: ${masterSwitch.technology.replace('_', ' ')}.` : null,
      masterSwitch.actuationForce ? `Actuation: ${masterSwitch.actuationForce}g.` : null,
      'Create an account to collect it, wishlist it, and compare it with other switches.',
    ]
      .filter(Boolean)
      .join(' ')

    const primaryImage = masterSwitch.primaryImageId
      ? masterSwitch.images.find((img) => img.id === masterSwitch.primaryImageId)
      : masterSwitch.images[0]
    const imageUrl = primaryImage?.url || masterSwitch.imageUrl || 'https://switchbook.app/logo.png'

    return {
      title: `${switchName} | Switchbook`,
      description,
      alternates: {
        canonical: `https://switchbook.app/switches/${id}`,
      },
      openGraph: {
        title: `${switchName} | Switchbook`,
        description,
        url: `https://switchbook.app/switches/${id}`,
        siteName: 'Switchbook',
        type: 'website',
        images: [
          {
            url: imageUrl,
            alt: switchName,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${switchName} | Switchbook`,
        description,
        images: [imageUrl],
      },
    }
  } catch (error) {
    console.error('Error generating master switch metadata:', error)
    return {
      title: 'Switchbook',
      description: 'The mechanical keyboard switch database',
    }
  }
}

export default function MasterSwitchDetailPage(props: Props) {
  return <MasterSwitchDetailPageClient {...props} />
}
