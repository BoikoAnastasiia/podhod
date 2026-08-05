import { useGSAP } from "@gsap/react";
import { ATTRIBUTION, mediaUrl } from "@podhod/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useRef } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchExercise } from "../../lib/api.js";
import { takeThumbState } from "../../lib/flipStore.js";

gsap.registerPlugin(Flip, useGSAP);

export const Route = createFileRoute("/library/$id")({ component: Detail });

function Detail() {
  const { id } = Route.useParams();
  const { lang, term, t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement>(null);

  const {
    data,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["exercise", id, lang],
    queryFn: () => fetchExercise(id, lang),
  });

  useGSAP(
    () => {
      if (!data) return;
      const state = takeThumbState();
      // A ref, not a querySelector on a test attribute — removing
      // data-testid="exercise-gif" for test hygiene would otherwise
      // silently kill this animation.
      const media = mediaRef.current;
      if (!media) return;

      gsap.matchMedia().add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          // State is conveyed by layout and colour; motion is only emphasis.
          if (ctx.conditions?.reduced) return;
          if (state) {
            Flip.from(state, {
              targets: media,
              duration: 0.45,
              ease: "power2.inOut",
              absolute: true,
            });
          } else {
            gsap.from(media, { opacity: 0, y: 12, duration: 0.35 });
          }
        },
      );
    },
    { scope: root, dependencies: [data] },
  );

  const backLink = (
    <Link
      to="/library"
      data-testid="back-to-library"
      className="inline-flex min-h-tap-min w-max items-center gap-2 rounded-full bg-surface px-5 text-sm font-medium text-ink"
    >
      ← {t("nav.library")}
    </Link>
  );

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted">{t("library.error")}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-tap-min rounded-full bg-surface px-5 text-sm font-medium text-ink"
          >
            {t("library.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <p className="text-muted">{t("library.loading")}</p>
      </div>
    );
  }

  return (
    <div ref={root} className="flex flex-col gap-4">
      {backLink}

      <div className="flex max-w-content flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
        <p className="text-sm text-muted">
          {term(data.bodyPart)} · {term(data.equipment)} · {term(data.target)}
        </p>

        <div className="w-max rounded-card bg-surface p-3">
          <img
            ref={mediaRef}
            src={mediaUrl(data.gifPath)}
            alt=""
            width={180}
            height={180}
            data-testid="exercise-gif"
            data-flip-id={data.id}
            className="size-media rounded-row bg-canvas object-contain"
          />
        </div>

        <ol
          data-testid="exercise-steps"
          className="flex list-decimal flex-col gap-2 pl-5"
        >
          {data.steps.map((step, i) => (
            <li key={i} className="text-sm leading-relaxed">
              {step}
            </li>
          ))}
        </ol>

        <p data-testid="attribution" className="text-xs text-muted">
          {ATTRIBUTION}
        </p>
      </div>
    </div>
  );
}
