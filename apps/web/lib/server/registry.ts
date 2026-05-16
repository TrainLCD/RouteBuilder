// Process-singleton SwrCache instances. Each operation has its own cache so
// keys don't collide and we can tune TTLs separately if needed.

import { SwrCache } from './swr-cache';
import type { ApiLine, ApiStation } from './trainlcd';

const DAY = 24 * 60 * 60 * 1000;

// Fresh for 24h; if a request lands during the next 24h we serve stale and
// refresh in the background.
const SWR_OPTS = { freshTtlMs: DAY, staleTtlMs: DAY };

// Search results vary widely by query — short TTL since the upstream is light
// for these and users notice staleness most here.
const SEARCH_OPTS = { freshTtlMs: 60 * 60 * 1000, staleTtlMs: 23 * 60 * 60 * 1000 };

export const searchCache = new SwrCache<string, ApiStation[]>(SEARCH_OPTS);
export const stationsByIdsCache = new SwrCache<string, ApiStation[]>(SWR_OPTS);
export const lineListStationsCache = new SwrCache<string, ApiStation[]>(SWR_OPTS);
export const lineCache = new SwrCache<number, ApiLine | null>(SWR_OPTS);
export const stationGroupCache = new SwrCache<number, ApiStation[]>(SWR_OPTS);
