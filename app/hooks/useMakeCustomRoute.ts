"use client";

import { useState } from "react";
import { useStationQuery } from ".";
import { Line, Station, StopCondition } from "../generated/stationapi_pb";

export const useMakeCustomRoute = () => {
  const [addedStations, setAddedStations] = useState<Station.AsObject[][]>([]);
  const [reachableLocalStations, setReachableLocalStations] = useState<
    Station.AsObject[]
  >([]);
  const [transferableLines, setTransferableLines] = useState<Line.AsObject[]>(
    []
  );
  const [completed, setCompleted] = useState(false);

  const { searchStation, getTransferableStations, getStations } =
    useStationQuery();

  const handleSearch = async (query: string | null) => {
    if (!query) {
      return [];
    }
    const stations = await searchStation(query);
    setReachableLocalStations(stations);
    return stations;
  };

  const addStation = async (station: Station.AsObject) => {
    if (!station.line) {
      return;
    }

    const [localStations] = await getStations(station);

    if (!addedStations.length) {
      setAddedStations((prev) => [...prev, [station]]);
      setReachableLocalStations(localStations);
      return;
    }

    setAddedStations((prev) => {
      const prevAddedStationIndex = localStations.findIndex((sta) => {
        const prevLastArray = prev[prev.length - 1];
        if (!prevLastArray) {
          return false;
        }
        return sta.groupId === prevLastArray[prevLastArray.length - 1]?.groupId;
      });
      const currentAddedStationIndex = localStations.findIndex(
        (sta) => sta.groupId === station.groupId
      );
      const stations =
        prevAddedStationIndex > currentAddedStationIndex
          ? localStations
              .slice(currentAddedStationIndex, prevAddedStationIndex + 1)
              .reverse()
          : localStations.slice(
              prevAddedStationIndex,
              currentAddedStationIndex + 1
            );
      // 始発駅しか入っていない配列はもはや不要のため置き換える
      if (prev.length === 1 && prev[0]?.length === 1) {
        return [stations];
      }

      return [...prev, stations];
    });

    const nextTransferableLines = (
      await getTransferableStations(station.groupId)
    )
      .filter((sta) => sta.id !== station.id)
      .filter(
        (sta) =>
          !addedStations.flat().some((added) => added.groupId === sta.groupId)
      )
      .map((sta) => sta.line)
      .filter((line) => line) as Line.AsObject[];

    if (!nextTransferableLines.length) {
      setTransferableLines([]);
      setReachableLocalStations([]);
      setCompleted(true);
      return;
    }
    setTransferableLines(nextTransferableLines);
    setReachableLocalStations([]);
  };

  const updateReachableStations = async (station: Station.AsObject) => {
    const [localStations] = await getStations(station);

    setReachableLocalStations(localStations);
    setTransferableLines([]);
  };

  const back = async () => {
    const isPrevFirstStation = addedStations.length === 1;
    const flattenedAddedStations = addedStations.flat();
    const lastStation =
      flattenedAddedStations[flattenedAddedStations.length - 1];

    if (lastStation.line) {
      const [localStations] = await getStations(lastStation);

      setReachableLocalStations(localStations);
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
    setReachableLocalStations([]);
    setTransferableLines([]);
    setCompleted(false);
  };

  const updateStopCondition = (
    station: Station.AsObject,
    stopCondition: StopCondition
  ) => {
    setAddedStations((prev) =>
      prev.map((arr) =>
        arr.map((sta) =>
          station.id === sta.id ? { ...sta, stopCondition } : sta
        )
      )
    );
  };

  return {
    addedStations: addedStations.flat(),
    reachableLocalStations,
    addStation,
    handleSearch,
    updateReachableStations,
    back,
    clearResult,
    transferableLines,
    completed,
    updateStopCondition,
  };
};
