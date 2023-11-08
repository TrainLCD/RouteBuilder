"use client";

import { ChangeEvent, useState } from "react";
import { version } from "../package.json";
import { FETCH_STATIONS_MAX_COUNT } from "./constants";
import { useMakeCustomRoute } from "./hooks/useMakeCustomRoute";

export default function Home() {
  const {
    handleSearch,
    updateFromLineId,
    addStation,
    addedStations,
    back,
    reachableStations,
    transferableLines,
    completed,
    clearResult,
  } = useMakeCustomRoute();
  const [firstStation] = addedStations;
  const lastStation = addedStations[addedStations.length - 1];

  const [searchResultEmpty, setSearchResultEmpty] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<
    number | undefined
  >();
  const [selectedLineId, setSelectedLineId] = useState<number | undefined>();

  const handleSelectedStationChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setSelectedStationId(parseInt(e.currentTarget.value));
  const handleSelectedLineChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setSelectedLineId(parseInt(e.currentTarget.value));

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
    setSelectedStationId(undefined);
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
    addStation(station);
  };

  const handleUpload = () => undefined;
  const handleClear = () => confirm("クリアしますか？") && clearResult();

  return (
    <main className="flex min-h-screen flex-col p-4">
      <h1 className="text-2xl mb-4">RouteBuilder v{version}</h1>

      <div className="flex">
        <div className="flex-auto">
          {!firstStation && (
            <form className="mb-2" onSubmit={handleSearchFormSubmit}>
              <label htmlFor="search-station-input" className="block">
                始発駅を検索:
              </label>
              <input
                autoFocus
                className="border border-gray-400 rounded p-1 w-64"
                type="search"
                id="search-station-input"
                name="name"
              />
              <input
                className="mr-1 bg-black text-white rounded ml-1 px-4 py-1"
                type="submit"
              />
            </form>
          )}

          {!!transferableLines.length && lastStation && (
            <form className="mb-2" onSubmit={handleSelectLine}>
              <label htmlFor="select-line-input" className="block">
                {lastStation.name}駅からの路線を選択:
              </label>

              <select
                autoFocus
                className="border border-gray-400 rounded p-1 w-64"
                name="lines"
                id="select-line-input"
                onChange={handleSelectedLineChange}
                value={selectedLineId}
              >
                <optgroup label={`${lastStation?.name}駅`}>
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
              <input
                className="mr-1 bg-black text-white rounded ml-1 px-4 py-1"
                type="submit"
              />
            </form>
          )}

          {!!reachableStations.length && (
            <form className="mb-2" onSubmit={handleReachableStationSelected}>
              <label htmlFor="select-station-input" className="block">
                {firstStation
                  ? `${lastStation.name}の次の停車駅`
                  : "路線を選択"}
                :
              </label>
              <select
                autoFocus
                className="border border-gray-400 rounded p-1 w-64"
                name="stations"
                id="select-station-input"
                value={selectedStationId}
                onChange={handleSelectedStationChange}
              >
                <optgroup
                  label={
                    firstStation
                      ? reachableStations[0]?.line?.nameShort
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
              <input
                className="mr-1 bg-black text-white rounded ml-1 px-4 py-1 disabled:bg-neutral-500"
                type="submit"
                disabled={
                  firstStation
                    ? (addedStations.length === 1 && !selectedStationId) ||
                      addedStations.some((sta) => sta.id === selectedStationId)
                    : false
                }
              />
            </form>
          )}

          {
            <p className="text-sm">
              {reachableStations.length === FETCH_STATIONS_MAX_COUNT &&
                `${FETCH_STATIONS_MAX_COUNT}件の検索結果が取得されました。目的の駅が表示されていない場合、検索条件を絞ってください。`}
            </p>
          }

          {searchResultEmpty && <p>検索結果がありませんでした</p>}

          {completed && (
            <p className="font-bold mb-2">
              {lastStation?.line?.nameShort} {lastStation?.name}
              駅には乗換駅がありません
            </p>
          )}
          <div className="flex">
            <button
              onClick={handleUpload}
              disabled={true} // TODO: アプリでデータを使用する機能が実装されたら外す
              className="mr-1 bg-black text-white rounded px-2 py-1 disabled:bg-neutral-500"
            >
              アプリに使用する
            </button>

            {firstStation && (
              <>
                <button
                  onClick={back}
                  className="mr-1 bg-black text-white rounded px-2 py-1"
                >
                  やり直す
                </button>
                <button
                  onClick={handleClear}
                  className="bg-red-600 text-white rounded px-2 py-1"
                >
                  クリア
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex-auto">
          {!!addedStations.length && (
            <table className="table-auto border-collapse border">
              <thead>
                <tr>
                  <th className="border p-1">駅名</th>
                  <th className="border p-1">路線名</th>
                  <th className="border p-1">通過指定</th>
                </tr>
              </thead>
              <tbody>
                {addedStations.map((sta) => (
                  <tr key={sta.id}>
                    <td className="border p-1">{sta.name}</td>
                    <td className="border p-1">{sta.line?.nameShort}</td>
                    <td className="border p-1">
                      <input type="checkbox" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
