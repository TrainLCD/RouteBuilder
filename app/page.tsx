"use client";

import { useState } from "react";
import { version } from "../package.json";
import { useMakeCustomRoute } from "./hooks/useMakeCustomRoute";

export default function Home() {
  const {
    handleSearch,
    updateFromLineId,
    updateSelectedStation,
    addedStations,
    reachableStations,
    transferableLines,
    completed,
    popStation,
    clearResult,
  } = useMakeCustomRoute();
  const [firstStation] = addedStations;
  const [searchResultEmpty, setSearchResultEmpty] = useState(false);

  const handleSearchFormSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const query = formData.get("name")?.toString();
    if (!query) {
      return;
    }
    const stations = await handleSearch(query.trim());
    if (!stations.length) {
      setSearchResultEmpty(true);
      return;
    }
    setSearchResultEmpty(false);
  };
  const handleSelectLine = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const linesSelection = formData.get("lines");
    if (!linesSelection) {
      return;
    }
    const lineId = parseInt(linesSelection.toString());
    updateFromLineId(lineId);
  };

  const handleReachableStationSelected = (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const stationsSelection = formData.get("stations");
    if (!stationsSelection) {
      return;
    }
    const stationId = parseInt(stationsSelection.toString());
    const station = reachableStations.find((sta) => sta.id === stationId);
    if (!station) {
      return;
    }
    updateSelectedStation(station);
  };

  return (
    <main className="flex min-h-screen flex-col">
      <h1 className="text-2xl mb-4">RouteBuilder v{version}</h1>

      <div className="flex">
        <div className="flex-auto">
          {!firstStation && (
            <form onSubmit={handleSearchFormSubmit}>
              <label htmlFor="first-station-form">始発駅:</label>
              <input type="search" id="first-station-form" name="name" />
              <input className="mr-1 bg-black text-white" type="submit" />
            </form>
          )}

          {!!transferableLines.length && (
            <form onSubmit={handleSelectLine}>
              <select
                className="w-min"
                name="lines"
                defaultValue={
                  addedStations[addedStations.length - 1]?.line?.id ??
                  firstStation?.id
                }
              >
                <optgroup
                  label={`${addedStations[addedStations.length - 1]?.name}駅`}
                >
                  {transferableLines.map((line) => (
                    <option
                      disabled={addedStations.some(
                        (sta) => sta.line?.id === line.id
                      )}
                      key={line.id}
                      value={line.id}
                    >
                      {line.nameShort}
                    </option>
                  ))}
                </optgroup>
              </select>
              <input className="mr-1 bg-black text-white" type="submit" />
            </form>
          )}

          {!!reachableStations.length && (
            <form onSubmit={handleReachableStationSelected}>
              <select
                className="w-min"
                name="stations"
                defaultValue={reachableStations[0]?.id ?? firstStation?.id}
              >
                <optgroup
                  label={
                    firstStation
                      ? reachableStations[0]?.line?.nameFull
                      : "始発駅"
                  }
                >
                  {reachableStations.map((sta) => (
                    <option
                      disabled={
                        firstStation?.groupId === sta.groupId ||
                        addedStations.some(
                          (added) => added.groupId === sta.groupId
                        )
                      }
                      key={sta.id}
                      value={sta.id}
                    >
                      {!firstStation
                        ? `${sta.name}(${sta.line?.nameShort})`
                        : sta.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <input className="mr-1 bg-black text-white" type="submit" />
            </form>
          )}

          {searchResultEmpty && <p>検索結果がありませんでした</p>}

          {completed && (
            <div className="flex">
              <button className="mr-1 bg-black text-white">おわり</button>
              <button onClick={popStation} className="mr-1 bg-black text-white">
                やり直す
              </button>
              <button onClick={clearResult} className="bg-red-600 text-white">
                クリア
              </button>
            </div>
          )}
        </div>
        <div className="flex-auto">
          {!!addedStations.length && (
            <>
              <p>経由駅:</p>
              <ul className="list-none">
                {addedStations.map((sta, idx) => (
                  <li key={sta.id}>
                    {sta.name}
                    {addedStations[idx - 1]?.line?.id === sta.line?.id
                      ? ""
                      : `(${sta.line?.nameShort})`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
