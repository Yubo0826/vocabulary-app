const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 是否為 UUID 字串；查詢前先檢查，避免格式錯誤的 id 讓 Postgres 丟出型別錯誤 */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);
