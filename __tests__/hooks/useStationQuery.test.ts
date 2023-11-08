import { useStationQuery } from "@/app/hooks";
import { renderHook } from "@testing-library/react";
import { STUB_DB } from "../../app/constants";

describe("useStationQuery", () => {
  it("should return a function", () => {
    const { result } = renderHook(() => useStationQuery());
    expect(result.current.searchStation).toBeInstanceOf(Function);
  });
  it("A few stations with matching names should return", () => {
    const { result } = renderHook(() => useStationQuery());
    const results = result.current.searchStation("伊勢崎");
    expect(results).toHaveLength(2);
    expect(results).toEqual(
      STUB_DB.stations.filter((station) => station.name.includes("伊勢崎"))
    );
  });
  it("All stations matching the line id should return", () => {
    const { result } = renderHook(() => useStationQuery());
    const results = result.current.getStationsByLineId(0);
    expect(results).toHaveLength(5);
    expect(results).toEqual(
      STUB_DB.stations.filter((station) => station.lineId === 0)
    );
  });
  it("All transferable stations should return", () => {
    const { result } = renderHook(() => useStationQuery());
    const results = result.current.getTransferableStations(12);
    expect(results).toHaveLength(2);
    expect(results).toEqual(
      STUB_DB.stations.filter((station) => station.groupId === 12)
    );
  });
  it("The line to which the station belongs should return from the specified station ID.", () => {
    const { result } = renderHook(() => useStationQuery());
    const results = result.current.findLineByStationId(0);
    expect(results).toEqual(STUB_DB.lines[0]);
  });
});
