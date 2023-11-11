import { Station } from "../generated/stationapi_pb";

export const groupStations = (stations: Station.AsObject[]) =>
  stations.reduce<Station.AsObject[][]>((acc, cur) => {
    if (!acc.length) {
      return [[cur]];
    }

    const lastArray = acc[acc.length - 1];
    if (
      lastArray[lastArray.length - 1].line?.id === cur.line?.id ||
      lastArray[lastArray.length - 1].line?.nameShort === cur.line?.nameShort
    ) {
      return [...acc.slice(0, -1), [...lastArray, cur]];
    }

    return [...acc, [cur]];
  }, []);
