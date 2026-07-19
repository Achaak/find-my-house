import { createHash } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { webConfig } from "../config/web.js";
import { createLogger } from "../utils/logger.js";
import type { ApiUser } from "./types.js";

const log = createLogger("api:auth");

/** Short TTL so a navigation burst reuses one HA validation. */
export const AUTH_USER_CACHE_TTL_MS = 45_000;

type HaCurrentUser = {
  id: string;
  name: string;
  is_admin: boolean;
  is_owner: boolean;
};

export type AuthVariables = {
  user: ApiUser;
};

type AuthCacheEntry = {
  user: ApiUser;
  expiresAt: number;
};

const bearerUserCache = new Map<string, AuthCacheEntry>();

function bearerCacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getCachedBearerUser(token: string): ApiUser | null {
  const key = bearerCacheKey(token);
  const entry = bearerUserCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    bearerUserCache.delete(key);
    return null;
  }
  return entry.user;
}

function setCachedBearerUser(token: string, user: ApiUser): void {
  bearerUserCache.set(bearerCacheKey(token), {
    user,
    expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS,
  });
}

/** Clears the in-memory bearer → user cache (tests). */
export function clearAuthUserCache(): void {
  bearerUserCache.clear();
}

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

/** HA Supervisor ingress user headers (supervisor/const.py). */
export function getIngressUsername(request: Request): string | null {
  const name = request.headers.get("X-Remote-User-Name")?.trim();
  if (name) return name;

  const displayName = request.headers.get("X-Remote-User-Display-Name")?.trim();
  if (displayName) return displayName;

  const legacy = request.headers.get("X-Forwarded-User")?.trim();
  if (legacy) return legacy;

  const userId = request.headers.get("X-Remote-User-Id")?.trim();
  if (userId) return userId;

  return null;
}

/** HA Ingress with default panel_admin only allows administrators to open the panel. */
function ingressAssumesHaAdmin(): boolean {
  if (!process.env.SUPERVISOR_TOKEN) {
    return false;
  }
  return process.env.PANEL_ADMIN !== "false";
}

function userFromIngress(username: string): ApiUser {
  const normalized = username.trim();
  return {
    id: `ha:${normalized.toLowerCase()}`,
    username: normalized,
    isAdmin: resolveAdmin(normalized) || ingressAssumesHaAdmin(),
  };
}

function userFromHaProfile(haUser: HaCurrentUser): ApiUser {
  return {
    id: `ha:${haUser.name.toLowerCase()}`,
    username: haUser.name,
    isAdmin: resolveAdmin(haUser.name, haUser),
  };
}

async function resolveBearerUser(bearer: string): Promise<ApiUser | null> {
  const cached = getCachedBearerUser(bearer);
  if (cached) {
    return cached;
  }

  const haUser = await fetchHaCurrentUser(bearer);
  if (haUser) {
    const user = userFromHaProfile(haUser);
    setCachedBearerUser(bearer, user);
    return user;
  }

  if (await validateHaToken(bearer)) {
    const user: ApiUser = {
      id: `ha:token:${hashToken(bearer)}`,
      username: "token",
      isAdmin: false,
    };
    setCachedBearerUser(bearer, user);
    return user;
  }

  return null;
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

  const bearer = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");

  const ingressUser = getIngressUsername(request);
  if (ingressUser) {
    if (bearer) {
      const fromBearer = await resolveBearerUser(bearer);
      if (fromBearer) {
        return fromBearer;
      }
    }

    return userFromIngress(ingressUser);
  }

  if (!bearer) {
    return null;
  }

  return resolveBearerUser(bearer);
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
