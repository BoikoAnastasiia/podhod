import { signUpSchema } from "@podhod/schema";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { GoogleAuthButton } from "../components/GoogleAuthButton.js";
import { useI18n } from "../i18n/useI18n.js";
import { authClient } from "../lib/authClient.js";
import { authValidationMessage } from "../lib/authFormErrors.js";
import { oauthErrorMessage } from "../lib/oauthErrors.js";

type SignUpSearch = { error?: string };

export const Route = createFileRoute("/sign-up")({
  // See sign-in.tsx's matching comment: search-param parsing and the form's
  // own body validation (signUpSchema, below) are different concerns.
  validateSearch: (search: Record<string, unknown>): SignUpSearch => ({
    error: typeof search["error"] === "string" ? search["error"] : undefined,
  }),
  component: SignUp,
});

function SignUp() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { error: oauthError } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const displayError = error ?? oauthErrorMessage(oauthError, t);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Better Auth's user record requires a display name; this app collects
    // only email and password (the owner's call — see docs/plans), so the
    // local part of the address stands in until Settings grows a real name
    // field. It's editable later; it just can't be blank today.
    const name = email.split("@")[0] || email;

    // Client-side validation is a convenience — immediate feedback before a
    // network round trip — never the security boundary. apps/api/src/lib/
    // authValidation.ts revalidates the identical shared schema server-side,
    // which is the gate that actually matters.
    const parsed = signUpSchema.safeParse({ email, password, name });
    if (!parsed.success) {
      setError(authValidationMessage(parsed.error, t));
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await authClient.signUp.email({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name ?? name,
    });
    setSubmitting(false);
    if (signUpError) {
      setError(
        // Better Auth returns USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL here
        // (confirmed against a real sign-up, not assumed) — matching on the
        // substring rather than the exact code so a future minor version
        // that tweaks the suffix doesn't silently fall back to the generic
        // message.
        signUpError.code?.includes("ALREADY_EXISTS")
          ? t("auth.error.emailInUse")
          : t("auth.error.generic"),
      );
      return;
    }
    // requireEmailVerification is unset (see apps/api/src/lib/auth.ts), so
    // autoSignIn's default of true already left us with a session here —
    // sign-up completes immediately, no verification step to wait on.
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("auth.signUpTitle")}</h1>
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
            minLength={8}
            autoComplete="new-password"
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
          data-testid="sign-up-submit"
          className="inline-flex min-h-tap-min items-center justify-center rounded-full bg-accent px-8 text-base font-semibold text-ink-on-accent shadow-cta transition-shadow duration-200 ease-out hover:bg-accent-hover hover:shadow-cta-hover disabled:opacity-60"
        >
          {submitting ? t("auth.submitting") : t("auth.submitSignUp")}
        </button>
        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          {t("auth.or")}
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>
        <GoogleAuthButton errorRedirectTo="/sign-up" />
      </form>
      <p className="text-sm text-muted">
        {t("auth.switchToSignInPrefix")}{" "}
        <Link to="/sign-in" className="link-inline">
          {t("auth.switchToSignInLink")}
        </Link>
      </p>
    </div>
  );
}
