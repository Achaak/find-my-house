import type { CompatibilityModel } from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import { getListingCompatibilityCard } from "../services/compatibilityService.js";
import { sortByCompatibility } from "../utils/compatibility/score.js";
import { createLogger } from "../utils/logger.js";
import { callHaService } from "./client.js";
import { formatPropertyNotification } from "./format.js";

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
  notifyService: string,
  property: PropertyRow,
  options: {
    compatibilityModel?: CompatibilityModel | null;
    header?: string;
    priceDrop?: boolean;
  }
): Promise<boolean> {
  const compatibility = options.compatibilityModel
    ? getListingCompatibilityCard(property, options.compatibilityModel)
    : undefined;

  const { title, message, url } = formatPropertyNotification(property, {
    compatibility,
    header: options.header,
    priceDrop: options.priceDrop,
  });

  return callHaService(notifyService, {
    title,
    message,
    data: url ? { url } : undefined,
  });
}

async function sendListingNotifications(
  notifyService: string,
  listings: PropertyRow[],
  options: ListingNotificationOptions
): Promise<number> {
  const { shouldNotify, compatibilityModel } = options;
  const eligible = shouldNotify
    ? listings.filter((listing) => shouldNotify(listing))
    : listings;
  if (eligible.length === 0) return 0;

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

    const ok = await sendPropertyNotification(notifyService, listing, {
      compatibilityModel,
      header,
      priceDrop: options.priceDrop,
    });

    if (ok) {
      headerSent = true;
      sent++;
    } else {
      log.error(`Send error ${options.logLabel} (#${String(listing.id)})`);
    }
  }

  if (hidden > 0) {
    const ok = await callHaService(notifyService, {
      title: "Find My House",
      message: options.overflow(hidden),
    });
    if (!ok) {
      log.error(`Summary send error ${options.logLabel}`);
    }
  }

  return sent;
}

export type ListingNotificationLimits = {
  maxNotifications?: number;
  compatibilityModel?: CompatibilityModel | null;
};

export async function sendNewListingNotifications(
  notifyService: string,
  listings: PropertyRow[],
  limits: ListingNotificationLimits = {}
): Promise<number> {
  return sendListingNotifications(notifyService, listings, {
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
  });
}

export async function sendPriceDropNotifications(
  notifyService: string,
  listings: PropertyRow[],
  limits: ListingNotificationLimits = {}
): Promise<number> {
  return sendListingNotifications(notifyService, listings, {
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
  });
}

export async function sendTestNotification(
  notifyService: string
): Promise<boolean> {
  return callHaService(notifyService, {
    title: "Find My House — test",
    message:
      "Notification de test envoyée depuis la page admin. Les alertes après scrape utilisent le même service.",
  });
}
