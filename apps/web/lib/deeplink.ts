import type { StationId } from './api/types';
import type { Route } from './data';

/**
 * TrainLCD deep link spec (matching the proposal in TrainLCD/MobileApp#6002).
 * The native app expects:
 *
 *   trainlcd://route?sids=<sid1>,<sid2>,...
 *
 * `sids` is a comma-separated list of `Station.id` (per-operator row ids).
 * The order *is* the direction — the train heads from `sids[0]` toward
 * `sids[sids.length - 1]`. No separate `dir` parameter is needed; reversing
 * the trip means reversing the list. The receiving app resolves all rows via
 * `stations(ids: $sids)` and uses each row's own `.line` as its line context
 * — no line inference required on the receiver.
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
  sids: StationId[];
  auto?: boolean;
  theme?: string;
};

export function buildDeepLink(
  params: TrainLcdDeepLinkParams,
  scheme: string = PROD_SCHEME,
): string {
  const qs = new URLSearchParams();
  qs.set('sids', params.sids.join(','));
  if (params.auto) qs.set('auto', '1');
  if (params.theme) qs.set('theme', params.theme);
  return `${scheme}://${HOST_PATH}?${qs.toString()}`;
}

/**
 * Derive the deep link for a Route. Returns `null` if the route has fewer
 * than two stops — single-point links aren't actionable for the receiver.
 */
export function deepLinkForRoute(
  route: Route,
  channel: DeepLinkChannel = 'prod',
): string | null {
  if (route.stations.length < 2) return null;
  return buildDeepLink({ sids: route.stations }, schemeFor(channel));
}
