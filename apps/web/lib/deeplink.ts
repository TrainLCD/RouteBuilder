import type { StationId } from './api/types';
import type { Route } from './data';

/**
 * TrainLCD deep link spec.
 *
 * Two link formats are produced by this app:
 *
 *   1. trainlcd://route?sids=<sid1>,<sid2>,...
 *      Direct embedded route. Order is direction (sids[0] → sids[last]).
 *      Spec: TrainLCD/MobileApp#6002.
 *
 *   2. trainlcd://route?id=<short-id>
 *      Server-shortened reference. The receiver resolves `id` against the
 *      Route Builder backend (`GET /api/routes/<id>` → `{ sids }`) and
 *      then proceeds as if the resolved sids were embedded directly.
 *      This is the form we always emit so QR codes stay scannable on
 *      long routes.
 *
 * Schemes:
 *   - production: `trainlcd://` (Android strings.xml `app_scheme=trainlcd`,
 *     iOS scheme `TrainLCD` — schemes are case-insensitive on iOS so
 *     lowercase works for both platforms).
 *   - canary:     `trainlcd-canary://` (canary release builds).
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
  }
  if (params.auto) qs.set('auto', '1');
  if (params.theme) qs.set('theme', params.theme);
  return `${scheme}://${HOST_PATH}?${qs.toString()}`;
}

/**
 * Direct (un-shortened) deep link with sids embedded. Useful for tests and
 * as a fallback when the short-URL endpoint is unreachable.
 */
export function directDeepLinkForRoute(
  route: Route,
  channel: DeepLinkChannel = 'prod',
): string | null {
  if (route.stations.length < 2) return null;
  return buildDeepLink({ sids: route.stations }, schemeFor(channel));
}

/**
 * POST the route's sids to our BFF and return a short `trainlcd://route?id=<code>`
 * deep link. Resolves to `null` if the route has fewer than two stops or if
 * the backend rejects the request.
 */
export async function shortDeepLinkForRoute(
  route: Route,
  channel: DeepLinkChannel = 'prod',
  signal?: AbortSignal,
): Promise<string | null> {
  if (route.stations.length < 2) return null;
  const res = await fetch('/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sids: route.stations }),
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  if (!data.id) return null;
  return buildDeepLink({ id: data.id }, schemeFor(channel));
}
