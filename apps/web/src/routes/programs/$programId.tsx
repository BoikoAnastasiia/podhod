import { createFileRoute, Link } from "@tanstack/react-router";
import { ProgramEditor } from "../../components/ProgramEditor.js";
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
      <Link to="/programs" className="text-sm text-muted underline-offset-4 hover:underline">
        {t("programs.heading")}
      </Link>
      <ProgramEditor programId={programId} />
    </div>
  );
}
