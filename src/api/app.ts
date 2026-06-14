import { Hono } from "hono";
import {
  getUser,
  requireAdmin,
  requireAuth,
  type AuthVariables,
} from "./auth.js";
import { parseListingSearchFilters } from "./searchFilters.js";
import {
  serializeDpeCandidate,
  serializeProperties,
  serializeProperty,
} from "./serialize.js";
import type { ApiContext } from "./types.js";
import { scrapeConfig } from "../config/scrape.js";
import { getPrisma } from "../db/prisma.js";
import {
  resetListingCompatibilityCache,
  resolveListingCompatibilityPreferences,
} from "../services/compatibilityService.js";
import { reconcileProperties } from "../services/reconcileService.js";
import { ensurePropertyEnriched } from "../services/enrichmentService.js";
import { formatScrapeSummary } from "../services/formatScrapeSummary.js";
import {
  clearBrowseSession,
  getBrowseSession,
  getBrowseState,
  startBrowseSession,
  type BrowseSession,
} from "../services/browseSession.js";
import type { BrowseState as InternalBrowseState } from "../services/browseSession.js";
import { geoFilterLabel, resolveGeoFilter } from "../utils/geo/geoFilter.js";
import { sortByCompatibility } from "../utils/compatibility/score.js";
import {
  searchDpeForProperty,
  fetchDpeByNumero,
} from "../utils/energy/ademeDpeApi.js";
import { getDpeAddressSearchReadiness } from "../utils/energy/dpePropertyMatch.js";
import { getBuildInfo } from "../version.js";
import { createLogger } from "../utils/logger.js";
import type { ScrapeFilters } from "../types/listing.js";

const log = createLogger("api");

function scrapeFiltersToSearch(filters: ScrapeFilters) {
  return {
    city: filters.city,
    postalCode: filters.postalCode,
    maxPrice: filters.maxPrice,
    minSurface: filters.minSurface,
    minLandSurface: filters.minLandSurface,
    minRooms: filters.minRooms,
    minBedrooms: filters.minBedrooms,
    ancienOnly: filters.ancienOnly,
    maxTravelMinutes: filters.maxTravelMinutes,
  };
}

async function serializeBrowseResponse(
  ctx: ApiContext,
  userId: string,
  session: BrowseSession,
  state: InternalBrowseState
) {
  const geoFilter = resolveGeoFilter(
    { maxTravelMinutes: session.filters.maxTravelMinutes },
    true
  );

  return {
    item: state.property
      ? await serializeProperty(state.property, ctx.reactionRepository, userId)
      : null,
    shownCount: state.shownCount,
    isExplore: state.isExplore,
    hasPreferences: state.hasPreferences,
    finished: state.finished,
    criteria: session.filters,
    zoneLabel:
      geoFilter.mode !== "city" ? geoFilterLabel(geoFilter) : undefined,
  };
}

