import { createAuthClient } from "better-auth/react";

/** 瀏覽器端的 Better Auth client（同網域，不需設定 baseURL） */
export const authClient = createAuthClient();
