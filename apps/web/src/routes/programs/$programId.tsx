import { createFileRoute, Link } from "@tanstack/react-router";
import { ProgramEditor } from "../../components/ProgramEditor.js";
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
      <Link to="/programs" className="text-sm text-muted underline-offset-4 hover:underline">
        {t("programs.heading")}
      </Link>
      <ProgramEditor programId={programId} />
    </div>
  );
}
