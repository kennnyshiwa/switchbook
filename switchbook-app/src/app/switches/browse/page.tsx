import type { Metadata } from 'next'
import BrowseMasterSwitchesPageClient from './page-client'

export const metadata: Metadata = {
  title: 'Browse Mechanical Keyboard Switches | Switchbook',
  description:
    'Explore Switchbook’s community-maintained mechanical keyboard switch database. Filter by manufacturer, switch type, force, materials, and more.',
  openGraph: {
    title: 'Browse Mechanical Keyboard Switches | Switchbook',
    description:
      'Explore Switchbook’s community-maintained mechanical keyboard switch database.',
    url: 'https://switchbook.app/switches/browse',
    siteName: 'Switchbook',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Browse Mechanical Keyboard Switches | Switchbook',
    description:
      'Explore Switchbook’s community-maintained mechanical keyboard switch database.',
  },
}

export default function BrowseMasterSwitchesPage() {
  return <BrowseMasterSwitchesPageClient />
}
