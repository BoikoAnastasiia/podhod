import { createFileRoute } from "@tanstack/react-router";

// Placeholder so the typed `Link to="/library/$id"` in ExerciseCard compiles.
// A later task (the exercise detail screen) replaces this with the real route.
export const Route = createFileRoute("/library/$id")({
  component: () => <p>Exercise detail coming soon.</p>,
});
