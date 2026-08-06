import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/d1";

/**
 * Exists solely so `@better-auth/cli generate` has something to introspect —
 * it is never imported at runtime. The real auth instance lives in
 * src/lib/auth.ts and is built per-request from the Worker's actual D1
 * binding, which does not exist outside a request context and therefore
 * cannot be constructed here. Regenerate db/auth-schema.ts whenever the
 * emailAndPassword/session config below changes to match src/lib/auth.ts,
 * from apps/api:
 *
 *   pnpm dlx @better-auth/cli@1.4.22 generate \
 *     --config ./auth-cli.config.ts --output ./src/db/auth-schema.ts -y
 *
 * (that CLI version, not better-auth's own 1.6.26 — @better-auth/cli hasn't
 * published a matching major yet, but its generate command only inspects
 * this config's field definitions, not the installed better-auth version,
 * so the mismatch doesn't affect the output. Confirmed against the schema
 * actually committed here.)
 */
export const auth = betterAuth({
  database: drizzleAdapter(drizzle({} as unknown as D1Database), { provider: "sqlite" }),
  secret: "generate-only",
  emailAndPassword: { enabled: true },
});
