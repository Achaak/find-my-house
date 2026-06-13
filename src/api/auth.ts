import type { Context, MiddlewareHandler } from "hono";
import { webConfig } from "../config/web.js";
import { createLogger } from "../utils/logger.js";
import type { ApiUser } from "./types.js";

const log = createLogger("api:auth");

type HaCurrentUser = {
  id: string;
  name: string;
  is_admin: boolean;
  is_owner: boolean;
};

export type AuthVariables = {
  user: ApiUser;
};

async function fetchHaCurrentUser(
  token: string
): Promise<HaCurrentUser | null> {
  const response = await fetch(
    `${webConfig.web.homeAssistantUrl}/api/auth/current_user`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    }
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as HaCurrentUser;
}

async function validateHaToken(token: string): Promise<boolean> {
  const response = await fetch(`${webConfig.web.homeAssistantUrl}/api/`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5_000),
  });
  return response.ok;
}

function resolveAdmin(
  username: string,
  haUser?: HaCurrentUser | null
): boolean {
  if (haUser) {
    return haUser.is_admin || haUser.is_owner;
  }

  const normalized = username.toLowerCase();
  if (webConfig.web.adminUsers.includes(normalized)) {
    return true;
  }

  return false;
}

function userFromIngress(forwardedUser: string): ApiUser {
  const username = forwardedUser.trim();
  return {
    id: `ha:${username.toLowerCase()}`,
    username,
    isAdmin: resolveAdmin(username),
  };
}

function userFromHaProfile(haUser: HaCurrentUser): ApiUser {
  return {
    id: `ha:${haUser.name.toLowerCase()}`,
    username: haUser.name,
    isAdmin: resolveAdmin(haUser.name, haUser),
  };
}

export async function resolveApiUser(
  request: Request
): Promise<ApiUser | null> {
  if (webConfig.web.authDisabled) {
    return {
      id: `ha:${webConfig.web.devUser.toLowerCase()}`,
      username: webConfig.web.devUser,
      isAdmin: true,
    };
  }

  const forwardedUser = request.headers.get("X-Forwarded-User");
  if (forwardedUser) {
    const bearer = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");
    if (bearer) {
      const haUser = await fetchHaCurrentUser(bearer);
      if (haUser) {
        return userFromHaProfile(haUser);
      }
    }

    return userFromIngress(forwardedUser);
  }

  const bearer = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!bearer) {
    return null;
  }

  const haUser = await fetchHaCurrentUser(bearer);
  if (haUser) {
    return userFromHaProfile(haUser);
  }

  if (await validateHaToken(bearer)) {
    return {
      id: `ha:token:${hashToken(bearer)}`,
      username: "token",
      isAdmin: false,
    };
  }

  return null;
}

function hashToken(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function requireAuth(): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    try {
      const user = await resolveApiUser(c.req.raw);
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      c.set("user", user);
      await next();
    } catch (error) {
      log.error("Auth error:", error);
      return c.json({ error: "Authentication service unavailable" }, 503);
    }
  };
}

export function requireAdmin(): MiddlewareHandler<{
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user.isAdmin) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
}

export function getUser(c: Context<{ Variables: AuthVariables }>): ApiUser {
  return c.get("user");
}
