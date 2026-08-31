import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./routeTree.gen";
import "./styles/theme.css";

/*
 * `scrollRestoration` is what makes Back mean "back to where I was" rather
 * than "back to the top". Without it the router scrolls to 0 on every
 * navigation, including a pop — so returning from an exercise to a library
 * paged sixty cards deep dropped the owner at the search box with the card
 * she had just been reading somewhere far below the fold. The router keeps a
 * position per history entry and restores it on pop; forward navigation still
 * starts at the top, which is the behaviour you want there.
 */
const router = createRouter({ routeTree, scrollRestoration: true });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
