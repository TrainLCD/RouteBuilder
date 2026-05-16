import type { StationId } from '../api/types';

export type Route = {
  id: string;
  name: string;
  /** Per-operator Station.id list. See `StationId` in `lib/api/types.ts`. */
  stations: StationId[];
  updated: string;
  /** Optional accent color override (hex). When absent, derived from the first segment line. */
  color?: string;
};
