import type { DictKey, I18n } from "../i18n/useI18n.js";

/**
 * Better Auth's OAuth callback (confirmed against the installed 1.6.26
 * source, oauth2/errors.mjs + oauth2/link-account.mjs + api/routes/
 * callback.mjs) reports a failure by redirecting back to `errorCallbackURL`
 * with `?error=<code>`, never by returning a normal error response — the
 * codes below are exactly the strings that helper emits, spaces already
 * turned into underscores where the source does that. sign-in.tsx,
 * sign-up.tsx and settings.tsx each set `errorCallbackURL` to their own
 * path and read `error` back off `Route.useSearch()`, so all three can
 * share this one mapping instead of three copies drifting apart.
 */
const KNOWN_CODES: Record<string, DictKey> = {
  // Someone tried "Continue with Google" on the sign-in/sign-up screen with
  // an email that already has a password account — Better Auth's implicit
  // linking refuses (see auth.ts's requireLocalEmailVerified comment) since
  // this app never verifies an email+password account. Tell the visitor the
  // actual way out instead of leaving them at a dead end.
  account_not_linked: "auth.error.accountNotLinked",
  // The manual link-from-Settings flow's own failure modes.
  unable_to_link_account: "auth.error.linkUnableToLink",
  "email_doesn't_match": "auth.error.linkEmailMismatch",
  account_already_linked_to_different_user: "auth.error.linkAlreadyLinkedElsewhere",
};

/** `null` when there is no error to show — the common case. */
export function oauthErrorMessage(code: string | undefined, t: I18n["t"]): string | null {
  if (!code) return null;
  const key = KNOWN_CODES[code];
  return t(key ?? "auth.error.generic");
}
