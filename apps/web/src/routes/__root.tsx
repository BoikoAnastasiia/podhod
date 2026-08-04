import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto w-full max-w-page">
        <header className="flex items-center gap-4 px-4 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Подход
          </Link>
        </header>
        <main className="px-4 pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  ),
});
