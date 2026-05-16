// Mirror of TrainLCD GraphQL types — only the fields we use.

/**
 * Application-level station identifier. This is `Station.id` — the
 * operator-specific row id. Routes track `StationId`s so that the line
 * context for each stop is unambiguous (each row carries its own `.line`).
 */
export type StationId = number;

/** Logical-station identifier (`Station.groupId`). Used by search results
 *  for deduping the physical location across operators, but routes themselves
 *  carry `StationId` (not group id). */
export type StationGroupId = number;

export type LineId = number;

export type ApiStationNumber = {
  lineSymbol: string;
  lineSymbolColor: string;
  lineSymbolShape: string;
  stationNumber: string;
};

export type ApiLine = {
  id: LineId;
  nameShort: string;
  nameFull: string | null;
  nameRoman: string | null;
  color: string;
};

export type ApiStation = {
  id: StationId;
  groupId: StationGroupId;
  name: string;
  nameRoman: string | null;
  threeLetterCode: string | null;
  prefectureId: number | null;
  /** Every line that runs through this physical station. */
  lines: ApiLine[];
  /** The line context of THIS row — present when the row was returned by
   *  `lineStations`, `lineListStations`, `stations(ids)`, etc. For a route
   *  on the Ginza Line, `line.id` is 28001 at every stop. */
  line?: ApiLine | null;
  stationNumbers?: ApiStationNumber[];
};
