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

const { getIngressUsername, resolveApiUser } = await import("./auth.js");

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
});
