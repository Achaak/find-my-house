import { describe, expect, it } from "vitest";
import { canRunPrivilegedCommand } from "./auth.js";

function makeInteraction(options: {
  guildId?: string;
  ownerId?: string;
  userId: string;
  roleIds?: string[];
}) {
  return {
    inGuild: () => options.guildId !== undefined,
    guild:
      options.guildId !== undefined
        ? { ownerId: options.ownerId ?? "owner-1" }
        : null,
    user: { id: options.userId },
    member:
      options.roleIds !== undefined
        ? { roles: options.roleIds }
        : { roles: [] as string[] },
  } as Parameters<typeof canRunPrivilegedCommand>[0];
}

describe("canRunPrivilegedCommand", () => {
  it("allows the guild owner", () => {
    expect(
      canRunPrivilegedCommand(
        makeInteraction({
          guildId: "guild-1",
          ownerId: "user-owner",
          userId: "user-owner",
        }),
        "admin-role"
      )
    ).toBe(true);
  });

  it("allows members with the admin role", () => {
    expect(
      canRunPrivilegedCommand(
        makeInteraction({
          guildId: "guild-1",
          userId: "user-1",
          roleIds: ["member-role", "admin-role"],
        }),
        "admin-role"
      )
    ).toBe(true);
  });

  it("denies members without the admin role", () => {
    expect(
      canRunPrivilegedCommand(
        makeInteraction({
          guildId: "guild-1",
          userId: "user-1",
          roleIds: ["member-role"],
        }),
        "admin-role"
      )
    ).toBe(false);
  });

  it("denies everyone when admin role is not configured", () => {
    expect(
      canRunPrivilegedCommand(
        makeInteraction({
          guildId: "guild-1",
          userId: "user-1",
          roleIds: ["member-role"],
        }),
        undefined
      )
    ).toBe(false);
  });
});
