import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Route Builder (Beta)',
    short_name: 'Route Builder',
    description: 'Compose multi-line train routes for TrainLCD across lines and operators.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f6f3',
    theme_color: '#1d6cf2',
    orientation: 'portrait',
    lang: 'ja',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
