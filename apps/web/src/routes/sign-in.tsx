import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { authClient } from "../lib/authClient.js";

type SignInSearch = { redirect?: string };

export const Route = createFileRoute("/sign-in")({
  // Plain function, not zod: the only shape this route needs is "an
  // optional string to send the visitor back to," and pulling in a
  // validation library for one field would outweigh what it buys here.
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  component: SignIn,
});

function SignIn() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await authClient.signIn.email({ email, password });
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
            className="min-h-tap-min rounded-full border-2 border-border bg-surface px-5 text-ink shadow-search outline-none transition-colors duration-150 focus:border-accent"
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
            className="min-h-tap-min rounded-full border-2 border-border bg-surface px-5 text-ink shadow-search outline-none transition-colors duration-150 focus:border-accent"
          />
        </label>
        {/* The one place accent-red belongs today: the error state. */}
        {error && (
          <p className="text-error" data-testid="auth-error">
            {error}
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
