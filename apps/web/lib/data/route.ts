import type { StationId } from '../api/types';

export type Route = {
  id: string;
  name: string;
  /** Per-operator Station.id list. See `StationId` in `lib/api/types.ts`. */
  stations: StationId[];
  /**
   * Subset of `stations` that the user has marked as 通過 (pass-through).
   * Tracked by station id (not index) so the marker survives drag /
   * insert / delete edits naturally. The first and last entries of
   * `stations` are always treated as stops regardless of inclusion here.
   * Default (omitted) = every station is a regular stop.
   */
  passing?: StationId[];
  updated: string;
  /** Optional accent color override (hex). When absent, derived from the first segment line. */
  color?: string;
};
