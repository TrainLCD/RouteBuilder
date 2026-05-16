/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next: the list of precached assets.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // The client decides when to activate the new worker — we don't skip
  // waiting automatically. The update toast in the UI calls SKIP_WAITING
  // explicitly when the user clicks "Update".
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  // Never serve a stale shell for the BFF: route resolution must hit
  // network so users always see the latest cache state on the server.
  fallbacks: {
    entries: [],
  },
});

// Allow the app to ask the waiting worker to activate immediately when the
// user clicks "Update" on the new-version toast.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

serwist.addEventListeners();
