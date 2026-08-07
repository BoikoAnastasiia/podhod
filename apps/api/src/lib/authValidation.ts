import {
  errorResponseSchema,
  formatValidationError,
  signInSchema,
  signUpSchema,
} from "@podhod/schema";
import type { ErrorResponse } from "@podhod/schema";

/**
 * Client-side validation (the same signInSchema/signUpSchema, consumed by
 * apps/web's sign-in and sign-up routes) is a convenience only — never a
 * security boundary. This is the real gate: every POST Better Auth's own
 * handler would otherwise receive for these two paths is revalidated
 * against the identical shared schema first, so a caller that skips the
 * browser form entirely (curl, a modified client, a future mobile app)
 * gets rejected exactly like a browser user would have been, before ever
 * reaching Better Auth's own handler.
 *
 * This is not a substitute for Better Auth's own internal checks (it
 * enforces its own minPasswordLength/email shape too — see auth.ts) — it's
 * what lets this app answer with its own shared error envelope
 * (errorResponseSchema), matching every other route in this app, instead of
 * Better Auth's differently-shaped error body.
 */
// Typed off the two schemas themselves rather than a named `ZodType` import
// — same reasoning as formatValidationError in packages/schema/src/
// exercise.ts: this file never needs `zod` as a direct dependency just to
// name a type it only ever touches through these two schemas.
const VALIDATORS: Record<string, typeof signInSchema | typeof signUpSchema> = {
  "/api/auth/sign-in/email": signInSchema,
  "/api/auth/sign-up/email": signUpSchema,
};

/**
 * Returns an error envelope to send back (with a 400) when the request
 * fails validation, or `null` when it's either not a path this gate covers
 * or it passed. Reads the body via `.clone()` — the caller still needs the
 * original, unconsumed request to hand to Better Auth's own handler
 * afterwards.
 */
export async function validateAuthBody(req: Request): Promise<ErrorResponse | null> {
  if (req.method !== "POST") return null;
  const schema = VALIDATORS[new URL(req.url).pathname];
  if (!schema) return null;

  let body: unknown;
  try {
    body = await req.clone().json();
  } catch {
    return errorResponseSchema.parse({
      error: { code: "bad_request", message: "invalid request body" },
    });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponseSchema.parse({
      error: { code: "bad_request", message: formatValidationError(parsed.error) },
    });
  }
  return null;
}
