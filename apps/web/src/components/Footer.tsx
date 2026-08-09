import { ATTRIBUTION } from "@podhod/core";
import { useI18n } from "../i18n/useI18n.js";

const GITHUB_URL = "https://github.com/BoikoAnastasiia/podhod";
const GYMVISUAL_URL = "https://gymvisual.com/";

/**
 * One footer for the whole app, mounted by the root layout after a
 * flex-grown <main> — which is what actually pins it to the bottom of the
 * viewport on short pages instead of letting it drift up into the canvas.
 * It used to live inside the landing route only, where neither of those
 * things could be true. Both sides are links: the media attribution goes to
 * its source, same as the GitHub credit.
 */
export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-page flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-16 xl:px-28">
        <a
          href={GYMVISUAL_URL}
          target="_blank"
          rel="noreferrer"
          data-testid="footer-attribution"
          className="link-inline inline-flex min-h-tap-min w-max items-center"
        >
          {ATTRIBUTION}
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="link-inline inline-flex min-h-tap-min w-max items-center"
        >
          {t("footer.github")}
        </a>
      </div>
    </footer>
  );
}
