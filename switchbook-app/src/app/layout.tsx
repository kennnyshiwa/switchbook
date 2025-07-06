import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Switchbook - Mechanical Switch Collection',
  description: 'Catalogue and share your mechanical keyboard switch collection with fellow enthusiasts',
  keywords: ['mechanical keyboard', 'switches', 'collection', 'catalogue', 'keyboard enthusiasts'],
  authors: [{ name: 'Switchbook' }],
  creator: 'Switchbook',
  publisher: 'Switchbook',
  metadataBase: new URL('https://switchbook.app'),
  openGraph: {
    title: 'Switchbook - Mechanical Switch Collection',
    description: 'Catalogue and share your mechanical keyboard switch collection with fellow enthusiasts',
    url: 'https://switchbook.app',
    siteName: 'Switchbook',
    images: [
      {
        url: 'https://switchbook.app/logo.png',
        width: 1200,
        height: 630,
        alt: 'Switchbook Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Switchbook - Mechanical Switch Collection',
    description: 'Catalogue and share your mechanical keyboard switch collection with fellow enthusiasts',
    images: ['https://switchbook.app/logo.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}