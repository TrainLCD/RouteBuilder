import {
  getCachedLineGroupOrder,
  getCachedLineOrder,
  getCachedStation,
  getCachedStationByGroupId,
  getLineListStationIds,
  getStations,
  stationIdForGroupOnLine,
} from '../api/cache';
import type {
  ApiLine,
  LineId,
  StationGroupId,
  StationId as StationIdT,
} from '../api/types';

export type StationId = StationIdT;
export type { LineId };

export type Segment = {
  from: StationId;
  to: StationId;
  line: LineId | null;
};

export type ValidationResult = {
  ok: boolean;
  segments: Segment[];
};

function areAdjacentOnIdOrder(a: StationId, b: StationId, lineId: LineId): boolean {
  const order = getCachedLineOrder(lineId);
  if (!order) return false;
  for (let i = 0; i < order.length - 1; i++) {
    const x = order[i], y = order[i + 1];
    if ((x === a && y === b) || (x === b && y === a)) return true;
  }
  return false;
}

function areAdjacentOnGroupOrder(
  ga: StationGroupId,
  gb: StationGroupId,
  lineId: LineId,
): boolean {
  const order = getCachedLineGroupOrder(lineId);
  if (!order) return false;
  for (let i = 0; i < order.length - 1; i++) {
    const x = order[i], y = order[i + 1];
    if ((x === ga && y === gb) || (x === gb && y === ga)) return true;
  }
  return false;
}

/**
 * Returns true if `a` and `b` can be consecutive stops in a route.
 *
 * Three accepted relationships, in priority order:
 *   1. Same line context AND adjacent in that line's row-id order
 *   2. Same physical station (same groupId) — i.e. a transfer in place
 *   3. groupId-adjacent on any line they both touch (cross-operator step)
 *
 * Callers must pre-load the relevant station rows + line orderings via
 * `ensureAdjacency` before calling — this function only inspects the cache.
 */
export function isAdjacent(a: StationId, b: StationId): boolean {
  const sa = getCachedStation(a);
  const sb = getCachedStation(b);
  if (!sa || !sb) return false;

  // (1) Same line + id-adjacent
  if (sa.line && sb.line && sa.line.id === sb.line.id) {
    if (areAdjacentOnIdOrder(a, b, sa.line.id)) return true;
  }

  // (2) Transfer at same physical station
  if (sa.groupId === sb.groupId) return true;

  // (3) groupId-adjacent on any shared line
  const aLineIds = new Set((sa.lines || []).map((l) => l.id));
  for (const line of sb.lines || []) {
    if (!aLineIds.has(line.id)) continue;
    if (areAdjacentOnGroupOrder(sa.groupId, sb.groupId, line.id)) return true;
  }
  return false;
}

/**
 * Returns the line that runs `a → b` as consecutive stops, or null if no
 * such line exists. Used to label segments in the route timeline.
 *
 * `preferLineId` biases the choice so a route stays on a single line at
 * stops where multiple shared lines happen to be adjacent.
 */
export function connectingLineSync(
  a: StationId,
  b: StationId,
  preferLineId: LineId | null = null,
): ApiLine | null {
  const sa = getCachedStation(a);
  const sb = getCachedStation(b);

  // (1) Same line context + id-adjacent
  if (sa?.line && sb?.line && sa.line.id === sb.line.id && areAdjacentOnIdOrder(a, b, sa.line.id)) {
    return sa.line;
  }

  // (2) Preferred-line bias (id-adjacent or group-adjacent on the preferred line)
  if (preferLineId != null) {
    if (areAdjacentOnIdOrder(a, b, preferLineId)) {
      const found = (sa?.lines || []).find((l) => l.id === preferLineId);
      if (found) return found;
    }
    if (sa && sb && areAdjacentOnGroupOrder(sa.groupId, sb.groupId, preferLineId)) {
      const found = (sa.lines || []).find((l) => l.id === preferLineId);
      if (found) return found;
    }
  }

  // (3) Transfer at same physical station — surface the destination's line so
  //     the route timeline reads as "you switched to <line> here".
  if (sa && sb && sa.groupId === sb.groupId) {
    return sb.line ?? sa.line ?? null;
  }

  // (4) groupId-adjacent on any shared line
  if (sa && sb) {
    const sharedLineIds = new Set<LineId>();
    const aLineIds = new Set((sa.lines || []).map((l) => l.id));
    for (const l of sb.lines || []) {
      if (aLineIds.has(l.id)) sharedLineIds.add(l.id);
    }
    for (const lineId of sharedLineIds) {
      if (areAdjacentOnGroupOrder(sa.groupId, sb.groupId, lineId)) {
        return (sa.lines || []).find((l) => l.id === lineId) ?? null;
      }
    }
  }

  // (5) Fallback: any shared line where row ids are id-adjacent.
  if (sa && sb) {
    const aLineIds = new Set((sa.lines || []).map((l) => l.id));
    for (const line of sb.lines || []) {
      if (!aLineIds.has(line.id)) continue;
      if (areAdjacentOnIdOrder(a, b, line.id)) return line;
    }
  }
  return null;
}

/**
 * Pre-load station details + all incident-line orderings for the given
 * route. Issues at most two batched HTTP calls regardless of how many
 * stations or lines are involved.
 */
