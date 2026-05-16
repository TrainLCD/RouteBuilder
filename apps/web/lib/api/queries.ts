import { getJson } from './client';
import type { ApiLine, ApiStation, LineId, StationGroupId } from './types';

export async function searchStationsByName(
  name: string,
  limit = 30,
): Promise<ApiStation[]> {
  const data = await getJson<{ stations: ApiStation[] }>(
    `/search?name=${encodeURIComponent(name)}&limit=${limit}`,
  );
  return data.stations;
}

export async function fetchStationsByIds(ids: number[]): Promise<ApiStation[]> {
  if (ids.length === 0) return [];
  const data = await getJson<{ stations: ApiStation[] }>(
    `/stations?ids=${ids.join(',')}`,
  );
  return data.stations;
}

export async function fetchLineListStations(lineIds: LineId[]): Promise<ApiStation[]> {
  if (lineIds.length === 0) return [];
  const data = await getJson<{ stations: ApiStation[] }>(
    `/line-list-stations?lineIds=${lineIds.join(',')}`,
  );
  return data.stations;
}

/** Single-line variant kept for source compatibility — routes through the same BFF endpoint. */
export async function fetchLineStations(lineId: LineId): Promise<ApiStation[]> {
  return fetchLineListStations([lineId]);
}

export async function fetchLine(lineId: LineId): Promise<ApiLine | null> {
  const data = await getJson<{ line: ApiLine | null }>(`/line/${lineId}`);
  return data.line;
}

export async function fetchStationGroupStations(
  groupId: StationGroupId,
): Promise<ApiStation[]> {
  const data = await getJson<{ stations: ApiStation[] }>(
    `/station-group/${groupId}`,
  );
  return data.stations;
}
