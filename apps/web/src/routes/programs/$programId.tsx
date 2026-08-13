import { createFileRoute, Link } from "@tanstack/react-router";
import { ProgramEditor } from "../../components/ProgramEditor.js";
import { ChevronLeftIcon } from "../../components/icons.js";
import { ProgramIconSprite } from "../../components/ProgramIcon.js";
import { useI18n } from "../../i18n/useI18n.js";
import { requireSession } from "../../lib/requireSession.js";

/**
 * The page shell around ProgramEditor — the mobile presentation and the
 * deep-link target. Desktop reaches the same editor as a dialog over
 * /programs instead.
 */
export const Route = createFileRoute("/programs/$programId")({
  beforeLoad: ({ location }) => requireSession(location.href),
  component: ProgramDetail,
});

function ProgramDetail() {
  const { programId } = Route.useParams();
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
      {/*
       * The glyph definitions this page's program icon references. Mounted per
       * program route rather than in the root shell, so the landing, library
       * and blog — none of which render a program icon — do not carry the
       * sheet in the main bundle. Only one program route is mounted at a time,
       * so the symbol ids cannot collide.
       */}
      <ProgramIconSprite />
      {/*
       * A back control, not a breadcrumb. This page is where a phone lands when
       * a program is opened, so "Programs" above the title was the only way out
       * — and as bare text at 14px it read as a heading for the page rather
       * than a way off it. The chevron and the tap target are what make it look
       * like the exit it always was.
       */}
      <Link
        to="/programs"
        data-testid="back-to-programs"
        className="flex min-h-tap-min w-max items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        <ChevronLeftIcon />
        {t("programs.heading")}
      </Link>
      <ProgramEditor programId={programId} />
    </div>
  );
}
