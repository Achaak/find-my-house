import type { Listing } from "../../types/listing.js";
import type { PortalListingCriteria } from "../../types/listing.js";
import { resolveGeoFilter } from "../geo/geoFilter.js";
import {
  DETAIL_FETCH_DELAY_MS,
  SEARCH_PAGE_DELAY_MS,
  fetchClassifiedCards,
  fetchClassifiedListingDetails,
} from "./client.js";
import { ClassifiedPortalAccessBlockedError } from "./errors.js";
import { mapClassifiedCardToListing } from "./mapper.js";
import { applyClassifiedSearchMetadata } from "./parsers/searchMetadata.js";
import {
  buildClassifiedLocation,
  buildClassifiedSearchUrl,
  resolveClassifiedPlace,
} from "./place.js";
import type { ClassifiedPortalConfig } from "./types.js";

export function createClassifiedPortal(portal: ClassifiedPortalConfig) {
  return {
    portal,
    SEARCH_PAGE_DELAY_MS,
    DETAIL_FETCH_DELAY_MS,
    AccessBlockedError: ClassifiedPortalAccessBlockedError,
    resolvePlace: resolveClassifiedPlace,
    buildLocation: (
      city: string,
      place: NonNullable<Awaited<ReturnType<typeof resolveClassifiedPlace>>>,
      geoFilter: ReturnType<typeof resolveGeoFilter>
    ) => buildClassifiedLocation(portal, city, place, geoFilter),
    buildSearchUrl: (
      criteria: PortalListingCriteria,
      location: string,
      page?: number
    ) => buildClassifiedSearchUrl(portal, criteria, location, page),
    fetchClassifieds: (searchUrl: string, maxPages?: number) =>
      fetchClassifiedCards(portal, searchUrl, maxPages),
    fetchListingDetails: (url: string) =>
      fetchClassifiedListingDetails(portal, url),
    applySearchMetadata: applyClassifiedSearchMetadata,
    mapCardToListing: (
      card: Parameters<typeof mapClassifiedCardToListing>[1],
      scrapedAt: string,
      fallbackCity: string
    ): Listing =>
      mapClassifiedCardToListing(portal, card, scrapedAt, fallbackCity),
  };
}

export type ClassifiedPortal = ReturnType<typeof createClassifiedPortal>;
