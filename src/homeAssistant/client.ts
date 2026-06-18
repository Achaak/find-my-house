import { webConfig } from "../config/web.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("home-assistant");

export type HaServiceCallResult = { ok: true } | { ok: false; error: string };

export function parseHaService(service: string): {
  domain: string;
  service: string;
} {
  const dotIndex = service.indexOf(".");
  if (dotIndex === -1) {
    return { domain: service, service };
  }

  return {
    domain: service.slice(0, dotIndex),
    service: service.slice(dotIndex + 1),
  };
}

export function resolveHaApiToken(requestToken?: string): string | undefined {
  if (process.env.SUPERVISOR_TOKEN) {
    return process.env.SUPERVISOR_TOKEN;
  }
  return process.env.HOME_ASSISTANT_TOKEN ?? requestToken;
}

export function isHomeAssistantAddOn(): boolean {
  return Boolean(process.env.SUPERVISOR_TOKEN);
}

export async function callHaService(
  service: string,
  data: Record<string, unknown>,
  options?: { token?: string }
): Promise<HaServiceCallResult> {
  const token = resolveHaApiToken(options?.token);
  if (!token) {
    const error =
      "No Home Assistant token available (SUPERVISOR_TOKEN, HOME_ASSISTANT_TOKEN, or user bearer token)";
    log.warn(error);
    return { ok: false, error };
  }

  const { domain, service: serviceName } = parseHaService(service);
  const url = `${webConfig.web.homeAssistantUrl}/api/services/${domain}/${serviceName}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const error =
        body.trim() || `${String(response.status)} ${response.statusText}`;
      log.error(`Service call failed (${service}): ${error}`);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Service call error (${service}):`, error);
    return { ok: false, error: message };
  }
}
