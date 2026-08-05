import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "../i18n/useI18n.js";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { t } = useI18n();
  return (
    <Link
      to="/library"
      className="inline-flex min-h-tap-min items-center rounded-full bg-ink px-6 text-surface"
    >
      {t("home.browseLibrary")}
    </Link>
  );
}
