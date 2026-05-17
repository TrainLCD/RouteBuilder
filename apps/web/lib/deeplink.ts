import { getCachedLine } from './api/cache';
import type { StationId } from './api/types';
import type { Route } from './data';
import { summarizeRoute } from './route-utils';

/**
 * TrainLCD deep link spec.
 *
 * Three families of parameters:
 *
 * - Route encoding (one of):
 *     1. trainlcd://route?sids=<sid1>,<sid2>,...[&skips=<i,j,...>]
 *        Direct embedded route. Order is direction (sids[0] → sids[last]).
 *        `skips` is a 0-origin index list of stations to treat as 通過
 *        (TrainLCD/MobileApp#6005 案A). Spec: TrainLCD/MobileApp#6002.
 *     2. trainlcd://route?id=<short-id>
 *        Server-shortened reference. The receiver resolves `id` against
 *        the Route Builder backend (`GET /api/routes/<id>` →
 *        `{ sids, skips?, trainType? }`) and proceeds as if the
 *        resolved fields were embedded directly.
 *
 * - Custom train type (TrainLCD/MobileApp#6018), used to surface the
 *   user's route name + accent color as the LCD's 列車種別 display:
 *     ttname (required), ttcolor (required, #RRGGBB).
 *   For `?id=` form the same data is persisted server-side instead of
 *   appearing in the URL.
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

/** Subset of TrainLCD's `TrainType` that we set from this app. */
export type RouteTrainType = {
  /** 列車種別の表示名 (e.g. "週末さんぽ"). Non-empty. */
  name: string;
  /** #RRGGBB の小文字 6 桁 hex. */
  color: string;
  /** Romaji form for the LCD's secondary line. Currently a placeholder
   *  ("Local") for every route — TrainLCD UI typically expects something
   *  here even if the primary `name` is the user's Japanese label. */
  nameRoman?: string;
};

/** Placeholder English/romaji label until the UI lets the user set it. */
const PLACEHOLDER_NAME_ROMAN = 'Local';

export type TrainLcdDeepLinkParams = {
  sids?: StationId[];
  /** 0-origin indices into `sids` to treat as 通過. */
  skips?: number[];
  /** Short id from `POST /api/routes`. Mutually exclusive with `sids`. */
  id?: string;
  /** Custom 列車種別 to override the head-station-derived one. */
  trainType?: RouteTrainType;
  auto?: boolean;
  theme?: string;
};

/** Lowercase #RRGGBB or null if the input doesn't match. */
export function normalizeHexColor(c: string | null | undefined): string | null {
  if (typeof c !== 'string') return null;
  const m = c.trim().match(/^#([0-9a-fA-F]{6})$/);
  return m ? `#${m[1].toLowerCase()}` : null;
}

/**
 * Project a Route into a TrainLCD train-type record. The name comes from
 * the user-editable route name. The color is the user's explicit
 * `route.color` if set, otherwise the first segment's line color so the
 * LCD reads with the same hue the rest of the app shows. Returns
 * `undefined` if neither name nor a valid color can be resolved — the
 * spec rejects partial train-type data, so we either send both fields
 * or none.
 */
export function trainTypeForRoute(route: Route): RouteTrainType | undefined {
  const name = route.name?.trim();
  if (!name) return undefined;
  const explicit = normalizeHexColor(route.color);
  if (explicit) return { name, color: explicit, nameRoman: PLACEHOLDER_NAME_ROMAN };
  const sum = summarizeRoute(route.stations);
  const firstLineId = sum.lines[0];
  if (firstLineId != null) {
    const line = getCachedLine(firstLineId);
    const derived = normalizeHexColor(line?.color);
    if (derived) return { name, color: derived, nameRoman: PLACEHOLDER_NAME_ROMAN };
  }
  return undefined;
}

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
  if (params.trainType) {
    qs.set('ttname', params.trainType.name);
    qs.set('ttcolor', params.trainType.color);
    if (params.trainType.nameRoman) {
      qs.set('ttnameroman', params.trainType.nameRoman);
    }
  }
  if (params.auto) qs.set('auto', '1');
  if (params.theme) qs.set('theme', params.theme);
  return `${scheme}://${HOST_PATH}?${qs.toString()}`;
}

export function skipsForRoute(route: Route): number[] {
  if (!route.passing || route.passing.length === 0) return [];
  const set = new Set(route.passing);
  const skips: number[] = [];
  for (let i = 1; i < route.stations.length - 1; i++) {
    if (set.has(route.stations[i])) skips.push(i);
  }
  return skips;
}

export function directDeepLinkForRoute(
  route: Route,
  channel: DeepLinkChannel = 'prod',
): string | null {
  if (route.stations.length < 2) return null;
  const skips = skipsForRoute(route);
  const trainType = trainTypeForRoute(route);
  return buildDeepLink(
    {
      sids: route.stations,
      skips: skips.length > 0 ? skips : undefined,
      trainType,
    },
    schemeFor(channel),
  );
}

export async function shortDeepLinkForRoute(
  route: Route,
  channel: DeepLinkChannel = 'prod',
  signal?: AbortSignal,
): Promise<string | null> {
  if (route.stations.length < 2) return null;
  const skips = skipsForRoute(route);
  const trainType = trainTypeForRoute(route);
  const body = JSON.stringify({
    sids: route.stations,
    ...(skips.length > 0 ? { skips } : {}),
    ...(trainType ? { trainType } : {}),
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
