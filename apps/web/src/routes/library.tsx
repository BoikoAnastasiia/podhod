import { createFileRoute } from "@tanstack/react-router";

// Placeholder so the typed `Link to="/library"` in `index.tsx` compiles.
// Task 9 replaces this with the real library route.
export const Route = createFileRoute("/library")({
  component: () => <p>Library coming soon.</p>,
});
