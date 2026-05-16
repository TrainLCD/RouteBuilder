// Typed wrappers around the upstream TrainLCD GraphQL operations the BFF needs.
//
// Every query that exposes the `transportType` argument is pinned to `Rail`.
// Route Builder only deals with trains; bus stops/lines (and bus components
// of station.lines arrays) would only add noise to search and the line
// pills. `Rail` is one of the TransportType enum values
// (`TransportTypeUnspecified | Rail | Bus | RailAndBus`).

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
      stationsByName(name: $name, limit: $limit, transportType: Rail) { ${STATION_FIELDS} }
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
      stations(ids: $ids, transportType: Rail) { ${STATION_FIELDS} }
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
      lineListStations(lineIds: $lineIds, transportType: Rail) { ${STATION_FIELDS} }
    }`,
    { lineIds },
  );
  return data.lineListStations;
}

// `line(lineId)` doesn't take a transportType argument — it returns the
// single Line record by id regardless.
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
      stationGroupStations(groupId: $groupId, transportType: Rail) { ${STATION_FIELDS} }
    }`,
    { groupId },
  );
  return data.stationGroupStations;
}
