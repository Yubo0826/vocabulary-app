import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// 與 Next.js 相同的規則讀取 .env.local 等檔案
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
