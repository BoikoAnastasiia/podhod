import type { formatValidationError } from "@podhod/schema";
import type { DictKey, I18n } from "../i18n/useI18n.js";

/**
 * Maps the first issue a failed `signInSchema`/`signUpSchema` parse
 * produces to the matching i18n key. Only the two fields these schemas
 * actually carry (email, password) get a specific message; anything else
 * — there is nothing else today — falls back to the same generic message a
 * failed network call shows, so a schema change here can't silently render
 * a raw Zod issue.
 *
 * This is the client-side half only: a convenience so a visitor sees a
 * localized message before a network round trip, never the security
 * boundary. apps/api/src/lib/authValidation.ts revalidates the identical
 * shared schema server-side, which is the gate that actually matters.
 *
 * Typed off `formatValidationError`'s own parameter rather than a named
 * `ZodError` import — same reasoning as that function's own comment
 * (packages/schema/src/exercise.ts): this file never needs `zod` as a
 * direct dependency just to name a type it only ever touches structurally.
 */
export function authValidationMessage(
  error: Parameters<typeof formatValidationError>[0],
  t: I18n["t"],
): string {
  const issue = error.issues[0];
  if (!issue) return t("auth.error.generic");

  const field = issue.path[0];
  if (field === "email") return t("auth.error.invalidEmail");
  if (field === "password") {
    const key: DictKey =
      issue.code === "too_big" ? "auth.error.passwordTooLong" : "auth.error.passwordTooShort";
    return t(key);
  }
  return t("auth.error.generic");
}
