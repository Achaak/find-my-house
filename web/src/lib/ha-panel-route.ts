import type { RegisteredRouter } from "@tanstack/react-router";
import { normalizeHaPanelPath } from "./panel-path";

type HaPanelRoute = {
  path?: string;
  prefix?: string;
};

type HaPanelPropertiesMessage = {
  type: "home-assistant/properties";
  route?: HaPanelRoute;
};

function isHaPanelPropertiesMessage(
  data: unknown
): data is HaPanelPropertiesMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as HaPanelPropertiesMessage).type === "home-assistant/properties"
  );
}

function navigateFromPanelPath(router: RegisteredRouter, path: string): void {
  const normalized = path.replace(/\/$/, "") || "/";

  const listingDetail = normalized.match(/^\/listings\/(\d+)$/);
  if (listingDetail) {
    if (router.state.location.pathname === normalized) {
      return;
    }
    void router.navigate({
      to: "/listings/$id",
      params: { id: listingDetail[1] },
    });
    return;
  }

  if (normalized === "/listings") {
    const current = router.state.location.pathname;
    if (current === "/listings" || current === "/listings/") {
      return;
    }
    void router.navigate({ to: "/listings" });
    return;
  }

  if (router.state.location.pathname === normalized) {
    return;
  }

  void router.navigate({ to: normalized });
}

export function initHaPanelRoute(router: RegisteredRouter): () => void {
  if (window.parent === window) {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    if (event.source !== window.parent) {
      return;
    }
    if (!isHaPanelPropertiesMessage(event.data)) {
      return;
    }

    if (!event.data.route) {
      return;
    }

    navigateFromPanelPath(router, normalizeHaPanelPath(event.data.route));
  };

  window.addEventListener("message", handler);
  window.parent.postMessage(
    { type: "home-assistant/subscribe-properties" },
    "*"
  );

  return () => {
    window.removeEventListener("message", handler);
    window.parent.postMessage(
      { type: "home-assistant/unsubscribe-properties" },
      "*"
    );
  };
}
