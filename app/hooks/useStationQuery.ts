import { FETCH_STATIONS_MAX_COUNT } from "../constants";
import { StationAPIClient } from "../generated/StationapiServiceClientPb";
import {
  GetStationByGroupIdRequest,
  GetStationByLineIdRequest,
  GetStationsByNameRequest,
} from "../generated/stationapi_pb";

export const useStationQuery = () => {
  if (!process.env.NEXT_PUBLIC_API_URL) {
    throw new Error("process.env.NEXT_PUBLIC_API_URL is not defined");
  }

  const client = new StationAPIClient(process.env.NEXT_PUBLIC_API_URL);

  const searchStation = async (query: string) => {
    try {
      const req = new GetStationsByNameRequest();
      req.setStationName(query);
      req.setLimit(FETCH_STATIONS_MAX_COUNT);
      const res = await client.getStationsByName(req, {});
      return res.toObject().stationsList;
    } catch (err) {
      return Promise.reject(err);
    }
  };
  const getStationsByLineId = async (lineId: number) => {
    try {
      const req = new GetStationByLineIdRequest();
      req.setLineId(lineId);
      const res = await client.getStationsByLineId(req, {});
      return res.toObject().stationsList;
    } catch (err) {
      return Promise.reject(err);
    }
  };
  const getTransferableStations = async (groupId: number) => {
    try {
      const req = new GetStationByGroupIdRequest();
      req.setGroupId(groupId);
      const res = await client.getStationsByGroupId(req, {});
      return res.toObject().stationsList;
    } catch (err) {
      return Promise.reject(err);
    }
  };

  return {
    searchStation,
    getStationsByLineId,
    getTransferableStations,
  };
};
