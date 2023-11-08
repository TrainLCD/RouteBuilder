"use client";

import { useState } from "react";
import { useStationQuery } from ".";
import { StubLine, StubStation } from "../constants/stubDB";

export const useMakeCustomRoute = () => {
  const [addedStations, setAddedStations] = useState<StubStation[]>([]);
  const [reachableStations, setReachableStations] = useState<StubStation[]>([]);
  const [transferableLines, setTransferableLines] = useState<StubLine[]>([]);
  const [completed, setCompleted] = useState(false);

  const {
    searchStation,
    findLineByStationId,
    getTransferableStations,
    getStationsByLineId,
  } = useStationQuery();

  const handleSearch = (query: string | null) => {
    if (!query) {
      return;
    }
    setReachableStations(
      searchStation(query).filter(
        (sta) => sta.id !== addedStations[addedStations.length - 1]?.id
      )
    );
  };

  const updateSelectedStation = (station: StubStation) => {
    if (!addedStations.length) {
      setAddedStations((prev) => [...prev, station]);
      setReachableStations(getStationsByLineId(station.lineId));
      return;
    }

    setAddedStations((prev) => [...prev, station]);

    const nextTransferableStations = getTransferableStations(station.groupId)
      .map((sta) => findLineByStationId(sta.id))
      .filter((line) => line?.id !== station.lineId) as StubLine[];

    if (nextTransferableStations.length < 1) {
      setTransferableLines([]);
      setReachableStations([]);
      setCompleted(true);
      return;
    }

    setTransferableLines(nextTransferableStations);
    setReachableStations([]);
  };

  const updateFromLineId = (lineId: number) => {
    setReachableStations(getStationsByLineId(lineId));
    setTransferableLines([]);
  };

  const popStation = () => {
    const lastStation = addedStations[addedStations.length - 1];
    setAddedStations((prev) => prev.slice(0, -1));
    setReachableStations(getStationsByLineId(lastStation.lineId));
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
    findLineByStationId,
    popStation,
    clearResult,
    transferableLines,
    completed,
  };
};
