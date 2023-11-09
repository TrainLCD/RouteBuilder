export const PUBLISH_ERROR_CODE = {
  ERR_UNKNOWN: "ERR_UNKNOWN",
  ERR_NOT_AUTHENTICATED: "ERR_NOT_AUTHENTICATED",
  ERR_INVALID_NAME: "ERR_INVALID_NAME", // NOTE: 現在未使用。エログロ等の名前が入った時に使われる想定
  ERR_CONFLICT_NAME: "ERR_CONFLICT_NAME",
  ERR_CONFLICT_ROUTE: "ERR_CONFLICT_ROUTE", // NOTE: 現在未使用。同じ経路が既に存在する時に使われる想定
} as const;

export type PublishErrorCode =
  (typeof PUBLISH_ERROR_CODE)[keyof typeof PUBLISH_ERROR_CODE];
