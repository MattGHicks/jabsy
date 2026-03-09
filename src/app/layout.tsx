import type { Metadata } from 'next'
import { Geist, Geist_Mono, Barlow_Condensed } from 'next/font/google'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://jabsypicks.com'),
  title: {
    default: 'Jabsy — Fantasy MMA Picks',
    template: '%s | Jabsy',
  },
  description: 'Make your picks, compete with friends, and prove you know MMA.',
  openGraph: {
    title: 'Jabsy — Fantasy MMA Picks',
    description: 'Make your picks, compete with friends, and prove you know MMA.',
    type: 'website',
    url: 'https://jabsypicks.com',
    siteName: 'Jabsy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jabsy — Fantasy MMA Picks',
    description: 'Make your picks, compete with friends, and prove you know MMA.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Unregister any stale service workers left over from the old Vite build */}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(sw){sw.unregister()})})}` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} antialiased bg-[#0a0a0a] text-[#f4f4f5]`}
      >
        {children}
        <Analytics />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1e1e1e',
              border: '1px solid #27272a',
              color: '#f4f4f5',
            },
          }}
        />
      </body>
    </html>
  )
}
