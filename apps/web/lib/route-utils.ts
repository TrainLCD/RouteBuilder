import { getCachedLineOrder, getCachedStation } from './api/cache';
import { validateRouteSync, type LineId, type Segment, type StationId } from './data';

/**
 * Consecutive run of segments on the same line. The Builder collapses runs
 * into a single "ride X line for N stops" block whose pill switches the
 * whole run to another line at once — without grouping, switching a 4-stop
 * 中央線 section would take four taps.
 */
export type LineGroup = {
  lineId: LineId | null;
  /** Index of the first stop covered by this group, in `stationIds`. */
  startStopIdx: number;
  /** Index of the last stop covered by this group, in `stationIds`. */
  endStopIdx: number;
  /** Number of segments (= endStopIdx - startStopIdx). */
  hops: number;
};

export type RouteSummary = {
  stations: number;
  segments: number;
  lines: LineId[];
  transfers: number;
  ok: boolean;
  segs?: Segment[];
  groups?: LineGroup[];
};

function groupSegments(segments: Segment[]): LineGroup[] {
  const groups: LineGroup[] = [];
  if (segments.length === 0) return groups;
  let curLineId: LineId | null = segments[0].line;
  let groupStart = 0;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].line !== curLineId) {
      groups.push({
        lineId: curLineId,
        startStopIdx: groupStart,
        endStopIdx: i,
        hops: i - groupStart,
      });
      curLineId = segments[i].line;
      groupStart = i;
    }
  }
  groups.push({
    lineId: curLineId,
    startStopIdx: groupStart,
    endStopIdx: segments.length,
    hops: segments.length - groupStart,
  });
  return groups;
}

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
    groups: groupSegments(v.segments),
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
