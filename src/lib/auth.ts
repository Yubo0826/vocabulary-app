import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

/** 是否已設定 Google OAuth（未設定時登入頁不顯示 Google 按鈕） */
export const googleEnabled = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // 尚未串接寄信服務：暫不要求 Email 驗證，也還沒有忘記密碼功能
    requireEmailVerification: false,
  },
  socialProviders: googleEnabled
    ? { google: { clientId: googleClientId!, clientSecret: googleClientSecret! } }
    : {},
  user: {
    // 刪除帳號：有密碼者需輸入密碼；只用 Google 登入者需在登入 1 天內（freshAge）操作
    deleteUser: { enabled: true },
  },
  // 讓 Server Action 中呼叫 auth.api 時能寫入 cookie；必須放在 plugins 最後
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
