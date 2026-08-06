import { createAuthClient } from "better-auth/react";

/**
 * No baseURL passed: the app is same-origin by design (docs/design.md §2),
 * so the client's default — the page's own origin — is already correct in
 * production. In dev, vite.config.ts proxies /api to the Worker on 8787, so
 * the client never has to branch on environment either.
 */
export const authClient = createAuthClient();
