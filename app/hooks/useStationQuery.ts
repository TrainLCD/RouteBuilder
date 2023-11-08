import { STUB_DB } from "../constants";

export const useStationQuery = () => {
  const searchStation = (query: string) =>
    STUB_DB.stations.filter((station) => station.name.includes(query));
  const getStationsByLineId = (lineId: number) =>
    STUB_DB.stations.filter((station) => station.lineId === lineId);
  const getTransferableStations = (groupId: number) =>
    STUB_DB.stations.filter((station) => station.groupId === groupId);
  const findLineByStationId = (stationId: number) =>
    STUB_DB.lines.find((line) =>
      STUB_DB.stations.some(
        (sta) => sta.id === stationId && sta.lineId === line.id
      )
    );

  return {
    searchStation,
    getStationsByLineId,
    getTransferableStations,
    findLineByStationId,
  };
};
