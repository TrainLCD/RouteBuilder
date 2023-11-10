import { FETCH_STATIONS_MAX_COUNT } from "../constants";
import { StationAPIClient } from "../generated/StationapiServiceClientPb";
import {
  GetStationByGroupIdRequest,
  GetStationByLineIdRequest,
  GetStationsByLineGroupIdRequest,
  GetStationsByNameRequest,
  GetTrainTypesByStationIdRequest,
  TrainTypeKind,
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
  const getTrainTypes = async (stationId: number) => {
    try {
      const req = new GetTrainTypesByStationIdRequest();
      req.setStationId(stationId);
      const res = await client.getTrainTypesByStationId(req, {});
      return res.toObject().trainTypesList;
    } catch (err) {
      return Promise.reject(err);
    }
  };
  const getStationsByLineId = async (lineId: number, stationId?: number) => {
    try {
      const req = new GetStationByLineIdRequest();
      req.setLineId(lineId);
      if (stationId) {
        req.setStationId(stationId);
      }

      const res = await client.getStationsByLineId(req, {});
      const stationsMaybeBranchLine = res
        .toObject()
        .stationsList.filter((sta) => sta.line?.id === lineId);

      if (!stationId) {
        return [stationsMaybeBranchLine, []];
      }

      const trainTypes = await getTrainTypes(stationId);

      const branchLineType = trainTypes.find(
        (tt) => tt.kind === TrainTypeKind.BRANCH
      );

      if (!branchLineType) {
        return [stationsMaybeBranchLine, []];
      }

      const localGroupType = trainTypes.find(
        (tt) => tt.kind === TrainTypeKind.DEFAULT
      );
      if (!localGroupType) {
        return [stationsMaybeBranchLine, []];
      }

      const branchLineStationsReq = new GetStationsByLineGroupIdRequest();
      branchLineStationsReq.setLineGroupId(branchLineType.groupId);
      const branchLineStationsRes = await client.getStationsByLineGroupId(
        branchLineStationsReq,
        {}
      );

      const localStations = stationsMaybeBranchLine;
      const branchLineStations = branchLineStationsRes
        .toObject()
        .stationsList.filter(
          (sta) => !localStations.some((s) => s.id === sta.id)
        );

      return [localStations, branchLineStations];
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
