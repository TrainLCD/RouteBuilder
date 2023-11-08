"use client";

import { useState } from "react";
import { useStationQuery } from ".";
import { Line, Station } from "../generated/stationapi_pb";

export const useMakeCustomRoute = () => {
  const [addedStations, setAddedStations] = useState<Station.AsObject[][]>([]);
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

  const addStation = async (station: Station.AsObject) => {
    if (!addedStations.length && station.line?.id) {
      setAddedStations((prev) => [...prev, [station]]);
      setReachableStations(await getStationsByLineId(station.line?.id));
      return;
    }

    setAddedStations((prev) => {
      const prevAddedStationIndex = reachableStations.findIndex((sta) => {
        const prevLastArray = prev[prev.length - 1];
        if (!prevLastArray) {
          return false;
        }
        return sta.groupId === prevLastArray[prevLastArray.length - 1]?.groupId;
      });
      const currentAddedStationIndex = reachableStations.findIndex(
        (sta) => sta.groupId === station.groupId
      );
      const stations =
        prevAddedStationIndex > currentAddedStationIndex
          ? reachableStations
              .slice(currentAddedStationIndex, prevAddedStationIndex + 1)
              .reverse()
          : reachableStations.slice(
              prevAddedStationIndex,
              currentAddedStationIndex + 1
            );
      // 始発駅しか入っていない配列はもはや不要のため置き換える
      if (prev.length === 1 && prev[0]?.length === 1) {
        return [stations];
      }
      return [...prev, stations];
    });

    const nextTransferableStations = (
      await getTransferableStations(station.groupId)
    )
      .filter((sta) => sta.id !== station.id)
      .filter(
        (sta) =>
          !addedStations.flat().some((added) => added.groupId === sta.groupId)
      )
      .map((sta) => sta.line)
      .filter((line) => line) as Line.AsObject[];
    if (!nextTransferableStations.length) {
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

  const back = async () => {
    const isPrevFirstStation = addedStations.length === 1;
    const flattenedAddedStations = addedStations.flat();
    const lastStation =
      flattenedAddedStations[flattenedAddedStations.length - 1];

    if (lastStation.line) {
      setReachableStations(await getStationsByLineId(lastStation.line.id));
    }

    if (!isPrevFirstStation) {
      setAddedStations((prev) => prev.slice(0, -1));
      setTransferableLines([]);
      setCompleted(false);
      return;
    }

    const firstStation = flattenedAddedStations[0];

    if (firstStation.id === lastStation.id) {
      setAddedStations([]);
      setTransferableLines([]);
      setCompleted(false);
      return;
    }

    setAddedStations([[firstStation]]);
    setTransferableLines([]);
    setCompleted(false);
  };

  const clearResult = () => {
    setAddedStations([]);
    setReachableStations([]);
    setTransferableLines([]);
    setCompleted(false);
  };

  return {
    addedStations: addedStations.flat(),
    reachableStations,
    addStation,
    handleSearch,
    updateFromLineId,
    back,
    clearResult,
    transferableLines,
    completed,
  };
};
