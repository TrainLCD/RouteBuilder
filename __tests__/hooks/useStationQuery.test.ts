import { STUB_DB } from "@/app/constants";
import { StationAPIClient } from "@/app/generated/StationapiServiceClientPb";
import { useStationQuery } from "@/app/hooks";
import { renderHook } from "@testing-library/react";

jest.mock("@/app/generated/StationapiServiceClientPb");
jest.mock("firebase/auth");
jest.mock("firebase/firestore");

const ORIGINAL_PROCESS_ENV = process.env;

describe("useStationQuery", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_PROCESS_ENV,
    };
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";

    (StationAPIClient as jest.Mock).mockImplementation(() => {
      return {
        getTrainTypes: () => {
          return {
            toObject: () => {
              return {
                trainTypesList: [],
              };
            },
          };
        },
        getStationsByName: () => {
          return {
            toObject: () => {
              return {
                stationsList: STUB_DB.stations,
              };
            },
          };
        },
        getStationsByLineId: () => {
          return {
            toObject: () => {
              return {
                stationsList: STUB_DB.stations,
              };
            },
          };
        },
        getStationsByGroupId: () => {
          return {
            toObject: () => {
              return {
                stationsList: STUB_DB.stations,
              };
            },
          };
        },
      };
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_PROCESS_ENV;
    jest.clearAllMocks();
  });

  it("should return a function", () => {
    const { result } = renderHook(() => useStationQuery());
    expect(result.current.searchStation).toBeInstanceOf(Function);
  });
  it("A few stations with matching names should return", async () => {
    const { result } = renderHook(() => useStationQuery());
    const results = await result.current.searchStation("伊勢崎");
    expect(results).toHaveLength(STUB_DB.stations.length);
    expect(results).toEqual(STUB_DB.stations);
  });
  it("All stations matching the line id should return", async () => {
    const { result } = renderHook(() => useStationQuery());
    const results = await result.current.getStationsByLineId(0);
    // TODO: ちゃんと支線含めて返ってくるか確認する
    expect(results).toHaveLength(2);
    expect(results).toEqual([[], []]);
  });
  it("All transferable stations should return", async () => {
    const { result } = renderHook(() => useStationQuery());
    const results = await result.current.getTransferableStations(12);
    expect(results).toHaveLength(STUB_DB.stations.length);
    expect(results).toEqual(STUB_DB.stations);
  });
  it("The line to which the station belongs should return from the specified station ID.", async () => {
    const { result } = renderHook(() => useStationQuery());
    const results = await result.current.getStationsByLineId(0);
    // TODO: ここもちゃんと支線含めて返ってくるか確認する
    expect(results).toEqual([[], []]);
  });
});
