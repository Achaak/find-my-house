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
  serializePropertyRow,
} from "./serialize.js";
import type { ApiContext } from "./types.js";
import { fetchStatsSection } from "../services/statsService.js";
import { scrapeConfig } from "../config/scrape.js";
import { notificationsConfig } from "../config/notifications.js";
import { getPrisma } from "../db/prisma.js";
import {
  resolveCompatibilityModel,
  resolveCompatibilityProfile,
} from "../services/compatibilityService.js";
import { reconcileProperties } from "../services/reconcileService.js";
import { scheduleEnrichmentBackfill } from "../services/enrichmentBackfill.js";
import {
  getEnrichmentStatus,
  propertyNeedsEnrichment,
} from "../services/enrichmentService.js";
import { formatScrapeSummary } from "../services/formatScrapeSummary.js";
import {
  advanceBrowseSession,
  clearBrowseSession,
  getBrowseSession,
  getBrowseState,
  noteBrowseReaction,
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
import { getBrowserReadiness } from "../utils/browser/client.js";
import { isScrapeInProgress } from "../services/scraperService.js";
import { scrapeFiltersToSearch } from "../utils/listing/scrapeFilters.js";
import { sendTestNotification } from "../homeAssistant/notifications.js";
import { isHomeAssistantAddOn } from "../homeAssistant/client.js";
import { PropertyMatchDiagnosticsRepository } from "../db/propertyMatchDiagnosticsRepository.js";
import { parseDiagnosticsQuery } from "@find-my-house/api-types";

const log = createLogger("api");

async function serializeBrowseResponse(
  ctx: ApiContext,
  userId: string,
  session: BrowseSession,
  state: InternalBrowseState,
  options?: { reactionType?: "like" | "dislike" }
) {
  const geoFilter = resolveGeoFilter(
    { maxTravelMinutes: session.filters.maxTravelMinutes },
    true
  );

  let property = state.property;
  if (property && propertyNeedsEnrichment(property, "display")) {
    await ctx.enrichmentQueue.waitUntilEnriched(property.id, "display", "high");
    property = (await ctx.repository.findById(property.id)) ?? property;
  }

  const reaction =
    property && options?.reactionType
      ? { type: options.reactionType, archivedAt: null }
      : property
        ? await ctx.reactionRepository.getReaction(property.id)
        : null;

  return {
    item: property
      ? serializePropertyRow(property, {
          model: state.model,
          reaction,
        })
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

  app.onError((error, c) => {
    log.error("Unhandled API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return c.json({ error: message }, 500);
  });

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.get("/api/health/ready", (c) => {
    const { browser, error } = getBrowserReadiness();
    const scrapeInProgress = isScrapeInProgress();
    const ready = browser === "ready";

    return c.json(
      {
        status: ready ? "ok" : "not_ready",
        browser,
        scrapeInProgress,
        ...(error ? { error } : {}),
      },
      ready ? 200 : 503
    );
  });

  app.get("/api/version", (c) => c.json(getBuildInfo()));

  app.use("/api/*", requireAuth());

  app.get("/api/me", (c) => c.json(getUser(c)));

  app.get("/api/compatibility/profile", async (c) => {
    const profile = await resolveCompatibilityProfile(ctx.reactionRepository);
    return c.json(profile);
  });

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

    const sort = filters.sort;
    const limit = filters.limit ?? 20;

    const { items: listings, total } = await ctx.repository.search({
      ...filters,
      sort: sort === "compat_desc" ? undefined : sort,
      limit: sort === "compat_desc" ? Math.max(limit, 50) : limit,
      offset: filters.offset,
    });

    const model = await resolveCompatibilityModel(ctx.reactionRepository);

    const rankedListings =
      sort === "compat_desc"
        ? sortByCompatibility(listings, model).slice(0, limit)
        : listings;

    const items = await serializeProperties(
      rankedListings,
      ctx.reactionRepository,
      { includeRanks: sort === "compat_desc" }
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

    let property = await ctx.repository.findById(id);
    if (!property) {
      return c.json({ error: "Listing not found" }, 404);
    }

    if (propertyNeedsEnrichment(property, "display")) {
      await ctx.enrichmentQueue.waitUntilEnriched(id, "display", "high");
      property = (await ctx.repository.findById(id)) ?? property;
    }

    return c.json({
      item: await serializeProperty(property, ctx.reactionRepository),
      enrichment: {
        status: getEnrichmentStatus(property, "display"),
      },
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

    await ctx.reactionRepository.add(propertyId, action);
    noteBrowseReaction(session, propertyId);

    const state = await advanceBrowseSession(
      ctx.repository,
      ctx.reactionRepository,
      user.id,
      session
    );

    return c.json(
      await serializeBrowseResponse(ctx, user.id, session, state, {
        reactionType: action,
      })
    );
  });

  app.get("/api/reactions/:type", async (c) => {
    const type = c.req.param("type");
    if (type !== "like" && type !== "dislike") {
      return c.json({ error: "Invalid reaction type" }, 400);
    }

    const limit = Math.min(
      Number.parseInt(c.req.query("limit") ?? "20", 10),
      100
    );
    const includeArchived = c.req.query("includeArchived") === "true";
    const archivedOnly = c.req.query("archivedOnly") === "true";
    const listings = await ctx.reactionRepository.findListingsByType(type, {
      limit,
      excludeArchived: !includeArchived && !archivedOnly,
      archivedOnly,
    });

    return c.json({
      items: await serializeProperties(listings, ctx.reactionRepository),
    });
  });

  app.post("/api/reactions/:type", async (c) => {
    const type = c.req.param("type");
    if (type !== "like" && type !== "dislike") {
      return c.json({ error: "Invalid reaction type" }, 400);
    }

    const body = await c.req.json<{ propertyId?: number }>();
    const propertyId = body.propertyId;
    if (!propertyId || !Number.isInteger(propertyId)) {
      return c.json({ error: "propertyId is required" }, 400);
    }

    const listing = await ctx.repository.findById(propertyId);
    if (!listing) {
      return c.json({ error: "Listing not found" }, 404);
    }

    const result = await ctx.reactionRepository.add(propertyId, type);
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

    const removed = await ctx.reactionRepository.remove(propertyId, type);
    return c.json({ removed });
  });

  app.post("/api/reactions/like/:propertyId/archive", async (c) => {
    const propertyId = Number.parseInt(c.req.param("propertyId"), 10);
    const result = await ctx.reactionRepository.archive(propertyId);
    return c.json({ status: result });
  });

  app.post("/api/reactions/like/:propertyId/unarchive", async (c) => {
    const propertyId = Number.parseInt(c.req.param("propertyId"), 10);
    const result = await ctx.reactionRepository.unarchive(propertyId);
    return c.json({ status: result });
  });

  app.get("/api/notifications/digest", async (c) => {
    getUser(c);
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
        {
          includeCompatibility: false,
        }
      ),
      priceDrops: await serializeProperties(
        priceDrops,
        ctx.reactionRepository,
        {
          includeCompatibility: false,
        }
      ),
      lastScrapedAt: activity.lastScrapedAt?.toISOString() ?? null,
    });
  });

  app.get("/api/notifications/preferences", async (c) => {
    const user = getUser(c);
    const enabled = await ctx.notificationPreferenceRepository.getEnabled(
      user.id
    );
    return c.json({ enabled });
  });

  app.put("/api/notifications/preferences", async (c) => {
    const user = getUser(c);
    const body = await c.req.json<{ enabled?: unknown }>().catch(() => null);
    if (!body || typeof body.enabled !== "boolean") {
      return c.json({ error: "enabled must be a boolean" }, 400);
    }

    const enabled = await ctx.notificationPreferenceRepository.setEnabled(
      user.id,
      body.enabled
    );
    return c.json({ enabled });
  });

  app.get("/api/stats/:section", async (c) => {
    const section = c.req.param("section");
    const validSections = [
      "overview",
      "sources",
      "prices",
      "mine",
      "activity",
    ] as const;

    if (!validSections.includes(section as (typeof validSections)[number])) {
      return c.json({ error: "Unknown stats section" }, 404);
    }

    if (section === "overview") {
      const overview = await fetchStatsSection("overview", {
        repository: ctx.repository,
        reactionRepository: ctx.reactionRepository,
        enrichmentQueue: ctx.enrichmentQueue,
        scrapeDefaults: ctx.scrapeDefaults,
      });
      return c.json({
        ...overview,
        recent: await serializeProperties(
          overview.recent,
          ctx.reactionRepository,
          { includeCompatibility: false }
        ),
      });
    }

    if (section === "prices") {
      const prices = await fetchStatsSection("prices", {
        repository: ctx.repository,
        reactionRepository: ctx.reactionRepository,
        enrichmentQueue: ctx.enrichmentQueue,
        scrapeDefaults: ctx.scrapeDefaults,
      });
      return c.json({
        ...prices,
        drops: await serializeProperties(prices.drops, ctx.reactionRepository, {
          includeCompatibility: false,
        }),
      });
    }

    if (section === "mine") {
      const mine = await fetchStatsSection("mine", {
        repository: ctx.repository,
        reactionRepository: ctx.reactionRepository,
        enrichmentQueue: ctx.enrichmentQueue,
        scrapeDefaults: ctx.scrapeDefaults,
      });
      return c.json({
        ...mine,
        recentLikes: await serializeProperties(
          mine.recentLikes,
          ctx.reactionRepository,
          { includeCompatibility: false }
        ),
        recentDislikes: await serializeProperties(
          mine.recentDislikes,
          ctx.reactionRepository,
          { includeCompatibility: false }
        ),
      });
    }

    if (section === "activity") {
      const activity = await fetchStatsSection("activity", {
        repository: ctx.repository,
        reactionRepository: ctx.reactionRepository,
        enrichmentQueue: ctx.enrichmentQueue,
        scrapeDefaults: ctx.scrapeDefaults,
      });
      return c.json({
        ...activity,
        recent: await serializeProperties(
          activity.recent,
          ctx.reactionRepository,
          { includeCompatibility: false }
        ),
      });
    }

    return c.json(
      await fetchStatsSection(section as (typeof validSections)[number], {
        repository: ctx.repository,
        reactionRepository: ctx.reactionRepository,
        enrichmentQueue: ctx.enrichmentQueue,
        scrapeDefaults: ctx.scrapeDefaults,
      })
    );
  });

  app.get("/api/properties/:id/address", async (c) => {
    const id = Number.parseInt(c.req.param("id"), 10);
    let property = await ctx.repository.findById(id);

    if (!property) {
      return c.json({ error: "Listing not found" }, 404);
    }

    if (propertyNeedsEnrichment(property, "address")) {
      await ctx.enrichmentQueue.waitUntilEnriched(id, "address", "high");
      property = (await ctx.repository.findById(id)) ?? property;
    }

    const enrichmentStatus = getEnrichmentStatus(property, "address");
    const readiness = getDpeAddressSearchReadiness(property);
    if (readiness === "unavailable") {
      return c.json({
        readiness,
        enrichment: { status: enrichmentStatus },
        warnings: [],
        candidates: [],
      });
    }

    if (enrichmentStatus === "pending") {
      return c.json({
        readiness,
        enrichment: { status: enrichmentStatus },
        warnings: [],
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
        enrichment: { status: enrichmentStatus },
        query,
        warnings: searchWarnings,
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

    const updated = await ctx.repository.updateAddress(
      id,
      dpe.address,
      body.numeroDpe.trim()
    );
    if (!updated.ok) {
      return c.json({ error: updated.error }, 500);
    }

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

  app.post("/api/admin/enrich", requireAdmin(), async (c) => {
    const { enrichment } = scrapeConfig;
    const queued = await scheduleEnrichmentBackfill(
      ctx.repository,
      ctx.reactionRepository,
      ctx.enrichmentQueue,
      {
        minScore: enrichment.minCompatScore,
        limit: enrichment.batchLimit,
        searchLimit: enrichment.searchLimit,
      }
    );
    return c.json({ queued });
  });

  app.post("/api/admin/notifications/test", requireAdmin(), async (c) => {
    const { notifications } = notificationsConfig;
    const bearer = isHomeAssistantAddOn()
      ? undefined
      : c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    const result = await sendTestNotification(notifications.notifyService, {
      token: bearer ?? undefined,
    });

    if (!result.ok) {
      return c.json({ error: result.error }, 502);
    }

    return c.json({
      sent: true,
      notifyService: notifications.notifyService,
    });
  });

  app.get(
    "/api/admin/property-match-diagnostics",
    requireAdmin(),
    async (c) => {
      const parsed = parseDiagnosticsQuery({
        limit: c.req.query("limit"),
        source: c.req.query("source"),
        postalCode: c.req.query("postalCode"),
        bestVeto: c.req.query("bestVeto"),
        from: c.req.query("from"),
        to: c.req.query("to"),
        beforeId: c.req.query("beforeId"),
      });
      if (parsed.error) return c.json({ error: parsed.error }, 400);
      const query = parsed.value ?? {};
      const diagnosticsRepository = new PropertyMatchDiagnosticsRepository(
        getPrisma(scrapeConfig.database.url)
      );
      const page = await diagnosticsRepository.findRecent(query.limit ?? 50, {
        source: query.source,
        postalCode: query.postalCode,
        bestVeto: query.bestVeto,
        beforeId: query.beforeId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      });
      return c.json(page);
    }
  );

  return app;
}
