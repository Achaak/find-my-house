import { webConfig } from "../config/web.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("home-assistant");

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

export function resolveHaApiToken(): string | undefined {
  return process.env.SUPERVISOR_TOKEN ?? process.env.HOME_ASSISTANT_TOKEN;
}

export async function callHaService(
  service: string,
  data: Record<string, unknown>
): Promise<boolean> {
  const token = resolveHaApiToken();
  if (!token) {
    log.warn("No Home Assistant token — skipping service call");
    return false;
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
      log.error(
        `Service call failed (${String(response.status)} ${service}): ${body}`
      );
      return false;
    }

    return true;
  } catch (error) {
    log.error(`Service call error (${service}):`, error);
    return false;
  }
}
