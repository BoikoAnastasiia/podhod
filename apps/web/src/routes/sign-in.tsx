import { signInSchema } from "@podhod/schema";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { GoogleAuthButton } from "../components/GoogleAuthButton.js";
import { useI18n } from "../i18n/useI18n.js";
import { authClient } from "../lib/authClient.js";
import { authValidationMessage } from "../lib/authFormErrors.js";
import { oauthErrorMessage } from "../lib/oauthErrors.js";

type SignInSearch = { redirect?: string; error?: string };

export const Route = createFileRoute("/sign-in")({
  // Plain function, not zod: both fields this route needs are "an optional
  // string" (where to send the visitor back to, and an OAuth failure code
  // Better Auth appends on redirect — see lib/oauthErrors.ts), and pulling
  // in a validation library for that would outweigh what it buys here. The
  // *form* below this route does use zod (signInSchema) — a different
  // concern (request-body shape vs. search-param parsing), not a
  // contradiction of this choice.
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
  }),
  component: SignIn,
});

function SignIn() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { redirect, error: oauthError } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A failed OAuth redirect (e.g. "account not linked") arrives as a search
  // param, not local state — but once the visitor retries the form, a fresh
  // local error should take over rather than the stale query-string one
  // sticking around forever.
  const displayError = error ?? oauthErrorMessage(oauthError, t);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation is a convenience — immediate feedback before a
    // network round trip — never the security boundary. apps/api/src/lib/
    // authValidation.ts revalidates the identical shared schema server-side,
    // which is the gate that actually matters.
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(authValidationMessage(parsed.error, t));
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await authClient.signIn.email(parsed.data);
    setSubmitting(false);
    if (signInError) {
      setError(t("auth.error.invalidCredentials"));
      return;
    }
    navigate({ to: redirect ?? "/" });
  };

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("auth.signInTitle")}</h1>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-card"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">{t("auth.email")}</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-tap-min rounded-full border-2 border-border bg-surface px-5 text-ink shadow-search transition-colors duration-150"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">{t("auth.password")}</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-tap-min rounded-full border-2 border-border bg-surface px-5 text-ink shadow-search transition-colors duration-150"
          />
        </label>
        {/* The one place accent-red belongs today: the error state. */}
        {displayError && (
          <p className="text-error" data-testid="auth-error">
            {displayError}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          data-testid="sign-in-submit"
          className="inline-flex min-h-tap-min items-center justify-center rounded-full bg-accent px-8 text-base font-semibold text-ink-on-accent shadow-cta transition-shadow duration-200 ease-out hover:bg-accent-hover hover:shadow-cta-hover disabled:opacity-60"
        >
          {submitting ? t("auth.submitting") : t("auth.submitSignIn")}
        </button>
        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          {t("auth.or")}
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>
        <GoogleAuthButton
          redirectTo={redirect}
          errorRedirectTo={redirect ? `/sign-in?redirect=${encodeURIComponent(redirect)}` : "/sign-in"}
        />
      </form>
      <p className="text-sm text-muted">
        {t("auth.switchToSignUpPrefix")}{" "}
        <Link to="/sign-up" className="link-inline">
          {t("auth.switchToSignUpLink")}
        </Link>
      </p>
    </div>
  );
}
