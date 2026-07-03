import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initHaPanelRoute } from "./ha-panel-route";

describe("initHaPanelRoute", () => {
  let parentPostMessage: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let messageListeners: Array<(event: MessageEvent) => void>;

  beforeEach(() => {
    parentPostMessage = vi.fn();
    navigate = vi.fn();
    messageListeners = [];

    const parent = { postMessage: parentPostMessage };

    vi.stubGlobal("window", {
      parent,
      addEventListener: vi.fn(
        (type: string, listener: (event: MessageEvent) => void) => {
          if (type === "message") {
            messageListeners.push(listener);
          }
        }
      ),
      removeEventListener: vi.fn(
        (type: string, listener: (event: MessageEvent) => void) => {
          if (type === "message") {
            messageListeners = messageListeners.filter(
              (entry) => entry !== listener
            );
          }
        }
      ),
      dispatchEvent: vi.fn((event: MessageEvent) => {
        for (const listener of messageListeners) {
          listener(event);
        }
        return true;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("subscribes to HA panel properties when embedded", () => {
    const router = {
      state: { location: { pathname: "/" } },
      navigate,
    } as unknown as Parameters<typeof initHaPanelRoute>[0];

    const cleanup = initHaPanelRoute(router);

    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: "home-assistant/subscribe-properties" },
      "*"
    );

    for (const listener of messageListeners) {
      listener({
        source: window.parent,
        data: {
          type: "home-assistant/properties",
          route: { path: "/listings/42" },
        },
      } as MessageEvent);
    }

    expect(navigate).toHaveBeenCalledWith({ to: "/listings/42" });

    cleanup();
    expect(parentPostMessage).toHaveBeenCalledWith(
      { type: "home-assistant/unsubscribe-properties" },
      "*"
    );
  });

  it("does nothing outside an iframe", () => {
    const standaloneWindow = {
      parent: null as unknown as Window,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    standaloneWindow.parent = standaloneWindow as unknown as Window;
    vi.stubGlobal("window", standaloneWindow);

    const router = {
      state: { location: { pathname: "/" } },
      navigate,
    } as unknown as Parameters<typeof initHaPanelRoute>[0];

    initHaPanelRoute(router);

    expect(parentPostMessage).not.toHaveBeenCalled();
  });
});
