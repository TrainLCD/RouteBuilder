import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { PwaUpdater } from '@/components/PwaUpdater';
import './globals.css';

export const metadata: Metadata = {
  title: 'Route Builder (Beta)',
  description: 'Build TrainLCD routes by chaining stations along connected lines. Beta release.',
  applicationName: 'Route Builder',
  appleWebApp: {
    capable: true,
    title: 'Route Builder',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/brand-icon.png', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1d6cf2',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <PwaUpdater />
      </body>
    </html>
  );
}
