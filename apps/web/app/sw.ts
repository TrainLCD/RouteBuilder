/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next: the list of precached assets.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const ONE_HOUR = 60 * 60;
const ONE_DAY = ONE_HOUR * 24;
const ONE_MONTH = ONE_DAY * 30;
const ONE_YEAR = ONE_DAY * 365;

/**
 * Runtime caching rules for the BFF endpoints. Together with the precached
 * shell + the localStorage-resident route state, these give the app a
 * usable offline mode: saved routes render with full station/line data
 * even when the upstream is unreachable.
 */
const apiCaching: RuntimeCaching[] = [
  {
    // Shortened-route lookup. The id is the SHA-256 prefix of the sids
    // list, so the response body never changes for a given id — a plain
    // CacheFirst with a long expiration is safe.
    matcher: ({ url, sameOrigin, request }) =>
      sameOrigin &&
      request.method === 'GET' &&
      /^\/api\/routes\/[A-Za-z0-9_-]+$/.test(url.pathname),
    handler: new CacheFirst({
      cacheName: 'rb-routes-immutable',
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: ONE_YEAR }),
      ],
    }),
  },
  {
    // TrainLCD station / line / line-list / station-group reads.
    // Stale-while-revalidate gives instant cache hits while refreshing
    // the next visit. Station and line data change at most every few
    // months in practice, so seeing one-visit-stale data is acceptable.
    matcher: ({ url, sameOrigin, request }) => {
      if (!sameOrigin || request.method !== 'GET') return false;
      const p = url.pathname;
      return (
        p.startsWith('/api/trainlcd/stations') ||
        p.startsWith('/api/trainlcd/line-list-stations') ||
        p.startsWith('/api/trainlcd/line/') ||
        p.startsWith('/api/trainlcd/station-group/')
      );
    },
    handler: new StaleWhileRevalidate({
      cacheName: 'rb-trainlcd-data',
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: ONE_MONTH }),
      ],
    }),
  },
  {
    // Search: try the network first so live results win, but fall back
    // to a previously-cached response if the user is offline or the
    // upstream is slow. Short TTL because results can drift.
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && url.pathname === '/api/trainlcd/search',
    handler: new NetworkFirst({
      cacheName: 'rb-search',
      networkTimeoutSeconds: 5,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: ONE_DAY }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // The client decides when to activate the new worker — see PwaUpdater.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  // API rules first (more specific) → Serwist defaults (static assets,
  // navigation, third-party fonts/images) as the fallback.
  runtimeCaching: [...apiCaching, ...defaultCache],
  fallbacks: { entries: [] },
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

serwist.addEventListeners();