export async function ensureAdjacency(stationIds: StationId[]): Promise<void> {
  if (stationIds.length === 0) return;
  const stations = await getStations(stationIds);
  const lineIds = new Set<LineId>();
  for (const s of stations) {
    if (s.line?.id != null) lineIds.add(s.line.id);
    for (const l of s.lines || []) lineIds.add(l.id);
  }
  const missing = [...lineIds].filter((id) => !getCachedLineOrder(id));
  if (missing.length > 0) {
    await getLineListStationIds(missing);
  }
}

export async function connectingLine(a: StationId, b: StationId): Promise<ApiLine | null> {
  await ensureAdjacency([a, b]);
  return connectingLineSync(a, b);
}

/**
 * BFS shortest path between two station rows. Walks each row's line by row
 * id AND treats sibling rows (same `groupId`, different operator) as 0-cost
 * neighbors — that's how transfers across operators get represented in the
 * returned `StationId[]`.
 *
 * Frontier-batched: each BFS depth issues at most two upstream calls (load
 * stations + load any uncached line orderings). Bounded by `maxNodes`.
 */
export async function shortestPath(
  start: StationId,
  goal: StationId,
  maxNodes = 600,
): Promise<StationId[] | null> {
  if (start === goal) return [start];

  const prev = new Map<StationId, StationId | null>();
  prev.set(start, null);
  let frontier: StationId[] = [start];
  let visited = 1;

  while (frontier.length > 0 && visited < maxNodes) {
    const stations = await getStations(frontier);

    const lineIds = new Set<LineId>();
    for (const s of stations) {
      if (s.line?.id != null) lineIds.add(s.line.id);
      for (const l of s.lines || []) lineIds.add(l.id);
    }
    const missingLines = [...lineIds].filter((id) => !getCachedLineOrder(id));
    if (missingLines.length > 0) {
      await getLineListStationIds(missingLines);
    }

    const nextFrontier: StationId[] = [];
    const enqueue = (n: StationId, parent: StationId): boolean => {
      if (prev.has(n)) return false;
      prev.set(n, parent);
      if (n === goal) return true;
      nextFrontier.push(n);
      visited++;
      return false;
    };

    let reachedGoal = false;
    for (const cur of frontier) {
      if (reachedGoal) break;
      const s = getCachedStation(cur);
      if (!s) continue;
      const lineCandidates = new Set<LineId>();
      if (s.line?.id != null) lineCandidates.add(s.line.id);
      for (const l of s.lines || []) lineCandidates.add(l.id);
      for (const lineId of lineCandidates) {
        const idOrder = getCachedLineOrder(lineId);
        const groupOrder = getCachedLineGroupOrder(lineId);
        if (!idOrder || !groupOrder) continue;
        // Locate this physical station on this line (groupId-based) so we
        // can also enter the sibling row for line `lineId`.
        const gIdx = groupOrder.indexOf(s.groupId);
        if (gIdx < 0) continue;
        const transferTarget = idOrder[gIdx];
        if (transferTarget !== cur) {
          if (enqueue(transferTarget, cur)) { reachedGoal = true; break; }
        }
        // Walk neighbors on this line via the line's own row-ids.
        const neighbors: StationId[] = [];
        if (gIdx > 0) neighbors.push(idOrder[gIdx - 1]);
        if (gIdx < idOrder.length - 1) neighbors.push(idOrder[gIdx + 1]);
        for (const n of neighbors) {
          if (enqueue(n, transferTarget !== cur ? transferTarget : cur)) {
            reachedGoal = true;
            break;
          }
          if (visited >= maxNodes) return null;
        }
      }
    }
    if (reachedGoal) {
      const path: StationId[] = [goal];
      let p: StationId | null = goal;
      while (prev.get(p!) != null) {
        p = prev.get(p!)!;
        path.push(p);
      }
      return path.reverse();
    }
    frontier = nextFrontier;
  }
  return null;
}

/**
 * Validate by walking each consecutive pair. Assumes adjacency cache is
 * warm. Each segment's chosen line is fed forward as a preference for the
 * next segment so the validator stays on a single line wherever possible.
 */
export function validateRouteSync(stationIds: StationId[]): ValidationResult {
  const segments: Segment[] = [];
  let ok = true;
  let prevLineId: LineId | null = null;
  for (let i = 0; i < stationIds.length - 1; i++) {
    const a = stationIds[i], b = stationIds[i + 1];
    const line = connectingLineSync(a, b, prevLineId);
    if (!line) ok = false;
    segments.push({ from: a, to: b, line: line ? line.id : null });
    prevLineId = line?.id ?? null;
  }
  return { ok, segments };
}

export async function validateRoute(stationIds: StationId[]): Promise<ValidationResult> {
  await ensureAdjacency(stationIds);
  return validateRouteSync(stationIds);
}

/** All lines at this physical station (`Station.lines`). */
export function linesAt(id: StationId): ApiLine[] {
  return getCachedStation(id)?.lines ?? [];
}

/** The line context of this row (`Station.line`), if known. */
export function lineOf(id: StationId): ApiLine | null {
  return getCachedStation(id)?.line ?? null;
}

// Re-exports kept for callers that bypass cache.ts.
export { getCachedStationByGroupId, stationIdForGroupOnLine };
