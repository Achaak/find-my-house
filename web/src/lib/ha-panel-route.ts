import type { RegisteredRouter } from "@tanstack/react-router";

type HaPanelRoute = {
  path?: string;
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

export function initHaPanelRoute(router: RegisteredRouter): () => void {
  if (window.parent === window) {
    return () => {};
  }

  const navigateToPanelPath = (path: string) => {
    const target = path || "/";
    if (router.state.location.pathname === target) {
      return;
    }
    void router.navigate({ to: target });
  };

  const handler = (event: MessageEvent) => {
    if (event.source !== window.parent) {
      return;
    }
    if (!isHaPanelPropertiesMessage(event.data)) {
      return;
    }

    const path = event.data.route?.path;
    if (typeof path === "string") {
      navigateToPanelPath(path);
    }
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
