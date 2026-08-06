import { useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { authClient } from "../lib/authClient.js";

/**
 * Shared by both sign-in and sign-up: Google draws no distinction between
 * the two (a first-time visitor becomes a new account, a returning one is
 * signed in), so this is one control, not two.
 *
 * Styled to stay out of the way of the primary lime CTA above it rather
 * than compete with it — border + surface fill in the same shape language
 * as the email/password inputs on this screen, not Google's own branded
 * button (the brief explicitly doesn't require replicating that).
 *
 * This project intentionally does not e2e the actual OAuth handshake (it
 * needs a live Google consent screen); what *is* covered is that this
 * button exists, is reachable by keyboard, and — on click — starts a
 * redirect toward Google's authorisation endpoint. See e2e/auth.spec.ts.
 */
export function GoogleAuthButton({ redirectTo }: { redirectTo?: string }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setPending(true);
    const { error: signInError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTo ?? "/",
    });
    // A successful call navigates the browser away to Google before this
    // line would run; reaching it at all means the request failed before
    // any redirect happened (network error, misconfigured client, etc).
    setPending(false);
    if (signInError) {
      setError(t("auth.error.generic"));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="google-signin"
        disabled={pending}
        onClick={onClick}
        className="inline-flex min-h-tap-min items-center justify-center gap-2 rounded-full border-2 border-border bg-surface px-8 text-base font-semibold text-ink transition-colors duration-150 hover:bg-chip-hover disabled:opacity-60"
      >
        {t("auth.continueWithGoogle")}
      </button>
      {error && (
        <p className="text-error" data-testid="google-error">
          {error}
        </p>
      )}
    </div>
  );
}
