"use client";

import { version } from "../package.json";
import { useMakeCustomRoute } from "./hooks/useMakeCustomRoute";

export default function Home() {
  const {
    handleSearch,
    findLineByStationId,
    updateFromLineId,
    updateSelectedStation,
    addedStations: [firstStation, ...addedStations],
    reachableStations,
    transferableLines,
    completed,
    popStation,
    clearResult,
  } = useMakeCustomRoute();

  const handleSearchFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const query = formData.get("name")?.toString();
    if (!query) {
      return;
    }
    handleSearch(query.trim());
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

      {!firstStation && (
        <form onSubmit={handleSearchFormSubmit}>
          <label htmlFor="first-station-form">始発駅:</label>
          <input type="search" id="first-station-form" name="name" />
          <input className="mr-1 bg-black text-white" type="submit" />
        </form>
      )}

      {firstStation && (
        <p>
          経由駅:{" "}
          {[firstStation, ...addedStations]
            .map((sta) => `${sta.name}(${findLineByStationId(sta.id)?.name})`)
            .join(" -> ")}
        </p>
      )}
      {!!reachableStations.length && (
        <form onSubmit={handleReachableStationSelected}>
          <select
            className="w-min"
            name="stations"
            defaultValue={reachableStations[reachableStations.length - 1].id}
          >
            {reachableStations.map((sta) => (
              <option
                disabled={
                  firstStation?.groupId === sta.groupId ||
                  addedStations.some((added) => added.groupId === sta.groupId)
                }
                key={sta.id}
                value={sta.id}
              >
                {sta.name}
                {!firstStation ? `(${findLineByStationId(sta.id)?.name})` : ""}
              </option>
            ))}
          </select>
          <input className="mr-1 bg-black text-white" type="submit" />
        </form>
      )}

      {!!transferableLines.length && (
        <form onSubmit={handleSelectLine}>
          <select className="w-min" name="lines">
            {transferableLines.map((line) => (
              <option
                disabled={addedStations.some((sta) => sta.lineId === line.id)}
                key={line.id}
                value={line.id}
              >
                {line.name}
              </option>
            ))}
          </select>
          <input className="mr-1 bg-black text-white" type="submit" />
        </form>
      )}

      {completed && (
        <div className="flex mt-4">
          <button className="mr-1 bg-black text-white">おわり</button>
          <button onClick={popStation} className="mr-1 bg-black text-white">
            １駅戻る
          </button>
          <button onClick={clearResult} className="bg-red-600 text-white">
            クリア
          </button>
        </div>
      )}
    </main>
  );
}
