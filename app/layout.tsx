import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tax Solver — סוכן מחקר מס מקצועי',
  description: 'פלטפורמת Enterprise לרואי חשבון ויועצי מס',
  robots: 'noindex, nofollow', // Enterprise — לא לאינדקס
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
