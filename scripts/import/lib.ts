/**
 * 匯入腳本共用工具：讀環境變數、建立資料庫連線、批次寫入、逐行讀檔、繁簡轉換。
 */
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { loadEnvConfig } from "@next/env";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTable } from "drizzle-orm/pg-core";
import * as OpenCC from "opencc-js/cn2t";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";

export const ROOT = path.resolve(__dirname, "../..");
export const RAW_DIR = path.join(ROOT, "data/raw");

export type ImportDb = NodePgDatabase<typeof schema>;
export type ImportTx = Parameters<Parameters<ImportDb["transaction"]>[0]>[0];

/** 建立獨立的連線池（腳本結束時要自己關閉），回傳 db 與 close() */
export function connect(): { db: ImportDb; close: () => Promise<void> } {
  loadEnvConfig(ROOT);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set（請確認 .env.local）");
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

/** 確認原始檔存在，不存在時提示下載方式 */
export function requireRawFile(relPath: string, hint: string): string {
  const full = path.join(RAW_DIR, relPath);
  if (!existsSync(full)) throw new Error(`找不到 ${full}\n${hint}`);
  return full;
}

/** 分批 INSERT，避免超過 Postgres 單一查詢 65535 個參數的限制 */
export async function insertInBatches<T extends PgTable>(
  tx: ImportTx,
  table: T,
  rows: T["$inferInsert"][],
  batchSize = 2000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    await tx.insert(table).values(rows.slice(i, i + batchSize));
  }
}

/** 逐行讀取文字檔（UTF-8），適合數百 MB 的 TSV */
export function readLines(file: string): AsyncIterable<string> {
  return createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
}

/** 簡體 → 台灣繁體（含台灣慣用詞，等同 OpenCC s2twp） */
export const toTaiwanese = OpenCC.Converter({ from: "cn", to: "twp" });

/** 解析 `--key=value` 形式的參數 */
export function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

export function run(main: () => Promise<void>): void {
  const started = Date.now();
  main()
    .then(() => console.log(`完成，耗時 ${((Date.now() - started) / 1000).toFixed(1)} 秒`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
