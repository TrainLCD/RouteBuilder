"use client";

import { useState } from "react";
import { useStationQuery } from ".";
import { Line, Station } from "../generated/stationapi_pb";

export const useMakeCustomRoute = () => {
  const [addedStations, setAddedStations] = useState<Station.AsObject[]>([]);
  const [reachableStations, setReachableStations] = useState<
    Station.AsObject[]
  >([]);
  const [transferableLines, setTransferableLines] = useState<Line.AsObject[]>(
    []
  );
  const [completed, setCompleted] = useState(false);

  const { searchStation, getTransferableStations, getStationsByLineId } =
    useStationQuery();

  const handleSearch = async (query: string | null) => {
    if (!query) {
      return [];
    }
    const stations = await searchStation(query);
    setReachableStations(stations);
    return stations;
  };

  const updateSelectedStation = async (station: Station.AsObject) => {
    if (!addedStations.length && station.line?.id) {
      setAddedStations((prev) => [...prev, station]);
      setReachableStations(await getStationsByLineId(station.line?.id));
      return;
    }

    setAddedStations((prev) => [...prev, station]);

    const nextTransferableStations = (
      await getTransferableStations(station.groupId)
    )
      .filter((sta) => sta.id !== station.id)
      .filter((sta) => !addedStations.some((added) => added.id === sta.id))
      .map((sta) => sta.line)
      .filter((sta) => sta) as Line.AsObject[];
    if (nextTransferableStations.length <= 1) {
      setTransferableLines([]);
      setReachableStations([]);
      setCompleted(true);
      return;
    }
    setTransferableLines(nextTransferableStations);
    setReachableStations([]);
  };

  const updateFromLineId = async (lineId: number) => {
    setReachableStations(await getStationsByLineId(lineId));
    setTransferableLines([]);
  };

  const popStation = async () => {
    const lastStation = addedStations[addedStations.length - 1];
    setAddedStations((prev) => prev.slice(0, -1));
    setReachableStations(await getTransferableStations(lastStation.id));
    setCompleted(false);
  };

  const clearResult = () => {
    setAddedStations([]);
    setReachableStations([]);
    setTransferableLines([]);
    setCompleted(false);
  };

  return {
    addedStations,
    reachableStations,
    updateSelectedStation,
    handleSearch,
    updateFromLineId,
    popStation,
    clearResult,
    transferableLines,
    completed,
  };
};
