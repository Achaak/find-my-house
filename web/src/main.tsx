import { getLocale } from "@/paraglide/runtime.js";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { getIngressBasePath } from "@/lib/base-path";
import { initHaPanelRoute } from "@/lib/ha-panel-route";
import { queryClient } from "@/lib/query-client";
import { routeTree } from "./routeTree.gen";
import "./index.css";
import { initTheme } from "@/hooks/use-theme";

initTheme();

document.documentElement.lang = getLocale();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  basepath: getIngressBasePath() || "/",
});

initHaPanelRoute(router);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
