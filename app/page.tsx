"use client";

import { ChangeEvent, useState } from "react";
import pkg from "../package.json";
import {
  FETCH_STATIONS_MAX_COUNT,
  PublishErrorCode,
  STOP_CONDITION_LABELS,
} from "./constants";
import { Station, StopCondition } from "./generated/stationapi_pb";
import { useAnonymousAuth, usePublishRoute } from "./hooks";
import { useMakeCustomRoute } from "./hooks/useMakeCustomRoute";

const { version } = pkg;

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
    updateStopCondition,
  } = useMakeCustomRoute();
  const [firstStation] = addedStations;
  const lastStation = addedStations[addedStations.length - 1];

  const [searchResultEmpty, setSearchResultEmpty] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<
    number | undefined
  >();
  const [selectedLineId, setSelectedLineId] = useState<number | undefined>();
  const [uploading, setUploading] = useState(false);
  const [checkedAddedStations, setCheckedAddedStations] = useState<
    Station.AsObject[]
  >([]);

  const { user: anonymousUser, error: signInAnonymouslyError } =
    useAnonymousAuth();
  const { publish: publishRoute, isPublishable } = usePublishRoute();

  const handleSelectedStationChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setSelectedStationId(parseInt(e.currentTarget.value));
  const handleSelectedLineChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setSelectedLineId(parseInt(e.currentTarget.value));

  const handleCheckAddedStations = (
    e: ChangeEvent<HTMLInputElement>,
    station: Station.AsObject
  ) => {
    const checked = e.currentTarget.checked;
    if (checked) {
      setCheckedAddedStations([...checkedAddedStations, station]);
    } else {
      setCheckedAddedStations(
        checkedAddedStations.filter((sta) => sta.id !== station.id)
      );
    }
  };

  const handleCheckAllStations = (e: ChangeEvent<HTMLInputElement>) => {
    const checked = e.currentTarget.checked;
    if (checked) {
      setCheckedAddedStations(addedStations.slice(1, -1));
    } else {
      setCheckedAddedStations([]);
    }
  };

  const handleUpdateCheckedStations = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const stopCondition = formData.get("stop-condition")?.toString();

    checkedAddedStations.forEach((sta) => {
      updateStopCondition(
        sta,
        Object.values(StopCondition).indexOf(Number(stopCondition ?? 0))
      );
    });
  };

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

  const handleUpload = async () => {
    try {
      const placeholderName = `${firstStation?.name}(${firstStation?.line?.nameShort}) - ${lastStation?.name}(${lastStation.line?.nameShort})`;
      const newTypeName = prompt(
        "保存するルート名を入力してください",
        placeholderName
      );
      if (!newTypeName) {
        return;
      }
      setUploading(true);
      if (await isPublishable({ name: newTypeName })) {
        await publishRoute({
          name: newTypeName ?? placeholderName,
          stations: addedStations,
        });
      }
      setUploading(false);
      alert("アップロードが完了しました");
    } catch (err) {
      setUploading(false);

      const msg = (err as unknown as PublishErrorCode).toString();
      alert(`エラーコード: ${msg}`);
    }
  };
  const handleClear = () => confirm("クリアしますか？") && clearResult();

  const handleUpdateStopCondition = (
    e: ChangeEvent<HTMLSelectElement>,
    station: Station.AsObject
  ) =>
    updateStopCondition(
      station,
      Object.values(StopCondition).indexOf(Number(e.currentTarget.value))
    );

  if (signInAnonymouslyError) {
    return (
      <main className="flex min-h-screen flex-col px-8 py-8 md:px-12">
        <h1 className="text-2xl mb-4">RouteBuilder v{version}</h1>
        <h2>自動認証エラーが発生しました</h2>
      </main>
    );
  }

  if (!anonymousUser) {
    return (
      <main className="flex min-h-screen flex-col px-8 py-8 md:px-12">
        <h1 className="text-2xl mb-4">RouteBuilder v{version}</h1>
        <h2>Loading...</h2>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col px-8 py-8 md:px-12">
      <h1 className="text-2xl mb-4">RouteBuilder v{version}</h1>

      <div className="flex flex-col md:flex-row">
        <div className="flex-1 w-full">
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
                value="検索"
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
                value="指定"
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
                value={firstStation ? "追加" : "指定"}
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
              disabled={addedStations.length <= 1 || uploading}
              className="mr-1 bg-black text-white rounded px-2 py-1 disabled:bg-neutral-500"
            >
              アプリで使用する
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
        <div className="flex-1 w-full mt-8 md:mt-0">
          {!!addedStations.length && (
            <>
              <form className="mb-4" onSubmit={handleUpdateCheckedStations}>
                <label className="font-bold">一括操作:</label>
                <select
                  name="stop-condition"
                  className="border border-gray-400 rounded bg-white disabled:bg-gray-200 ml-2 py-1"
                  disabled={addedStations.length <= 2}
                >
                  {Object.entries(StopCondition).map(([key, val]) => (
                    <option value={val} key={key}>
                      {STOP_CONDITION_LABELS[Number(val)]}
                    </option>
                  ))}
                </select>

                <input
                  className="ml-2 bg-black text-white rounded ml-1 px-4 py-1 disabled:bg-neutral-500"
                  type="submit"
                  value="確定"
                  disabled={addedStations.length <= 2}
                />
              </form>

              <table className="table-fixed w-full border-collapse border">
                <thead>
                  <tr>
                    <th className="border p-1 w-fit w-6 md:w-8">
                      <input
                        type="checkbox"
                        disabled={addedStations.length <= 2}
                        checked={
                          checkedAddedStations.length > addedStations.length - 3
                        }
                        onChange={handleCheckAllStations}
                      />
                    </th>
                    <th className="border p-1 w-fit md:w-1/2">駅名</th>
                    <th className="border p-1 w-fit md:w-1/2">路線名</th>
                    <th className="border p-1 w-fit md:w-32">通過指定</th>
                  </tr>
                </thead>
                <tbody>
                  {addedStations
                    .slice()
                    .reverse()
                    .map((sta, idx, arr) => (
                      <tr key={sta.id}>
                        <td className="border p-1 text-center">
                          <input
                            type="checkbox"
                            disabled={idx === 0 || idx === arr.length - 1}
                            checked={checkedAddedStations.some(
                              (s) => s.id === sta.id
                            )}
                            onChange={(e) => handleCheckAddedStations(e, sta)}
                          />
                        </td>
                        <td className="border p-1">{sta.name}</td>
                        <td className="border p-1">{sta.line?.nameShort}</td>
                        <td className="border p-1">
                          <select
                            className="border border-gray-400 rounded bg-white disabled:bg-gray-200"
                            onChange={(e) => handleUpdateStopCondition(e, sta)}
                            value={sta.stopCondition}
                            disabled={
                              addedStations[0]?.id === sta.id ||
                              addedStations[addedStations.length - 1]?.id ===
                                sta.id
                            }
                          >
                            {Object.entries(StopCondition).map(([key, val]) => (
                              <option value={val} key={key}>
                                {STOP_CONDITION_LABELS[Number(val)]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
