/**
 * 測試共用設定：把 DATABASE_URL 換成 TEST_DATABASE_URL，必要時建立資料庫並跑 migration，
 * 再清空所有資料表。必須在 import 任何會連資料庫的模組（@/db 等）之前呼叫。
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

const ROOT = path.resolve(__dirname, "..");

export async function setupTestDatabase(): Promise<void> {
  loadEnvConfig(ROOT);
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set（請確認 .env.local）");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL 不可與 DATABASE_URL 相同（測試會清空資料）");
  process.env.DATABASE_URL = url;

  // 資料庫不存在時建立
  const dbName = new URL(url).pathname.slice(1);
  const admin = new Client({ connectionString: url.replace(/\/[^/]+$/, "/postgres") });
  await admin.connect();
  const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  await admin.end();

  const client = new Client({ connectionString: url });
  await client.connect();
  await migrate(drizzle(client), { migrationsFolder: path.join(ROOT, "drizzle") });
  const { rows } = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await client.end();
}
