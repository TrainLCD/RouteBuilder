// Typed wrappers around the upstream TrainLCD GraphQL operations the BFF needs.

import { gql } from './upstream';

const STATION_FIELDS = `
  id
  groupId
  name
  nameRoman
  threeLetterCode
  prefectureId
  lines { id nameShort nameFull nameRoman color }
  line { id nameShort nameFull nameRoman color }
  stationNumbers { lineSymbol lineSymbolColor lineSymbolShape stationNumber }
`;

const LINE_FIELDS = `
  id nameShort nameFull nameRoman color
`;

export type ApiLine = {
  id: number;
  nameShort: string;
  nameFull: string | null;
  nameRoman: string | null;
  color: string;
};

export type ApiStationNumber = {
  lineSymbol: string;
  lineSymbolColor: string;
  lineSymbolShape: string;
  stationNumber: string;
};

export type ApiStation = {
  id: number;
  groupId: number;
  name: string;
  nameRoman: string | null;
  threeLetterCode: string | null;
  prefectureId: number | null;
  lines: ApiLine[];
  line?: ApiLine | null;
  stationNumbers?: ApiStationNumber[];
};

export async function upstreamSearchStationsByName(
  name: string,
  limit: number,
): Promise<ApiStation[]> {
  const data = await gql<{ stationsByName: ApiStation[] }>(
    `query SearchByName($name: String!, $limit: Int) {
      stationsByName(name: $name, limit: $limit) { ${STATION_FIELDS} }
    }`,
    { name, limit },
  );
  return data.stationsByName;
}

export async function upstreamStationsByIds(
  ids: number[],
): Promise<ApiStation[]> {
  if (ids.length === 0) return [];
  const data = await gql<{ stations: ApiStation[] }>(
    `query StationsBatch($ids: [Int!]!) {
      stations(ids: $ids) { ${STATION_FIELDS} }
    }`,
    { ids },
  );
  return data.stations;
}

export async function upstreamLineListStations(
  lineIds: number[],
): Promise<ApiStation[]> {
  if (lineIds.length === 0) return [];
  const data = await gql<{ lineListStations: ApiStation[] }>(
    `query LineListStations($lineIds: [Int!]!) {
      lineListStations(lineIds: $lineIds) { ${STATION_FIELDS} }
    }`,
    { lineIds },
  );
  return data.lineListStations;
}

export async function upstreamLine(lineId: number): Promise<ApiLine | null> {
  const data = await gql<{ line: ApiLine | null }>(
    `query GetLine($lineId: Int!) {
      line(lineId: $lineId) { ${LINE_FIELDS} }
    }`,
    { lineId },
  );
  return data.line;
}

export async function upstreamStationGroupStations(
  groupId: number,
): Promise<ApiStation[]> {
  const data = await gql<{ stationGroupStations: ApiStation[] }>(
    `query GroupStations($groupId: Int!) {
      stationGroupStations(groupId: $groupId) { ${STATION_FIELDS} }
    }`,
    { groupId },
  );
  return data.stationGroupStations;
}
