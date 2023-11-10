export const RESERVED_TRAIN_TYPE_IDS = {
  LOCAL: 300,
  LOCAL2: 301,
  RAPID: 302,
  // SECTION_RAPID: 303,
  EXPRESS: 304,
  // UNDEFINED: 305
  LTD_EXP: 306,
} as const;
export type ReservedTrainTypeId =
  (typeof RESERVED_TRAIN_TYPE_IDS)[keyof typeof RESERVED_TRAIN_TYPE_IDS];

export const RESERVED_TRAIN_TYPE_LABELS = {
  LOCAL: "普通",
  LOCAL2: "各駅停車",
  RAPID: "快速",
  // SECTION_RAPID: '区間急行',
  EXPRESS: "急行",
  // UNDEFINED: 305
  LTD_EXP: "特急",
} as const;
export type ReservedTrainTypeLabel =
  (typeof RESERVED_TRAIN_TYPE_LABELS)[keyof typeof RESERVED_TRAIN_TYPE_LABELS];
