import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/web.js", () => ({
  webConfig: {
    web: {
      authDisabled: false,
      homeAssistantUrl: "http://127.0.0.1:8123",
      adminUsers: [],
      devUser: "dev",
    },
  },
}));

const {
  AUTH_USER_CACHE_TTL_MS,
  clearAuthUserCache,
  getIngressUsername,
  resolveApiUser,
} = await import("./auth.js");

describe("getIngressUsername", () => {
  it("reads X-Remote-User-Name from HA ingress", () => {
    const request = new Request("http://localhost/api/me", {
      headers: { "X-Remote-User-Name": "achak" },
    });

    expect(getIngressUsername(request)).toBe("achak");
  });

  it("falls back to X-Remote-User-Display-Name", () => {
    const request = new Request("http://localhost/api/me", {
      headers: { "X-Remote-User-Display-Name": "Achak" },
    });

    expect(getIngressUsername(request)).toBe("Achak");
  });

  it("supports legacy X-Forwarded-User", () => {
    const request = new Request("http://localhost/api/me", {
      headers: { "X-Forwarded-User": "legacy-user" },
    });

    expect(getIngressUsername(request)).toBe("legacy-user");
  });

  it("returns null when no ingress user headers are present", () => {
    expect(
      getIngressUsername(new Request("http://localhost/api/me"))
    ).toBeNull();
  });
});

describe("resolveApiUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAuthUserCache();
    vi.unstubAllEnvs();
  });

  it("authenticates HA ingress requests without a bearer token", async () => {
    const user = await resolveApiUser(
      new Request("http://localhost/api/me", {
        headers: { "X-Remote-User-Name": "achak" },
      })
    );

    expect(user).toEqual({
      id: "ha:achak",
      username: "achak",
      isAdmin: false,
    });
  });

  it("treats HA ingress users as admin when panel_admin is enabled", async () => {
    vi.stubEnv("SUPERVISOR_TOKEN", "supervisor-token");
    vi.stubEnv("PANEL_ADMIN", "true");

    const user = await resolveApiUser(
      new Request("http://localhost/api/me", {
        headers: { "X-Remote-User-Name": "achak" },
      })
    );

    expect(user).toEqual({
      id: "ha:achak",
      username: "achak",
      isAdmin: true,
    });
  });

  it("caches bearer token resolution across requests within the TTL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "user-1",
          name: "Achak",
          is_admin: true,
          is_owner: false,
        }),
        { status: 200 }
      )
    );

    const request = () =>
      new Request("http://localhost/api/me", {
        headers: { Authorization: "Bearer ha-token" },
      });

    const first = await resolveApiUser(request());
    const second = await resolveApiUser(request());

    expect(first).toEqual({
      id: "ha:achak",
      username: "Achak",
      isAdmin: true,
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("revalidates with Home Assistant after the cache TTL expires", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: "user-1",
            name: "Achak",
            is_admin: false,
            is_owner: false,
          }),
          { status: 200 }
        )
      )
    );

    const request = new Request("http://localhost/api/me", {
      headers: { Authorization: "Bearer ha-token" },
    });

    await resolveApiUser(request);
    vi.advanceTimersByTime(AUTH_USER_CACHE_TTL_MS + 1);
    await resolveApiUser(request);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
