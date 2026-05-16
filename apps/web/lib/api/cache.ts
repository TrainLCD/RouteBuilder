import { DataLoader } from './dataloader';
import {
  fetchLine,
  fetchLineListStations,
  fetchStationGroupStations,
  fetchStationsByIds,
} from './queries';
import type {
  ApiLine,
  ApiStation,
  LineId,
  StationGroupId,
  StationId,
} from './types';

/**
 * In-memory cache for stations and lines, keyed by `Station.id` (the
 * operator-specific row id) — NOT by `groupId`. Routes built on a particular
 * line carry that line's specific row ids, so each cached `ApiStation`
 * exposes its own `.line` directly. That removes the need to disambiguate
 * which line a stop belongs to when multiple operators share a physical
 * station (e.g. 上野 is on JR, Tokyo Metro Ginza, Tokyo Metro Hibiya — each
 * has its own row id).
 *
 * Subscribers are notified whenever the cache mutates so React components can
 * re-render once previously-missing data has arrived.
 */

const stationById = new Map<StationId, ApiStation>();
const lineById = new Map<LineId, ApiLine>();
const lineStationIds = new Map<LineId, StationId[]>();

/**
 * Per-line ordered list of `Station.groupId`s, parallel to `lineStationIds`.
 * Same index = same physical stop. Used for cross-operator adjacency
 * (e.g. "are Shibuya and Harajuku adjacent on Yamanote?") without caring
 * which operator's row id you happen to have on hand.
 */
const lineStationGroupIds = new Map<LineId, StationGroupId[]>();

/** Canonical representative station per `groupId` (first row we see). */
const stationByGroupId = new Map<StationGroupId, ApiStation>();

const subscribers = new Set<() => void>();

function notify(): void {
  for (const fn of subscribers) fn();
}

export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function rememberStation(s: ApiStation): ApiStation {
  const existing = stationById.get(s.id);
  if (existing) {
    // Same row — merge in any extra lines we just learned about.
    const lineMap = new Map<LineId, ApiLine>();
    for (const l of existing.lines || []) lineMap.set(l.id, l);
    for (const l of s.lines || []) lineMap.set(l.id, l);
    existing.lines = [...lineMap.values()];
    // If the new payload includes a `line` (line-context for this row) and
    // we didn't have one cached, take it. Don't overwrite an existing one.
    if (!existing.line && s.line) existing.line = s.line;
    for (const l of existing.lines) lineById.set(l.id, l);
    if (existing.line) lineById.set(existing.line.id, existing.line);
    return existing;
  }
  const entry: ApiStation = { ...s };
  stationById.set(s.id, entry);
  if (!stationByGroupId.has(s.groupId)) {
    stationByGroupId.set(s.groupId, entry);
  }
  for (const l of entry.lines || []) lineById.set(l.id, l);
  if (entry.line) lineById.set(entry.line.id, entry.line);
  return entry;
}

export function ingestStations(stations: ApiStation[]): ApiStation[] {
  const out = stations.map(rememberStation);
  if (out.length > 0) notify();
  return out;
}

export function getCachedStation(id: StationId): ApiStation | undefined {
  return stationById.get(id);
}

export function getCachedLine(lineId: LineId): ApiLine | undefined {
  return lineById.get(lineId);
}

export function getCachedLineOrder(lineId: LineId): StationId[] | undefined {
  return lineStationIds.get(lineId);
}

export function getCachedLineGroupOrder(lineId: LineId): StationGroupId[] | undefined {
  return lineStationGroupIds.get(lineId);
}

export function getCachedStationByGroupId(groupId: StationGroupId): ApiStation | undefined {
  return stationByGroupId.get(groupId);
}

/**
 * Given a station's `groupId` and a line it belongs to, return the
 * line-specific `Station.id` (the operator row at that stop). Useful when
 * walking the network across operators — the receiver of a transfer needs
 * the row id keyed to the new line.
 */
export function stationIdForGroupOnLine(
  groupId: StationGroupId,
  lineId: LineId,
): StationId | null {
  const groupOrder = lineStationGroupIds.get(lineId);
  const idOrder = lineStationIds.get(lineId);
  if (!groupOrder || !idOrder) return null;
  const idx = groupOrder.indexOf(groupId);
  if (idx < 0 || idx >= idOrder.length) return null;
  return idOrder[idx];
}

// ---------- DataLoaders ----------

/**
 * Stations loader: batches concurrent `getStation(id)` calls into a single
 * `stations(ids: [...])` upstream request. Returns the merged station rows
 * keyed by their `id`.
 */
