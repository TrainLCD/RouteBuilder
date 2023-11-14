"use client";

import { ChangeEvent, useRef, useState } from "react";
import pkg from "../package.json";
import {
  AVAILABLE_TRAIN_TYPES,
  AvailableTrainType,
  FETCH_STATIONS_MAX_COUNT,
  PublishErrorCode,
  RESERVED_TRAIN_TYPES,
  STOP_CONDITION_LABELS,
} from "./constants";
import {
  Line,
  Station,
  StopCondition,
  TrainDirection,
} from "./generated/stationapi_pb";
import { useAnonymousAuth, usePublishRoute } from "./hooks";
import { useMakeCustomRoute } from "./hooks/useMakeCustomRoute";
import { groupStations } from "./utils";

const { version } = pkg;

export default function Home() {
  const {
    handleSearch,
    updateReachableStations,
    addStation,
    addedStations,
    back,
    reachableLocalStations,
    transferableLines,
    completed,
    clearResult,
    updateStopCondition,
  } = useMakeCustomRoute();
  const [firstStation] = addedStations;
  const lastStation = addedStations[addedStations.length - 1];

  const [searchResultEmpty, setSearchResultEmpty] = useState(false);
  const [selectedStation, setSelectedStation] =
    useState<Station.AsObject | null>(null);
  const [selectedLine, setSelectedLine] = useState<Line.AsObject | null>(null);
  const [uploading, setUploading] = useState(false);
  const [checkedAddedStations, setCheckedAddedStations] = useState<
    Station.AsObject[]
  >([]);
  const [selectedType, setSelectedType] = useState<AvailableTrainType>(
    AVAILABLE_TRAIN_TYPES.LOCAL
  );

  const customTypeFormRef = useRef<HTMLFormElement | null>(null);

  const { user: anonymousUser, error: signInAnonymouslyError } =
    useAnonymousAuth();
  const { publish: publishRoute, isPublishable } = usePublishRoute();

  const handleSelectedStationChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const station =
      reachableLocalStations.find(
        (sta) => sta.id === Number(e.currentTarget.value)
      ) ?? null;

    setSelectedStation(station);
    setSelectedLine(station?.line ?? null);
  };
  const handleSelectedLineChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedLine(
      transferableLines.find(
        (line) => line.id === Number(e.currentTarget.value)
      ) ?? null
    );
  };

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
  const handleSelectLine = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const linesSelection = formData.get("lines");
    if (!linesSelection) {
      return;
    }
    const lineId = Number(linesSelection.toString());
    const nextLine = transferableLines.find((l) => l.id === lineId);
    if (!nextLine?.station) {
      return;
    }
    // NOTE: nextLine.station.lineはAPIの使用上入っていないので、手動で追加する
    const nextStation = { ...nextLine.station, line: nextLine };
    await updateReachableStations(nextStation);
    setSelectedStation(nextStation);
  };

  const handleReachableStationSelected = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const stationsSelection = formData.get("stations");

    if (!stationsSelection) {
      return;
    }
    const stationId = Number(stationsSelection.toString());
    const station = reachableLocalStations.find((sta) => sta.id === stationId);
    if (!station) {
      return;
    }
    await addStation(station);
    setSelectedStation(station);
  };

  const handleUpload = async () => {
    try {
      const placeholderName = `${firstStation?.name}(${firstStation?.line?.nameShort}) - ${lastStation?.name}(${lastStation.line?.nameShort})`;
      const newTypeName = prompt(
        "保存するルート名を入力してください",
        placeholderName
      );
      const routeName = newTypeName || placeholderName;

      setUploading(true);

      if (!customTypeFormRef.current) {
        if (await isPublishable({ name: routeName })) {
          await publishRoute({
            name: routeName,
            stations: addedStations,
            trainType: selectedType,
          });
        }

        setUploading(false);
        return;
      }

      const formData = new FormData(customTypeFormRef.current);

      const customTypeName =
        formData.get("custom-type-name")?.toString() ||
        AVAILABLE_TRAIN_TYPES.CUSTOM.name;
      const customTypeKatakana =
        formData.get("custom-type-katakana")?.toString() ||
        AVAILABLE_TRAIN_TYPES.CUSTOM.nameKatakana;
      const customTypeRoman =
        formData.get("custom-type-roman")?.toString() ||
        AVAILABLE_TRAIN_TYPES.CUSTOM.nameRoman;
      const customTypeChinese =
        formData.get("custom-type-chinese")?.toString() ||
        AVAILABLE_TRAIN_TYPES.CUSTOM.nameChinese;
      const customTypeColor =
        formData.get("custom-type-color")?.toString() ||
        AVAILABLE_TRAIN_TYPES.CUSTOM.color;
      const customTypeKorean =
        formData.get("custom-type-korean")?.toString() ||
        AVAILABLE_TRAIN_TYPES.CUSTOM.nameKorean;
      const customTypeKey =
        formData.get("custom-type-base")?.toString() ||
        AVAILABLE_TRAIN_TYPES.LOCAL2;
      const { kind: customTypeKind } =
        RESERVED_TRAIN_TYPES[
          customTypeKey as keyof typeof RESERVED_TRAIN_TYPES
        ];

      const customType: AvailableTrainType | null =
        selectedType === AVAILABLE_TRAIN_TYPES.CUSTOM
          ? {
              ...AVAILABLE_TRAIN_TYPES.CUSTOM,
              lines: [],
              id: 2000,
              typeId: 2000,
              groupId: 2000,
              name: customTypeName,
              nameKatakana: customTypeKatakana,
              color: customTypeColor,
              direction: TrainDirection.BOTH,
              kind: customTypeKind,
              nameRoman: customTypeRoman,
              nameChinese: customTypeChinese,
              nameKorean: customTypeKorean,
            }
          : null;

      if (await isPublishable({ name: routeName })) {
        await publishRoute({
          name: routeName,
          stations: addedStations,
          trainType: customType || selectedType,
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

  const handleTypeChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setSelectedType(
      AVAILABLE_TRAIN_TYPES[
        e.currentTarget.value as keyof typeof AVAILABLE_TRAIN_TYPES
      ]
    );

  const groupedByLineIdStations = groupStations(reachableLocalStations);

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
                value={selectedLine?.id}
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
          {!!reachableLocalStations.length && (
            <form className="mb-2" onSubmit={handleReachableStationSelected}>
              <label htmlFor="select-station-input" className="block">
                {lastStation ? `${lastStation.name}の次の停車駅` : "路線を選択"}
                :
              </label>
              <select
                autoFocus
                className="border border-gray-400 rounded p-1 w-64"
                name="stations"
                id="select-station-input"
                value={selectedStation?.id}
                onChange={handleSelectedStationChange}
              >
                {groupedByLineIdStations.map((arr, idx, self) => (
                  <optgroup
                    key={self[idx][0]?.id}
                    label={self[idx][0].line?.nameShort ?? ""}
                  >
                    {arr.map((sta) => (
                      <option
                        key={sta.id}
                        disabled={
                          lastStation?.groupId === sta.groupId ||
                          addedStations.some(
                            (added) => added.groupId === sta.groupId
                          )
                        }
                        value={sta.id}
                      >
                        {sta.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                className="mr-1 bg-black text-white rounded ml-1 px-4 py-1 disabled:bg-neutral-500"
                value={lastStation ? "追加" : "指定"}
                type="submit"
                disabled={
                  lastStation
                    ? (addedStations.length === 1 && !selectedStation?.id) ||
                      addedStations.some(
                        (sta) => sta.id === selectedStation?.id
                      )
                    : false
                }
              />
            </form>
          )}
          {
            <p className="text-sm">
              {reachableLocalStations.length === FETCH_STATIONS_MAX_COUNT &&
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
          <div className="flex mt-4">
            <button
              onClick={handleUpload}
              disabled={addedStations.length <= 1 || uploading}
              className="mr-1 bg-black text-white rounded px-2 py-1 disabled:bg-neutral-500"
            >
              アプリで使用する
            </button>

            {lastStation && (
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
          <p className="font-bold mt-4">オプション:</p>

          <select
            className="border border-gray-400 rounded bg-white w-48 disabled:bg-gray-200 py-1"
            onChange={handleTypeChange}
          >
            {Object.entries(AVAILABLE_TRAIN_TYPES).map(([key, value]) => (
              <option key={key} value={key}>
                {value.name}
              </option>
            ))}
          </select>

          {selectedType === AVAILABLE_TRAIN_TYPES.CUSTOM && (
            <div className="mt-4">
              <p className="font-bold mt-2">種別をカスタマイズ:</p>
              <form
                ref={customTypeFormRef}
                className="mt-2 flex justify-center gap-y-3 flex-col"
              >
                <div className="flex">
                  <label htmlFor="custom-type-base" className="mr-1 w-36">
                    ベース種別:
                  </label>
                  <select
                    id="custom-type-base"
                    name="custom-type-base"
                    className="border border-gray-400 rounded bg-white w-48 disabled:bg-gray-200 py-1"
                  >
                    {Object.entries(RESERVED_TRAIN_TYPES).map(
                      ([key, value]) => (
                        <option key={key} value={key}>
                          {value.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="flex">
                  <label className="mr-1 w-36">種別カラー:</label>
                  <input
                    type="color"
                    placeholder={AVAILABLE_TRAIN_TYPES.CUSTOM.color}
                    className="border-0 rounded w-48 block"
                    name="custom-type-color"
                  />
                </div>
                <div className="flex">
                  <label htmlFor="custom-type-name" className="mr-1 w-36">
                    種別名:
                  </label>
                  <input
                    className="border border-gray-400 rounded p-1 w-48 block"
                    placeholder={AVAILABLE_TRAIN_TYPES.CUSTOM.name}
                    id="custom-type-name"
                    name="custom-type-name"
                  />
                </div>
                <div className="flex">
                  <label htmlFor="custom-type-katakana" className="mr-1 w-36">
                    種別名(カタカナ):
                  </label>
                  <input
                    className="border border-gray-400 rounded p-1 w-48"
                    placeholder={AVAILABLE_TRAIN_TYPES.CUSTOM.nameKatakana}
                    id="custom-type-katakana"
                    name="custom-type-katakana"
                  />
                </div>
                <div className="flex">
                  <label htmlFor="custom-type-katakana" className="mr-1 w-36">
                    種別名(ローマ字):
                  </label>
                  <input
                    className="border border-gray-400 rounded p-1 w-48"
                    placeholder={AVAILABLE_TRAIN_TYPES.CUSTOM.nameRoman}
                    id="custom-type-roman"
                    name="custom-type-roman"
                  />
                </div>
                <div className="flex">
                  <label htmlFor="custom-type-chinese" className="mr-1 w-36">
                    種別名(中国語):
                  </label>
                  <input
                    className="border border-gray-400 rounded p-1 w-48"
                    placeholder={AVAILABLE_TRAIN_TYPES.CUSTOM.nameChinese}
                    id="custom-type-chinese"
                    name="custom-type-chinese"
                  />
                </div>
                <div className="flex">
                  <label htmlFor="custom-type-korean" className="mr-1 w-36">
                    種別名(韓国語):
                  </label>
                  <input
                    className="border border-gray-400 rounded p-1 w-48"
                    placeholder={AVAILABLE_TRAIN_TYPES.CUSTOM.nameKorean}
                    id="custom-type-korean"
                    name="custom-type-korean"
                  />
                </div>
              </form>
            </div>
          )}
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
                              <option value={val} key={val}>
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
