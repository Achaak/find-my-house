const ADDON_SLUG = process.env.ADDON_SLUG ?? "find_my_house";

let cachedIngressBase: string | null | undefined;

export function resetIngressBasePathCache(): void {
  cachedIngressBase = undefined;
}

export async function resolveIngressBasePath(): Promise<string | null> {
  if (cachedIngressBase !== undefined) {
    return cachedIngressBase;
  }

  const supervisorToken = process.env.SUPERVISOR_TOKEN;
  if (!supervisorToken) {
    cachedIngressBase = null;
    return null;
  }

  try {
    const response = await fetch(
      `http://supervisor/addons/${ADDON_SLUG}/info`,
      {
        headers: { Authorization: `Bearer ${supervisorToken}` },
        signal: AbortSignal.timeout(5_000),
      }
    );
    if (!response.ok) {
      cachedIngressBase = null;
      return null;
    }

    const body = (await response.json()) as {
      data?: { ingress_url?: string | null };
    };
    const ingressUrl = body.data?.ingress_url?.replace(/\/$/, "");
    cachedIngressBase = ingressUrl ?? null;
    return cachedIngressBase;
  } catch {
    cachedIngressBase = null;
    return null;
  }
}

export function buildListingNotificationPath(
  propertyId: number,
  ingressBase: string | null
): string {
  const listingPath = `/listings/${String(propertyId)}`;
  return ingressBase ? `${ingressBase}${listingPath}` : listingPath;
}

export function buildListingsIndexPath(ingressBase: string | null): string {
  return ingressBase ? `${ingressBase}/listings` : "/listings";
}

export function notificationClickData(path: string): {
  url: string;
  clickAction: string;
} {
  return { url: path, clickAction: path };
}