const stationLoader = new DataLoader<StationId, ApiStation>(async (ids) => {
  const out = new Map<StationId, ApiStation>();
  let mutated = false;

  try {
    const rows = await fetchStationsByIds(ids);
    for (const r of rows) {
      const merged = rememberStation(r);
      out.set(merged.id, merged);
      mutated = true;
    }
  } catch {
    // fall through to per-id fallback below
  }

  // Any id not returned by the batch query: fall back to the group endpoint
  // and pick the matching row. Rare in practice — `stations(ids)` is reliable.
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length > 0) {
    const fallbacks = await Promise.all(
      missing.map(async (sid) => {
        try {
          const rows = await fetchStationGroupStations(sid);
          const exact = rows.find((r) => r.id === sid) ?? rows[0];
          if (!exact) return null;
          return rememberStation(exact);
        } catch {
          return null;
        }
      }),
    );
    for (const s of fallbacks) {
      if (s) {
        out.set(s.id, s);
        mutated = true;
      }
    }
  }

  if (mutated) notify();
  return out;
}, { maxBatch: 60, splitOnError: true });

/**
 * Line-stations loader: batches concurrent `getLineStationIds(lineId)` calls
 * into a single `lineListStations(lineIds: [...])` request and groups the
 * resulting Station rows by their `line.id`.
 */
const lineStationsLoader = new DataLoader<LineId, StationId[]>(async (lineIds) => {
  const out = new Map<LineId, StationId[]>();
  try {
    const rows = await fetchLineListStations(lineIds);
    const byLine = new Map<LineId, ApiStation[]>();
    for (const r of rows) {
      const lid = r.line?.id;
      if (lid == null) continue;
      const arr = byLine.get(lid) ?? [];
      arr.push(r);
      byLine.set(lid, arr);
    }
    for (const [lid, list] of byLine) {
      list.forEach(rememberStation);
      const ids = list.map((s) => s.id);
      const groupIds = list.map((s) => s.groupId);
      lineStationIds.set(lid, ids);
      lineStationGroupIds.set(lid, groupIds);
      out.set(lid, ids);
    }
    if (rows.length > 0) notify();
  } catch (err) {
    // DataLoader will catch and split-retry; re-throw so it kicks in.
    throw err;
  }
  return out;
}, { maxBatch: 5, splitOnError: true });

// ---------- Public API ----------

export async function getStation(id: StationId): Promise<ApiStation | null> {
  const cached = stationById.get(id);
  if (cached) return cached;
  return stationLoader.load(id);
}

export async function getStations(ids: StationId[]): Promise<ApiStation[]> {
  if (ids.length === 0) return [];
  const missing = ids.filter((id) => !stationById.has(id));
  if (missing.length > 0) {
    await stationLoader.loadMany(missing);
  }
  const out: ApiStation[] = [];
  for (const id of ids) {
    const s = stationById.get(id);
    if (s) out.push(s);
  }
  return out;
}

export async function getLineStationIds(lineId: LineId): Promise<StationId[]> {
  const cached = lineStationIds.get(lineId);
  if (cached) return cached;
  const result = await lineStationsLoader.load(lineId);
  return result ?? [];
}

export async function getLineListStationIds(
  lineIds: LineId[],
): Promise<Map<LineId, StationId[]>> {
  const map = new Map<LineId, StationId[]>();
  const missing: LineId[] = [];
  for (const id of lineIds) {
    const cached = lineStationIds.get(id);
    if (cached) map.set(id, cached);
    else missing.push(id);
  }
  if (missing.length > 0) {
    await lineStationsLoader.loadMany(missing);
    for (const id of missing) {
      const cached = lineStationIds.get(id);
      if (cached) map.set(id, cached);
    }
  }
  return map;
}

export async function getLine(lineId: LineId): Promise<ApiLine | null> {
  const cached = lineById.get(lineId);
  if (cached) return cached;
  const fetched = await fetchLine(lineId);
  if (fetched) {
    lineById.set(lineId, fetched);
    notify();
  }
  return fetched;
}

/** All lines this physical station serves (`Station.lines`). */
export function linesAtCached(id: StationId): ApiLine[] {
  const s = stationById.get(id);
  return s?.lines ?? [];
}

/** The single line context of this station row (`Station.line`). */
export function lineOfCached(id: StationId): ApiLine | null {
  return stationById.get(id)?.line ?? null;
}

export async function ensureStationLines(id: StationId): Promise<ApiLine[]> {
  const s = await getStation(id);
  return s?.lines ?? [];
}
