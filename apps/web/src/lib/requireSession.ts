import { redirect } from "@tanstack/react-router";
import { authClient } from "./authClient.js";

/**
 * The mechanism a future `/programs` (or `/history`) route reuses: call this
 * from the route's `beforeLoad`, per routes/settings.tsx. It checks the
 * session before anything renders and redirects to sign-in — preserving
 * where the visitor was headed via `redirect` — rather than flashing a page
 * that immediately 401s. The library route never calls this; it stays
 * public by design (docs/design.md).
 */
export async function requireSession(href: string) {
  const { data } = await authClient.getSession();
  if (!data) {
    throw redirect({ to: "/sign-in", search: { redirect: href } });
  }
  return data;
}
