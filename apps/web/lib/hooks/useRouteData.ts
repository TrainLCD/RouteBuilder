import { useEffect } from 'react';
import { getStations } from '../api/cache';
import { ensureAdjacency } from '../data/routing';
import type { StationGroupId } from '../api/types';

/**
 * Triggers loading of station details + line adjacency data for the given
 * station IDs into the global cache. No return value — callers also use
 * `useDataStore` to re-render once data arrives.
 */
export function useRouteData(stationIds: StationGroupId[]): void {
  // The dependency on the joined string means we only refetch when the actual
  // set of IDs changes, not on every parent re-render.
  const key = stationIds.join(',');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await getStations(stationIds);
      if (cancelled) return;
      await ensureAdjacency(stationIds);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Fire-and-forget bulk loader for the My Routes screen. */
export function useAllRoutesData(stationIdLists: StationGroupId[][]): void {
  const key = stationIdLists.map((s) => s.join(',')).join('|');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = [...new Set(stationIdLists.flat())];
      await getStations(all);
      if (cancelled) return;
      await ensureAdjacency(all);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
