import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata = {
  title: 'MEASURE — Garment Annotation Tool',
  description: 'Professional garment measurement annotation for clothing resellers. Click two points, enter your value, export a spec sheet.',
  keywords: 'garment measurements, clothing reseller, measurement sheet, eBay seller tool, vintage clothing',
  openGraph: {
    title: 'MEASURE — Garment Annotation Tool',
    description: 'Professional garment measurement annotation for clothing resellers.',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
