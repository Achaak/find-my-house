import { createLogger } from "../utils/logger.js";

const log = createLogger("home-assistant");

let cachedAddonSlug: string | null | undefined;

export function resetIngressBasePathCache(): void {
  cachedAddonSlug = undefined;
}

export async function resolveAddonSlug(): Promise<string | null> {
  if (cachedAddonSlug !== undefined) {
    return cachedAddonSlug;
  }

  const supervisorToken = process.env.SUPERVISOR_TOKEN;
  if (!supervisorToken) {
    cachedAddonSlug = null;
    return null;
  }

  try {
    const response = await fetch("http://supervisor/addons/self/info", {
      headers: { Authorization: `Bearer ${supervisorToken}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      log.warn(
        `Unable to resolve add-on slug from supervisor (${String(response.status)}) — notification links will miss the panel prefix`
      );
      cachedAddonSlug = null;
      return null;
    }

    const body = (await response.json()) as {
      data?: { slug?: string | null };
    };
    const slug = body.data?.slug?.trim();
    if (!slug) {
      log.warn(
        "Supervisor returned no add-on slug — notification links will miss the panel prefix"
      );
    }
    cachedAddonSlug = slug ?? null;
    return cachedAddonSlug;
  } catch (error) {
    log.warn(
      "Failed to resolve add-on slug from supervisor — notification links will miss the panel prefix:",
      error
    );
    cachedAddonSlug = null;
    return null;
  }
}

export function buildListingNotificationPath(
  propertyId: number,
  addonSlug: string | null
): string {
  const listingPath = `/listings/${String(propertyId)}`;
  return addonSlug ? `/${addonSlug}${listingPath}` : listingPath;
}

export function buildListingsIndexPath(addonSlug: string | null): string {
  return addonSlug ? `/${addonSlug}/listings` : "/listings";
}

export function notificationClickData(path: string): {
  url: string;
  clickAction: string;
} {
  return { url: path, clickAction: path };
}
