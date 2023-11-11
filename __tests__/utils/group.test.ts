import { Station } from "@/app/generated/stationapi_pb";
import { groupStations } from "@/app/utils";

describe("utils/group.ts", () => {
  it("groupStationsByLine", () => {
    const stations = [
      {
        id: 1,
        line: { nameShort: "first", id: 1 },
      },
      { id: 2, line: { nameShort: "first", id: 1 } },
      {
        id: 3,
        line: { nameShort: "first", id: 1 },
      },
      {
        id: 4,
        line: { nameShort: "second", id: 2 },
      },
      {
        id: 5,
        line: { nameShort: "second", id: 2 },
      },
      {
        id: 6,
        line: { nameShort: "second", id: 3 },
      },
    ];
    const expected = [
      [stations[0], stations[1], stations[2]],
      [stations[3], stations[4], stations[5]],
    ];

    const result = groupStations(stations as Station.AsObject[]);

    expect(result).toEqual(expected);
  });
});
