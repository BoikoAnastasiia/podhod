import { ATTRIBUTION } from "@podhod/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExerciseCard } from "../components/ExerciseCard.js";
import { BLOG_POSTS } from "../data/blogPosts.js";
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
    <div className="flex flex-col gap-12 pb-8">
      {/*
       * -mx-4 cancels <main>'s own px-4 so the wash bleeds to the layout's
       * edge; px-4 goes back on the section inside to keep the content
       * aligned with the rest of the page. No top padding above this block:
       * the wash must start flush under the black header band — the earlier
       * py-8 put a strip of bare canvas between bar and gradient, which
       * read as three unrelated layers (line, background, wash) instead of
       * one surface. The CTA is gone with the owner's blessing: the nav's
       * Library link already does that job, and the hero reads calmer as
       * wordmark + one sentence.
       */}
      <div className="-mx-4 hero-wash">
        <section className="flex flex-col gap-5 px-4 py-10 md:gap-6 md:py-14 lg:py-16">
          {/*
           * Revalia (see theme.css) — display face, for the wordmark only.
           * font-normal: the self-hosted file ships just the 400 weight, so
           * asking for bold would make the browser synthesize a fake one.
           * Capped at text-7xl — the previous text-9xl hero was, in the
           * owner's words, "overtobig".
           */}
          <h1 className="font-wordmark text-4xl font-normal tracking-wide md:text-6xl lg:text-7xl">
            {t("brand.wordmark")}
          </h1>
          <p className="max-w-content text-lg text-muted md:text-xl">{t("landing.tagline")}</p>
        </section>
      </div>

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

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight">{t("landing.blog.heading")}</h2>
          <Link to="/blog" className="link-inline text-sm" data-testid="landing-blog-all">
            {t("landing.blog.all")}
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug}>
              <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                data-testid="landing-blog-card"
                className="group flex h-full flex-col gap-2 rounded-card bg-surface p-6 shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover"
              >
                <h3 className="font-semibold text-ink decoration-accent decoration-2 underline-offset-4 group-hover:underline">
                  {post.title[lang]}
                </h3>
                <p className="text-sm text-muted">{post.excerpt[lang]}</p>
              </Link>
            </li>
          ))}
        </ul>
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
