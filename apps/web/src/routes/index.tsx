import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <Link
      to="/library"
      className="inline-flex min-h-tap-min items-center rounded-full bg-ink px-6 text-surface"
    >
      Browse the library
    </Link>
  ),
});
