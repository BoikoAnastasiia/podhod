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
      <section className="flex flex-col gap-6">
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Подход</h1>
        <p className="max-w-content text-lg text-muted">{t("landing.tagline")}</p>
        <Link
          to="/library"
          data-testid="landing-cta"
          className="inline-flex min-h-tap-min w-max items-center rounded-full bg-ink px-6 font-semibold text-surface shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover motion-safe:hover:-translate-y-1"
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
          className="inline-flex min-h-tap-min w-max items-center underline underline-offset-2"
        >
          {t("footer.github")}
        </a>
      </footer>
    </div>
  );
}