export function createApiApp(ctx: ApiContext) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.get("/api/version", (c) => c.json(getBuildInfo()));

  app.use("/api/*", requireAuth());

  app.get("/api/me", (c) => c.json(getUser(c)));

  app.get("/api/listings", async (c) => {
    const query = c.req.query();
    const parsed = parseListingSearchFilters(query);
    if (parsed.error) {
      return c.json({ error: parsed.error }, 400);
    }

    const { filters } = parsed;
    const geoFilter = resolveGeoFilter(
      { maxTravelMinutes: filters.maxTravelMinutes },
      true
    );

    if (geoFilter.mode !== "city" && !filters.city) {
      return c.json({ error: "Specify a city for a geographic filter." }, 400);
    }

    const user = getUser(c);
    const sort = filters.sort;
    const limit = filters.limit ?? 20;

    const { items: listings, total } = await ctx.repository.search({
      ...filters,
      sort: sort === "compat_desc" ? undefined : sort,
      limit: sort === "compat_desc" ? Math.max(limit, 50) : limit,
      offset: filters.offset,
    });

    const rankedListings =
      sort === "compat_desc"
        ? sortByCompatibility(
            listings,
            await resolveListingCompatibilityPreferences(
              ctx.reactionRepository,
              user.id
            )
          ).slice(0, limit)
        : listings;

    const items = await serializeProperties(
      rankedListings,
      ctx.reactionRepository,
      user.id
    );

    return c.json({
      items,
      total,
      zone: geoFilter.mode !== "city" ? geoFilterLabel(geoFilter) : undefined,
    });
  });

  app.get("/api/listings/:id", async (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid listing id" }, 400);
    }

    const user = getUser(c);
    const { property } = await ensurePropertyEnriched(
      ctx.repository,
      id,
      "display"
    );
    if (!property) {
      return c.json({ error: "Listing not found" }, 404);
    }

    return c.json({
      item: await serializeProperty(property, ctx.reactionRepository, user.id),
    });
  });

  app.post("/api/browse/start", async (c) => {
    const user = getUser(c);
    clearBrowseSession(user.id);
    const session = startBrowseSession(
      user.id,
      scrapeFiltersToSearch(ctx.scrapeDefaults)
    );
    const state = await getBrowseState(
      ctx.repository,
      ctx.reactionRepository,
      user.id,
      session
    );

    return c.json(await serializeBrowseResponse(ctx, user.id, session, state));
  });

  app.get("/api/browse", async (c) => {
    const user = getUser(c);
    const session = getBrowseSession(user.id);
    if (!session) {
      return c.json({ error: "No active browse session" }, 404);
    }

    const state = await getBrowseState(
      ctx.repository,
      ctx.reactionRepository,
      user.id,
      session
    );

    return c.json(await serializeBrowseResponse(ctx, user.id, session, state));
  });

  app.post("/api/browse/stop", (c) => {
    const user = getUser(c);
    const session = getBrowseSession(user.id);
    const reviewed = session?.shownCount ?? 0;
    clearBrowseSession(user.id);
    return c.json({ reviewed });
  });

  app.post("/api/browse/:action", async (c) => {
    const action = c.req.param("action");
    if (action !== "like" && action !== "dislike") {
      return c.json({ error: "Invalid action" }, 400);
    }

    const user = getUser(c);
    const session = getBrowseSession(user.id);
    if (!session) {
      return c.json({ error: "Browse session expired" }, 404);
    }

    const body: { propertyId?: number } = await c.req
      .json<{ propertyId?: number }>()
      .catch(() => ({ propertyId: undefined }));
    const propertyId = body.propertyId;
    if (!propertyId || !Number.isInteger(propertyId)) {
      return c.json({ error: "propertyId is required" }, 400);
    }

    const listing = await ctx.repository.findById(propertyId);
    if (!listing) {
      clearBrowseSession(user.id);
      return c.json({ error: "Listing not found" }, 404);
    }

    await ctx.reactionRepository.add(user.id, propertyId, action);
    resetListingCompatibilityCache();

    const state = await getBrowseState(
      ctx.repository,
      ctx.reactionRepository,
      user.id,
      session
    );

    return c.json(await serializeBrowseResponse(ctx, user.id, session, state));
  });

  app.get("/api/reactions/:type", async (c) => {
    const type = c.req.param("type");
    if (type !== "like" && type !== "dislike") {
      return c.json({ error: "Invalid reaction type" }, 400);
    }

    const user = getUser(c);
    const limit = Math.min(
      Number.parseInt(c.req.query("limit") ?? "20", 10),
      100
    );
    const includeArchived = c.req.query("includeArchived") === "true";
    const archivedOnly = c.req.query("archivedOnly") === "true";
    const listings = await ctx.reactionRepository.findListingsByUser(
      user.id,
      type,
      limit,
      {
        excludeArchived: !includeArchived && !archivedOnly,
        archivedOnly,
      }
    );

    return c.json({
      items: await serializeProperties(
        listings,
        ctx.reactionRepository,
        user.id
      ),
    });
  });

  app.post("/api/reactions/:type", async (c) => {
    const type = c.req.param("type");
    if (type !== "like" && type !== "dislike") {
      return c.json({ error: "Invalid reaction type" }, 400);
    }

    const user = getUser(c);
    const body = await c.req.json<{ propertyId?: number }>();
    const propertyId = body.propertyId;
    if (!propertyId || !Number.isInteger(propertyId)) {
      return c.json({ error: "propertyId is required" }, 400);
    }

    const listing = await ctx.repository.findById(propertyId);
    if (!listing) {
      return c.json({ error: "Listing not found" }, 404);
    }

    const result = await ctx.reactionRepository.add(user.id, propertyId, type);
    resetListingCompatibilityCache();
    return c.json({ status: result });
  });

  app.delete("/api/reactions/:type/:propertyId", async (c) => {
    const type = c.req.param("type");
    if (type !== "like" && type !== "dislike") {
      return c.json({ error: "Invalid reaction type" }, 400);
    }

    const propertyId = Number.parseInt(c.req.param("propertyId"), 10);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return c.json({ error: "Invalid property id" }, 400);
    }

    const user = getUser(c);
    const removed = await ctx.reactionRepository.remove(
      user.id,
      propertyId,
      type
    );
    resetListingCompatibilityCache();
    return c.json({ removed });
  });

  app.post("/api/reactions/like/:propertyId/archive", async (c) => {
    const propertyId = Number.parseInt(c.req.param("propertyId"), 10);
    const user = getUser(c);
    const result = await ctx.reactionRepository.archive(user.id, propertyId);
    return c.json({ status: result });
  });

  app.post("/api/reactions/like/:propertyId/unarchive", async (c) => {
    const propertyId = Number.parseInt(c.req.param("propertyId"), 10);
    const user = getUser(c);
    const result = await ctx.reactionRepository.unarchive(user.id, propertyId);
    return c.json({ status: result });
  });

  app.get("/api/notifications/digest", async (c) => {
    const user = getUser(c);
    const sinceRaw = c.req.query("since");
    const since = sinceRaw
      ? new Date(sinceRaw)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(since.getTime())) {
      return c.json({ error: "Invalid since timestamp" }, 400);
    }

    const [newListings, priceDrops, activity] = await Promise.all([
      ctx.repository.findAddedSince(since, 20),
      ctx.repository.findPriceDrops(10),
      ctx.repository.getActivityStats(),
    ]);

    return c.json({
      since: since.toISOString(),
      newListings: await serializeProperties(
        newListings,
        ctx.reactionRepository,
        user.id,
        { includeCompatibility: false }
      ),
      priceDrops: await serializeProperties(
        priceDrops,
        ctx.reactionRepository,
        user.id,
        { includeCompatibility: false }
      ),
      lastScrapedAt: activity.lastScrapedAt?.toISOString() ?? null,
    });
  });

  app.get("/api/stats/:section", async (c) => {
    const section = c.req.param("section");
    const user = getUser(c);

    switch (section) {
      case "overview": {
        const [
          total,
          activeProperties,
          activePublications,
          inactivePublications,
          priceDrops,
          sourceCounts,
          priceStats,
          topCities,
          activity,
          recent,
          likes,
          dislikes,
        ] = await Promise.all([
          ctx.repository.count(),
          ctx.repository.countActiveProperties(),
          ctx.repository.countPublications(),
          ctx.repository.countInactivePublications(),
          ctx.repository.countPriceDrops(),
          ctx.repository.getPublicationCountsBySource(),
          ctx.repository.getPriceStats(),
          ctx.repository.getTopCities(3),
          ctx.repository.getActivityStats(),
          ctx.repository.findRecent(3),
          ctx.reactionRepository.countByUser(user.id, "like"),
          ctx.reactionRepository.countByUser(user.id, "dislike"),
        ]);
        return c.json({
          total,
          activeProperties,
          activePublications,
          inactivePublications,
          priceDrops,
          sourceCounts,
          priceStats,
          topCities,
          activity,
          recent: await serializeProperties(
            recent,
            ctx.reactionRepository,
            user.id,
            {
              includeCompatibility: false,
            }
          ),
          likes,
          dislikes,
        });
      }
      case "sources": {
        const [sourceCounts, activity] = await Promise.all([
          ctx.repository.getPublicationCountsBySource(),
          ctx.repository.getActivityStats(),
        ]);
        return c.json({
          sourceCounts,
          multiSourceCount: activity.multiSourceCount,
        });
      }
      case "prices": {
        const [priceStats, priceDrops, drops] = await Promise.all([
          ctx.repository.getPriceStats(),
          ctx.repository.countPriceDrops(),
          ctx.repository.findPriceDrops(5),
        ]);
        return c.json({
          priceStats,
          priceDrops,
          drops: await serializeProperties(
            drops,
            ctx.reactionRepository,
            user.id,
            {
              includeCompatibility: false,
            }
          ),
        });
      }
      case "mine": {
        const [likes, dislikes, recentLikes, recentDislikes] =
          await Promise.all([
            ctx.reactionRepository.countByUser(user.id, "like"),
            ctx.reactionRepository.countByUser(user.id, "dislike"),
            ctx.reactionRepository.findListingsByUser(user.id, "like", 5),
            ctx.reactionRepository.findListingsByUser(user.id, "dislike", 5),
          ]);
        return c.json({
          likes,
          dislikes,
          recentLikes: await serializeProperties(
            recentLikes,
            ctx.reactionRepository,
            user.id,
            { includeCompatibility: false }
          ),
          recentDislikes: await serializeProperties(
            recentDislikes,
            ctx.reactionRepository,
            user.id,
            { includeCompatibility: false }
          ),
        });
      }
      case "activity": {
        const { city, maxTravelMinutes } = ctx.scrapeDefaults;
        const geoFilter = resolveGeoFilter({ maxTravelMinutes }, true);
        const zoneLabel =
          geoFilter.mode === "city"
            ? city
            : `${city} (${geoFilterLabel(geoFilter)})`;
        const [activity, recent] = await Promise.all([
          ctx.repository.getActivityStats(),
          ctx.repository.findRecent(5),
        ]);
        return c.json({
          activity,
          zoneLabel,
          cron: scrapeConfig.scrape.cron,
          scrapers: scrapeConfig.scrape.scrapers ?? [],
          recent: await serializeProperties(
            recent,
            ctx.reactionRepository,
            user.id,
            {
              includeCompatibility: false,
            }
          ),
        });
      }
      default:
        return c.json({ error: "Unknown stats section" }, 404);
    }
  });

  app.get("/api/properties/:id/address", async (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    const { property, warnings: enrichmentWarnings } =
      await ensurePropertyEnriched(ctx.repository, id, "address");

    if (!property) {
      return c.json({ error: "Listing not found" }, 404);
    }

    const readiness = getDpeAddressSearchReadiness(property);
    if (readiness === "unavailable") {
      return c.json({
        readiness,
        warnings: enrichmentWarnings,
        candidates: [],
      });
    }

    try {
      const {
        query,
        candidates,
        warnings: searchWarnings,
      } = await searchDpeForProperty(property);
      return c.json({
        readiness,
        query,
        warnings: [...enrichmentWarnings, ...searchWarnings],
        candidates: candidates.map(serializeDpeCandidate),
      });
    } catch (error) {
      log.error("DPE search error:", error);
      return c.json({ error: "Unable to reach the ADEME API" }, 503);
    }
  });

  app.post("/api/properties/:id/address/confirm", async (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    const body = await c.req.json<{ numeroDpe?: string }>();
    if (!body.numeroDpe?.trim()) {
      return c.json({ error: "numeroDpe is required" }, 400);
    }

    const property = await ctx.repository.findById(id);
    if (!property) {
      return c.json({ error: "Listing not found" }, 404);
    }

    const dpe = await fetchDpeByNumero(body.numeroDpe.trim());
    if (!dpe?.address) {
      return c.json({ error: "DPE record not found" }, 404);
    }

    await ctx.repository.updateAddress(id, dpe.address, body.numeroDpe.trim());
    return c.json({ address: dpe.address, dpeNumero: body.numeroDpe.trim() });
  });

  app.post("/api/admin/scrape", requireAdmin(), async (c) => {
    const result = await ctx.scraperService.run(ctx.scrapeDefaults);
    await ctx.notifyScrapeResults(result);

    const scrapeGeoFilter = resolveGeoFilter(
      { maxTravelMinutes: ctx.scrapeDefaults.maxTravelMinutes },
      true
    );
    const zoneLabel =
      scrapeGeoFilter.mode === "city"
        ? ""
        : ` (${geoFilterLabel(scrapeGeoFilter)})`;

    return c.json({
      summary: formatScrapeSummary(result, {
        city: ctx.scrapeDefaults.city,
        zoneLabel,
        totalProperties: await ctx.repository.count(),
        totalPublications: await ctx.repository.countPublications(),
      }),
      result,
    });
  });

  app.post("/api/admin/reconcile", requireAdmin(), async (c) => {
    const result = await reconcileProperties(
      getPrisma(scrapeConfig.database.url)
    );
    return c.json(result);
  });

  return app;
}
