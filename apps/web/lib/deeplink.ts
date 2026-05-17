import type { StationId } from './api/types';
import type { Route } from './data';

/**
 * TrainLCD deep link spec.
 *
 * Two link formats are produced by this app:
 *
 *   1. trainlcd://route?sids=<sid1>,<sid2>,...[&skips=<i,j,...>]
 *      Direct embedded route. Order is direction (sids[0] → sids[last]).
 *      `skips` is a 0-origin index list of stations to treat as 通過
 *      (TrainLCD/MobileApp#6005 案A). Spec: TrainLCD/MobileApp#6002.
 *
 *   2. trainlcd://route?id=<short-id>
 *      Server-shortened reference. The receiver resolves `id` against
 *      the Route Builder backend (`GET /api/routes/<id>` →
 *      `{ sids, skips? }`) and proceeds as if the resolved sids/skips
 *      were embedded directly. This is the form we use whenever the
 *      user opts into "Use short URL" so QR codes stay scannable on
 *      long routes.
 *
 * Schemes:
 *   - production: `trainlcd://`
 *   - canary:     `trainlcd-canary://`
 */

const PROD_SCHEME = 'trainlcd';
const CANARY_SCHEME = 'trainlcd-canary';
const HOST_PATH = 'route';

export type DeepLinkChannel = 'prod' | 'canary';

export function schemeFor(channel: DeepLinkChannel): string {
  return channel === 'canary' ? CANARY_SCHEME : PROD_SCHEME;
}

export type TrainLcdDeepLinkParams = {
  sids?: StationId[];
  /** 0-origin indices into `sids` to treat as 通過. */
  skips?: number[];
  /** Short id from `POST /api/routes`. Mutually exclusive with `sids`. */
  id?: string;
  auto?: boolean;
  theme?: string;
};

export function buildDeepLink(
  params: TrainLcdDeepLinkParams,
  scheme: string = PROD_SCHEME,
): string {
  const qs = new URLSearchParams();
  if (params.id) {
    qs.set('id', params.id);
  } else if (params.sids && params.sids.length > 0) {
    qs.set('sids', params.sids.join(','));
    if (params.skips && params.skips.length > 0) {
      qs.set('skips', params.skips.join(','));
    }
  }
  if (params.auto) qs.set('auto', '1');
  if (params.theme) qs.set('theme', params.theme);
  return `${scheme}://${HOST_PATH}?${qs.toString()}`;
}

/**
 * Project a Route's `passing` (set of station ids) onto the `skips`
 * index list expected by TrainLCD/MobileApp#6005 案A. The first and
 * last stops are always treated as stops regardless of marking, so they
 * never appear in the returned indices.
 */
export function skipsForRoute(route: Route): number[] {
  if (!route.passing || route.passing.length === 0) return [];
  const set = new Set(route.passing);
  const skips: number[] = [];
  for (let i = 1; i < route.stations.length - 1; i++) {
    if (set.has(route.stations[i])) skips.push(i);
  }
  return skips;
}

/**
 * Direct (un-shortened) deep link with sids embedded. Useful for tests
 * and as a fallback when the short-URL endpoint is unreachable.
 */
export function directDeepLinkForRoute(
  route: Route,
  channel: DeepLinkChannel = 'prod',
): string | null {
  if (route.stations.length < 2) return null;
  const skips = skipsForRoute(route);
  return buildDeepLink(
    { sids: route.stations, skips: skips.length > 0 ? skips : undefined },
    schemeFor(channel),
  );
}

/**
 * POST the route's sids (+skips) to our backend and return a short
 * `trainlcd://route?id=<code>` deep link. Resolves to `null` if the
 * route has fewer than two stops or if the backend rejects the request.
 */
export async function shortDeepLinkForRoute(
  route: Route,
  channel: DeepLinkChannel = 'prod',
  signal?: AbortSignal,
): Promise<string | null> {
  if (route.stations.length < 2) return null;
  const skips = skipsForRoute(route);
  const body = JSON.stringify({
    sids: route.stations,
    ...(skips.length > 0 ? { skips } : {}),
  });
  const res = await fetch('/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  if (!data.id) return null;
  return buildDeepLink({ id: data.id }, schemeFor(channel));
}
