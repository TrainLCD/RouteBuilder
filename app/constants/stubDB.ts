export type StubStation = {
  id: number;
  groupId: number;
  name: string;
  lineId: number;
  prefectureId: number;
  nameRoman: string;
  companyId: number;
};
export type StubLine = { id: number; name: string };
export type StubCompany = { id: number; name: string; nameRoman: string };

type StubDB = {
  stations: readonly StubStation[];
  lines: readonly StubLine[];
  companies: readonly StubCompany[];
};

export const STUB_DB: StubDB = {
  stations: [
    {
      id: 0,
      groupId: 0,
      name: "伊勢崎",
      nameRoman: "Isesaki",
      lineId: 0,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 1,
      groupId: 1,
      name: "平和町",
      nameRoman: "Heiwacho",
      lineId: 0,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 2,
      groupId: 2,
      name: "文化会館",
      nameRoman: "Culture Hall",
      lineId: 0,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 3,
      groupId: 3,
      name: "上諏訪町",
      nameRoman: "Kamisuwacho",
      lineId: 0,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 4,
      groupId: 4,
      name: "西小保方",
      nameRoman: "Nishi-obokata",
      lineId: 0,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 5,
      groupId: 0,
      name: "伊勢崎",
      nameRoman: "Isesaki",
      lineId: 1,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 6,
      groupId: 6,
      name: "安堀",
      nameRoman: "Anbori",
      lineId: 1,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 7,
      groupId: 7,
      name: "オートレース場前",
      nameRoman: "Auto Racetrack",
      lineId: 1,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 8,
      groupId: 8,
      name: "上増田",
      nameRoman: "Kamimasuda",
      lineId: 1,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 9,
      groupId: 9,
      name: "駒形",
      nameRoman: "Komagata",
      lineId: 1,
      prefectureId: 10,
      companyId: 0,
    },
    {
      id: 10,
      groupId: 9,
      name: "駒形",
      nameRoman: "Komagata",
      lineId: 2,
      prefectureId: 10,
      companyId: 1,
    },
    {
      id: 11,
      groupId: 11,
      name: "天川大島",
      nameRoman: "Amagawaoshima",
      lineId: 2,
      prefectureId: 10,
      companyId: 1,
    },
    {
      id: 12,
      groupId: 12,
      name: "前橋",
      nameRoman: "Maebashi",
      lineId: 2,
      prefectureId: 10,
      companyId: 1,
    },
    {
      id: 13,
      groupId: 13,
      name: "清陵高校前",
      nameRoman: "Seiryo High School",
      lineId: 2,
      prefectureId: 10,
      companyId: 1,
    },
    {
      id: 14,
      groupId: 14,
      name: "新前橋",
      nameRoman: "Shim-maebashi",
      lineId: 2,
      prefectureId: 10,
      companyId: 1,
    },
    {
      id: 15,
      groupId: 12,
      name: "前橋",
      nameRoman: "Maebashi",
      lineId: 3,
      prefectureId: 10,
      companyId: 1,
    },
    {
      id: 16,
      groupId: 16,
      name: "前橋中央",
      nameRoman: "Maebashi-chuo",
      lineId: 3,
      prefectureId: 10,
      companyId: 1,
    },
    {
      id: 17,
      groupId: 17,
      name: "文化ホール",
      nameRoman: "Culture Hall",
      lineId: 3,
      prefectureId: 10,
      companyId: 1,
    },
    {
      id: 18,
      groupId: 18,
      name: "前橋リリカ前",
      nameRoman: "Maebashi Lirica",
      lineId: 3,
      prefectureId: 10,
      companyId: 1,
    },
    {
      id: 19,
      groupId: 19,
      name: "青柳",
      nameRoman: "Aoyagi",
      lineId: 3,
      prefectureId: 10,
      companyId: 1,
    },
  ],
  lines: [
    {
      id: 0,
      name: "伊勢崎市営地下鉄西小保方線",
    },
    {
      id: 1,
      name: "伊勢崎市営地下鉄伊前線",
    },
    {
      id: 2,
      name: "前橋市営地下鉄新前橋線",
    },
    {
      id: 3,
      name: "前橋市営地下線青柳線",
    },
  ],
  companies: [
    {
      id: 0,
      name: "伊勢崎市交通局",
      nameRoman: "Isesaki City Transportation Bureau",
    },
    {
      id: 1,
      name: "前橋市都市鉄道公社",
      nameRoman: "Maebashi City Urban Railway Corporation",
    },
  ],
} as const;
