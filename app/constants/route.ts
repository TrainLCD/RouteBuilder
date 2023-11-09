import { Timestamp } from "@firebase/firestore";
import { StopCondition } from "../generated/stationapi_pb";

export type RouteStation = {
  id: number;
  stopCondition: StopCondition;
};

export const ROUTE_VISIBILITY = {
  PUBLIC: "public",
  RESTRICTED: "restricted",
  PRIVATE: "private",
} as const;
export type RouteVisibility =
  (typeof ROUTE_VISIBILITY)[keyof typeof ROUTE_VISIBILITY];

export type CustomRoute = {
  userId: string;
  name: string;
  stations: RouteStation[];
  createdAt: Timestamp;
  visibility: RouteVisibility;
};
