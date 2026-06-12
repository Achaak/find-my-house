import {
  SELOGER_PORTAL,
  ClassifiedPortalAccessBlockedError,
  applyClassifiedSearchMetadata,
  buildClassifiedImageUrl,
  buildClassifiedListingUrl,
  buildClassifiedLocation,
  buildClassifiedRadiusLocation,
  buildClassifiedSearchUrl,
  buildClassifiedTravelLocation,
  extractClassifiedCoordsFromData,
  fetchClassifiedCards,
  fetchClassifiedListingDetails,
  mapClassifiedCardToListing,
  parseClassifiedBedrooms,
  parseClassifiedRooms,
  parseClassifiedCoordinatesFromHtml,
  parseClassifiedDetailEnergy,
  parseClassifiedDetailPage,
  parseClassifiedPrice,
  parseClassifiedSearchHtml,
  resolveClassifiedPlace,
  resolveClassifiedStrtPlaceId,
  DETAIL_FETCH_DELAY_MS,
  SEARCH_PAGE_DELAY_MS,
} from "../classifiedPortal/index.js";
import { describeClassifiedSearchHtmlFailure } from "../classifiedPortal/parsers/htmlDiagnostics.js";

export class SeLogerAccessBlockedError extends ClassifiedPortalAccessBlockedError {
  constructor(statusCode = 403) {
    super(SELOGER_PORTAL, statusCode);
    this.name = "SeLogerAccessBlockedError";
  }
}

export { SEARCH_PAGE_DELAY_MS, DETAIL_FETCH_DELAY_MS };

export const fetchSeLogerClassifieds = (searchUrl: string, maxPages?: number) =>
  fetchClassifiedCards(SELOGER_PORTAL, searchUrl, maxPages);

export const fetchSeLogerListingDetails = (url: string) =>
  fetchClassifiedListingDetails(SELOGER_PORTAL, url);

export const parseSeLogerPrice = parseClassifiedPrice;
export const parseSeLogerBedrooms = parseClassifiedBedrooms;
export const parseSeLogerRooms = parseClassifiedRooms;
export const buildSeLogerListingUrl = (
  card: Parameters<typeof buildClassifiedListingUrl>[1]
) => buildClassifiedListingUrl(SELOGER_PORTAL, card);
export const buildSeLogerImageUrl = (photoPath?: string) =>
  buildClassifiedImageUrl(SELOGER_PORTAL, photoPath);

export const resolveSeLogerPlace = resolveClassifiedPlace;
export const resolveSeLogerStrtPlaceId = (
  center: Parameters<typeof resolveClassifiedStrtPlaceId>[1]
) => resolveClassifiedStrtPlaceId(SELOGER_PORTAL, center);
export const buildSeLogerTravelLocation = buildClassifiedTravelLocation;
export const buildSeLogerRadiusLocation = buildClassifiedRadiusLocation;
export const buildSeLogerLocation = (
  city: string,
  place: NonNullable<Awaited<ReturnType<typeof resolveClassifiedPlace>>>,
  geoFilter: Parameters<typeof buildClassifiedLocation>[3]
) => buildClassifiedLocation(SELOGER_PORTAL, city, place, geoFilter);
export const buildSeLogerSearchUrl = (
  criteria: Parameters<typeof buildClassifiedSearchUrl>[1],
  location: string,
  page?: number
) => buildClassifiedSearchUrl(SELOGER_PORTAL, criteria, location, page);

export const mapSeLogerCardToListing = (
  card: Parameters<typeof mapClassifiedCardToListing>[1],
  scrapedAt: string,
  fallbackCity: string
) => mapClassifiedCardToListing(SELOGER_PORTAL, card, scrapedAt, fallbackCity);

export const applySeLogerSearchMetadata = applyClassifiedSearchMetadata;
export const parseSeLogerSearchHtml = (html: string) =>
  parseClassifiedSearchHtml(SELOGER_PORTAL, html);
export const parseSeLogerDetailEnergy = parseClassifiedDetailEnergy;
export const parseSeLogerDetailPage = parseClassifiedDetailPage;
export const extractSeLogerCoordsFromClassifiedData =
  extractClassifiedCoordsFromData;
export const parseSeLogerCoordinatesFromHtml =
  parseClassifiedCoordinatesFromHtml;

export const describeSeLogerSearchHtmlFailure = (html: string) =>
  describeClassifiedSearchHtmlFailure(SELOGER_PORTAL, html);

export type {
  ClassifiedPlace as SeLogerPlace,
  ClassifiedPricing as SeLogerPricing,
  ClassifiedCard as SeLogerClassifiedCard,
  ClassifiedSearchResponse as SeLogerSearchResponse,
  ClassifiedData as SeLogerClassifiedData,
  ClassifiedUfrnPageProps as SeLogerUfrnPageProps,
  ClassifiedEnergyDetails as SeLogerEnergyDetails,
  ClassifiedListingDetails as SeLogerListingDetails,
} from "../classifiedPortal/index.js";

export { BASE_URL, IMAGE_BASE_URL, SELOGER_PAGE_SIZE } from "./types.js";
