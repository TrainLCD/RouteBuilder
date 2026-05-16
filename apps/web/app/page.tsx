'use client';

import dynamic from 'next/dynamic';

// The app is a stateful client SPA backed by localStorage and BFF fetches —
// SSR can't produce meaningful HTML without those, and any pre-rendered text
// would mismatch on hydration once localStorage is read. Skip SSR entirely.
const App = dynamic(
  () => import('@/components/App').then((m) => m.App),
  { ssr: false },
);

export default function Page() {
  return <App />;
}
