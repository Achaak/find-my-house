import {
  ClassifiedPortalAccessBlockedError,
  LOGIC_IMMO_PORTAL,
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

export class LogicImmoAccessBlockedError extends ClassifiedPortalAccessBlockedError {
  constructor(statusCode = 403) {
    super(LOGIC_IMMO_PORTAL, statusCode);
    this.name = "LogicImmoAccessBlockedError";
  }
}

export { SEARCH_PAGE_DELAY_MS, DETAIL_FETCH_DELAY_MS };

export const fetchLogicImmoClassifieds = (
  searchUrl: string,
  maxPages?: number
) => fetchClassifiedCards(LOGIC_IMMO_PORTAL, searchUrl, maxPages);

export const fetchLogicImmoListingDetails = (url: string) =>
  fetchClassifiedListingDetails(LOGIC_IMMO_PORTAL, url);

export const parseLogicImmoPrice = parseClassifiedPrice;
export const parseLogicImmoBedrooms = parseClassifiedBedrooms;
export const parseLogicImmoRooms = parseClassifiedRooms;
export const buildLogicImmoListingUrl = (
  card: Parameters<typeof buildClassifiedListingUrl>[1]
) => buildClassifiedListingUrl(LOGIC_IMMO_PORTAL, card);
export const buildLogicImmoImageUrl = (photoPath?: string) =>
  buildClassifiedImageUrl(LOGIC_IMMO_PORTAL, photoPath);

export const resolveLogicImmoPlace = resolveClassifiedPlace;
export const resolveLogicImmoStrtPlaceId = (
  center: Parameters<typeof resolveClassifiedStrtPlaceId>[1]
) => resolveClassifiedStrtPlaceId(LOGIC_IMMO_PORTAL, center);
export const buildLogicImmoTravelLocation = buildClassifiedTravelLocation;
export const buildLogicImmoRadiusLocation = buildClassifiedRadiusLocation;
export const buildLogicImmoLocation = (
  city: string,
  place: NonNullable<Awaited<ReturnType<typeof resolveClassifiedPlace>>>,
  geoFilter: Parameters<typeof buildClassifiedLocation>[3]
) => buildClassifiedLocation(LOGIC_IMMO_PORTAL, city, place, geoFilter);
export const buildLogicImmoSearchUrl = (
  criteria: Parameters<typeof buildClassifiedSearchUrl>[1],
  location: string,
  page?: number
) => buildClassifiedSearchUrl(LOGIC_IMMO_PORTAL, criteria, location, page);

export const mapLogicImmoCardToListing = (
  card: Parameters<typeof mapClassifiedCardToListing>[1],
  scrapedAt: string,
  fallbackCity: string
) =>
  mapClassifiedCardToListing(LOGIC_IMMO_PORTAL, card, scrapedAt, fallbackCity);

export const applyLogicImmoSearchMetadata = applyClassifiedSearchMetadata;
export const parseLogicImmoSearchHtml = (html: string) =>
  parseClassifiedSearchHtml(LOGIC_IMMO_PORTAL, html);
export const parseLogicImmoDetailEnergy = parseClassifiedDetailEnergy;
export const parseLogicImmoDetailPage = parseClassifiedDetailPage;
export const extractLogicImmoCoordsFromClassifiedData =
  extractClassifiedCoordsFromData;
export const parseLogicImmoCoordinatesFromHtml =
  parseClassifiedCoordinatesFromHtml;

export const describeLogicImmoSearchHtmlFailure = (html: string) =>
  describeClassifiedSearchHtmlFailure(LOGIC_IMMO_PORTAL, html);

export type {
  ClassifiedPlace as LogicImmoPlace,
  ClassifiedPricing as LogicImmoPricing,
  ClassifiedCard as LogicImmoClassifiedCard,
  ClassifiedSearchResponse as LogicImmoSearchResponse,
  ClassifiedData as LogicImmoClassifiedData,
  ClassifiedUfrnPageProps as LogicImmoUfrnPageProps,
  ClassifiedEnergyDetails as LogicImmoEnergyDetails,
  ClassifiedListingDetails as LogicImmoListingDetails,
} from "../classifiedPortal/index.js";

export { BASE_URL, IMAGE_BASE_URL, LOGIC_IMMO_PAGE_SIZE } from "./types.js";
