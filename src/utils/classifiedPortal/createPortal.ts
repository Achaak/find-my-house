import type { Listing } from "../../types/listing.js";
import type { PortalListingCriteria } from "../../types/listing.js";
import { resolveGeoFilter } from "../geo/geoFilter.js";
import {
  DETAIL_FETCH_DELAY_MS,
  SEARCH_PAGE_DELAY_MS,
  fetchClassifiedCards,
  fetchClassifiedListingDetails,
} from "./client.js";
import { describeClassifiedSearchHtmlFailure } from "./parsers/htmlDiagnostics.js";
import {
  extractClassifiedCoordsFromData,
  parseClassifiedCoordinatesFromHtml,
} from "./parsers/coordinates.js";
import { parseClassifiedDetailEnergy } from "./parsers/detailEnergy.js";
import { parseClassifiedDetailPage } from "./parsers/detailPage.js";
import { parseClassifiedSearchHtml } from "./parsers/searchHtml.js";
import { applyClassifiedSearchMetadata } from "./parsers/searchMetadata.js";
import {
  buildClassifiedImageUrl,
  buildClassifiedListingUrl,
  parseClassifiedBedrooms,
  parseClassifiedPrice,
  parseClassifiedRooms,
} from "./helpers.js";
import { mapClassifiedCardToListing } from "./mapper.js";
import {
  buildClassifiedLocation,
  buildClassifiedRadiusLocation,
  buildClassifiedSearchUrl,
  buildClassifiedTravelLocation,
  resolveClassifiedPlace,
  resolveClassifiedStrtPlaceId,
} from "./place.js";
import {
  CLASSIFIED_PAGE_SIZE,
  type ClassifiedPlace,
  type ClassifiedPortalConfig,
} from "./types.js";

export function createClassifiedPortalFacade(portal: ClassifiedPortalConfig) {
  return {
    portal,
    BASE_URL: portal.baseUrl,
    IMAGE_BASE_URL: portal.imageBaseUrl,
    PAGE_SIZE: CLASSIFIED_PAGE_SIZE,
    SEARCH_PAGE_DELAY_MS,
    DETAIL_FETCH_DELAY_MS,
    fetchClassifieds: (
      searchUrl: string,
      maxPages?: number,
      place?: ClassifiedPlace,
      postalCode?: string
    ) =>
      fetchClassifiedCards(portal, searchUrl, maxPages, {
        place,
        postalCode,
      }),
    fetchListingDetails: (url: string) =>
      fetchClassifiedListingDetails(portal, url),
    parsePrice: parseClassifiedPrice,
    parseBedrooms: parseClassifiedBedrooms,
    parseRooms: parseClassifiedRooms,
    buildListingUrl: (card: Parameters<typeof buildClassifiedListingUrl>[1]) =>
      buildClassifiedListingUrl(portal, card),
    buildImageUrl: (photoPath?: string) =>
      buildClassifiedImageUrl(portal, photoPath),
    resolvePlace: resolveClassifiedPlace,
    resolveStrtPlaceId: (
      center: Parameters<typeof resolveClassifiedStrtPlaceId>[1]
    ) => resolveClassifiedStrtPlaceId(portal, center),
    buildTravelLocation: buildClassifiedTravelLocation,
    buildRadiusLocation: buildClassifiedRadiusLocation,
    buildLocation: (
      city: string,
      place: NonNullable<Awaited<ReturnType<typeof resolveClassifiedPlace>>>,
      geoFilter: ReturnType<typeof resolveGeoFilter>,
      postalCode?: string
    ) => buildClassifiedLocation(portal, city, place, geoFilter, postalCode),
    buildSearchUrl: (
      criteria: PortalListingCriteria,
      location: string,
      page?: number
    ) => buildClassifiedSearchUrl(portal, criteria, location, page),
    mapCardToListing: (
      card: Parameters<typeof mapClassifiedCardToListing>[1],
      scrapedAt: string,
      fallbackCity: string
    ): Listing =>
      mapClassifiedCardToListing(portal, card, scrapedAt, fallbackCity),
    applySearchMetadata: applyClassifiedSearchMetadata,
    parseSearchHtml: (html: string) => parseClassifiedSearchHtml(portal, html),
    parseDetailEnergy: parseClassifiedDetailEnergy,
    parseDetailPage: parseClassifiedDetailPage,
    extractCoordsFromClassifiedData: extractClassifiedCoordsFromData,
    parseCoordinatesFromHtml: parseClassifiedCoordinatesFromHtml,
    describeSearchHtmlFailure: (html: string) =>
      describeClassifiedSearchHtmlFailure(portal, html),
  };
}

export type ClassifiedPortalFacade = ReturnType<
  typeof createClassifiedPortalFacade
>;
