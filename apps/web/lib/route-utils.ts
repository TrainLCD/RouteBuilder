import { getCachedLineOrder, getCachedStation } from './api/cache';
import { validateRouteSync, type LineId, type Segment, type StationId } from './data';

export type RouteSummary = {
  stations: number;
  segments: number;
  lines: LineId[];
  transfers: number;
  ok: boolean;
  segs?: Segment[];
};

export function summarizeRoute(stationIds: StationId[]): RouteSummary {
  if (stationIds.length < 2) {
    return { stations: stationIds.length, segments: 0, lines: [], transfers: 0, ok: true };
  }
  const v = validateRouteSync(stationIds);
  let transfers = 0;
  for (let i = 1; i < v.segments.length; i++) {
    if (
      v.segments[i].line &&
      v.segments[i - 1].line &&
      v.segments[i].line !== v.segments[i - 1].line
    ) {
      transfers++;
    }
  }
  const linesUsed = [...new Set(v.segments.map((s) => s.line).filter((x): x is LineId => Boolean(x)))];
  return {
    stations: stationIds.length,
    segments: v.segments.length,
    lines: linesUsed,
    transfers,
    ok: v.ok,
    segs: v.segments,
  };
}

/**
 * True when every station row + every incident line ordering this route
 * needs to render is already cached. Used by panels that should wait
 * (skeleton) until they can render the final state in one shot, instead
 * of flickering through partial states.
 */
export function isRouteDataReady(stationIds: StationId[]): boolean {
  const lineIds = new Set<LineId>();
  for (const id of stationIds) {
    const s = getCachedStation(id);
    if (!s) return false;
    if (s.line?.id != null) lineIds.add(s.line.id);
  }
  for (const lid of lineIds) {
    if (!getCachedLineOrder(lid)) return false;
  }
  return true;
}

/** Local case-insensitive name match used for filtering already-cached stations. */
export function matchCachedStation(sid: StationId, q: string): boolean {
  if (!q) return true;
  const s = getCachedStation(sid);
  if (!s) return false;
  const qn = q.toLowerCase().replace(/[-\s]/g, '');
  if (s.name.includes(q)) return true;
  if (s.nameRoman && s.nameRoman.toLowerCase().replace(/[-\s]/g, '').includes(qn)) return true;
  if (s.threeLetterCode && s.threeLetterCode.toLowerCase().includes(qn)) return true;
  return false;
}
