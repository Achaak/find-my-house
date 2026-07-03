import type { CompatibilityModel } from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import { getListingCompatibilityCard } from "../services/compatibilityService.js";
import { sortByCompatibility } from "../utils/compatibility/score.js";
import { createLogger } from "../utils/logger.js";
import {
  callHaService,
  callHaServices,
  type HaServiceCallResult,
} from "./client.js";
import { formatPropertyNotification } from "./format.js";
import {
  buildListingNotificationPath,
  buildListingsIndexPath,
  notificationClickData,
  resolveAddonSlug,
} from "./listingNotificationPath.js";

const log = createLogger("home-assistant");

type ListingNotificationOptions = {
  header: (total: number, shown: number) => string;
  overflow: (hidden: number) => string;
  shouldNotify?: (property: PropertyRow) => boolean;
  logLabel: string;
  maxNotifications?: number;
  compatibilityModel?: CompatibilityModel | null;
  priceDrop?: boolean;
};

async function sendPropertyNotification(
  notifyServices: string[],
  property: PropertyRow,
  options: {
    compatibilityModel?: CompatibilityModel | null;
    header?: string;
    priceDrop?: boolean;
    token?: string;
    addonSlug?: string | null;
  }
): Promise<boolean> {
  const compatibility = options.compatibilityModel
    ? getListingCompatibilityCard(property, options.compatibilityModel)
    : undefined;

  const listingPath = buildListingNotificationPath(
    property.id,
    options.addonSlug ?? null
  );
  const { title, message } = formatPropertyNotification(property, {
    compatibility,
    header: options.header,
    priceDrop: options.priceDrop,
    listingPath,
  });

  const payload = {
    title,
    message,
    data: notificationClickData(listingPath),
  };

  const results = await Promise.all(
    notifyServices.map((service) =>
      callHaService(service, payload, { token: options.token })
    )
  );
  return results.some((result) => result.ok);
}

async function sendListingNotifications(
  notifyServices: string[],
  listings: PropertyRow[],
  options: ListingNotificationOptions & { token?: string }
): Promise<number> {
  const { shouldNotify, compatibilityModel } = options;
  const eligible = shouldNotify
    ? listings.filter((listing) => shouldNotify(listing))
    : listings;
  if (eligible.length === 0) return 0;

  const addonSlug = await resolveAddonSlug();
  const maxNotifications = options.maxNotifications ?? eligible.length;
  const ranked = compatibilityModel
    ? sortByCompatibility(eligible, compatibilityModel)
    : eligible;
  const toNotify = ranked.slice(0, maxNotifications);
  const hidden = eligible.length - toNotify.length;

  let sent = 0;
  let headerSent = false;

  for (const listing of toNotify) {
    const header = !headerSent
      ? options.header(eligible.length, toNotify.length)
      : undefined;

    const ok = await sendPropertyNotification(notifyServices, listing, {
      compatibilityModel,
      header,
      priceDrop: options.priceDrop,
      token: options.token,
      addonSlug,
    });

    if (ok) {
      headerSent = true;
      sent++;
    } else {
      log.error(`Send error ${options.logLabel} (#${String(listing.id)})`);
    }
  }

  if (hidden > 0) {
    const listingsPath = buildListingsIndexPath(addonSlug);
    const result = await callHaServices(
      notifyServices,
      {
        title: "Find My House",
        message: options.overflow(hidden),
        data: notificationClickData(listingsPath),
      },
      { token: options.token }
    );
    if (!result.ok) {
      log.error(`Summary send error ${options.logLabel}`);
    }
  }

  return sent;
}

export type ListingNotificationLimits = {
  maxNotifications?: number;
  compatibilityModel?: CompatibilityModel | null;
  token?: string;
};

export async function sendNewListingNotifications(
  notifyServices: string[],
  listings: PropertyRow[],
  limits: ListingNotificationLimits = {}
): Promise<number> {
  return sendListingNotifications(notifyServices, listings, {
    header: (total, shown) => {
      if (total === 1) return "🏠 1 nouvelle annonce";
      if (total === shown) {
        return `🏠 ${String(total)} nouvelles annonces`;
      }
      return `🏠 ${String(total)} nouvelles annonces — ${String(shown)} affichées`;
    },
    overflow: (hidden) =>
      hidden === 1
        ? "⏭️ 1 autre annonce non affichée — consultez l'app pour la voir."
        : `⏭️ ${String(hidden)} autres annonces non affichées — consultez l'app pour les voir.`,
    logLabel: "notification",
    maxNotifications: limits.maxNotifications,
    compatibilityModel: limits.compatibilityModel,
    token: limits.token,
  });
}

export async function sendPriceDropNotifications(
  notifyServices: string[],
  listings: PropertyRow[],
  limits: ListingNotificationLimits = {}
): Promise<number> {
  return sendListingNotifications(notifyServices, listings, {
    header: (total, shown) => {
      if (total === 1) return "📉 1 baisse de prix";
      if (total === shown) {
        return `📉 ${String(total)} baisses de prix`;
      }
      return `📉 ${String(total)} baisses de prix — ${String(shown)} affichées`;
    },
    overflow: (hidden) =>
      hidden === 1
        ? "⏭️ 1 autre baisse de prix non affichée — consultez l'app pour la voir."
        : `⏭️ ${String(hidden)} autres baisses de prix non affichées — consultez l'app pour les voir.`,
    shouldNotify: (property) => property.price < property.firstPrice,
    logLabel: "price drop",
    maxNotifications: limits.maxNotifications,
    compatibilityModel: limits.compatibilityModel,
    priceDrop: true,
    token: limits.token,
  });
}

export async function sendTestNotification(
  notifyServices: string[],
  options?: { token?: string }
): Promise<HaServiceCallResult> {
  const addonSlug = await resolveAddonSlug();
  const listingsPath = buildListingsIndexPath(addonSlug);

  return callHaServices(
    notifyServices,
    {
      title: "Find My House — test",
      message:
        "Notification de test envoyée depuis la page admin. Les alertes après scrape utilisent les mêmes services.",
      data: notificationClickData(listingsPath),
    },
    { token: options?.token }
  );
}
