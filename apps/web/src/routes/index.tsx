import { ATTRIBUTION } from "@podhod/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExerciseCard } from "../components/ExerciseCard.js";
import { exerciseNounForms } from "../i18n/dict.js";
import { useI18n } from "../i18n/useI18n.js";
import { fetchExerciseCount, fetchExercises } from "../lib/api.js";

const GITHUB_URL = "https://github.com/BoikoAnastasiia/podhod";
/** Enough to prove the library is real without turning the hero into a second library page. */
const PROOF_SAMPLE_SIZE = 10;

/**
 * `/` today: a landing page, because there is no auth and no programs yet to
 * make a "Today" training screen meaningful. Phases 1b/2 replace this
 * component with that screen once both exist — the swap is a route-component
 * change only. Nothing here (root layout, nav, i18n) assumes the landing
 * content is permanent.
 */
export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { lang, term, t, plural } = useI18n();

  const count = useQuery({
    queryKey: ["exerciseCount"],
    queryFn: fetchExerciseCount,
  });

  // A distinct query key from the library route's ["exercises", lang, q,
  // bodyPart] — this is a plain (non-infinite) query for a small fixed
  // sample, and sharing a key with an infinite query would have the two
  // caches fight over the same cache entry's shape.
  const sample = useQuery({
    queryKey: ["exercises", "landing", lang],
    queryFn: () => fetchExercises({ lang, limit: PROOF_SAMPLE_SIZE }),
  });

  return (
    <div className="flex flex-col gap-12 py-8">
      {/*
       * The wash: a soft gradient from transparent into --color-hero-wash,
       * not a hard-edged band — dfff75 is already a pale tint, so even at
       * full strength at the section's own bottom edge it reads as a wash,
       * not a stripe. Kept to the hero section only; the stat/card sections
       * below sit on the plain canvas.
       */}
      <section className="flex flex-col gap-10 bg-linear-to-b from-transparent to-hero-wash py-12 md:gap-14 md:py-20 lg:py-28">
        <div className="flex flex-col gap-5 md:gap-6">
          {/*
           * Revalia (see theme.css) — display face, for the wordmark only.
           * font-normal: the self-hosted file ships just the 400 weight, so
           * asking for bold would make the browser synthesize a fake one.
           * Sized large enough (up to text-9xl) that the distinctive H — the
           * owner's planned dumbbell-logo letterform — is clearly visible.
           */}
          <h1 className="font-wordmark text-5xl font-normal tracking-wide md:text-7xl lg:text-9xl">
            {t("brand.wordmark")}
          </h1>
          <p className="max-w-content text-lg text-muted md:text-xl">{t("landing.tagline")}</p>
        </div>
        <Link
          to="/library"
          data-testid="landing-cta"
          className="inline-flex min-h-tap-min w-max items-center rounded-full bg-accent px-8 py-4 text-base font-semibold text-ink-on-accent shadow-card transition-shadow duration-200 ease-out hover:bg-accent-hover hover:shadow-card-hover motion-safe:hover:-translate-y-1 md:text-lg"
        >
          {t("home.browseLibrary")}
        </Link>
      </section>

      <section className="flex flex-col gap-6 rounded-card bg-surface p-6 shadow-card">
        <div data-testid="landing-exercise-count">
          {count.isPending && <p className="text-muted">{t("landing.stat.loading")}</p>}
          {count.isError && <p className="text-muted">{t("landing.stat.error")}</p>}
          {count.data && (
            <p className="text-3xl font-bold tabular-nums">
              {count.data.total.toLocaleString(lang)}{" "}
              <span className="text-lg font-normal text-muted">
                {plural(count.data.total, exerciseNounForms[lang])}{" "}
                {t("landing.stat.rest")}
              </span>
            </p>
          )}
        </div>
        {sample.data && sample.data.items.length > 0 && (
          <ul className="grid grid-exercises gap-3">
            {sample.data.items.map((exercise) => (
              <li key={exercise.id}>
                <ExerciseCard exercise={exercise} label={term} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-card">
          <h2 className="text-xl font-bold tracking-tight">{t("landing.today.heading")}</h2>
          <p className="text-muted">{t("landing.today.body")}</p>
        </div>
        <div className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-card">
          <h2 className="text-xl font-bold tracking-tight">{t("landing.coming.heading")}</h2>
          <p className="text-muted">{t("landing.coming.body")}</p>
        </div>
      </section>

      <footer className="flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p data-testid="attribution">{ATTRIBUTION}</p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="link-inline inline-flex min-h-tap-min w-max items-center"
        >
          {t("footer.github")}
        </a>
      </footer>
    </div>
  );
}
