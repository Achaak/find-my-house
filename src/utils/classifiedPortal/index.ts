export { SELOGER_PORTAL, LOGIC_IMMO_PORTAL } from "./config.js";
export { ClassifiedPortalAccessBlockedError } from "./errors.js";
export {
  createClassifiedPortal,
  type ClassifiedPortal,
} from "./createPortal.js";
export {
  SEARCH_PAGE_DELAY_MS,
  DETAIL_FETCH_DELAY_MS,
  fetchClassifiedCards,
  fetchClassifiedListingDetails,
} from "./client.js";
export {
  parseClassifiedPrice,
  parseClassifiedBedrooms,
  parseClassifiedRooms,
  buildClassifiedListingUrl,
  buildClassifiedImageUrl,
} from "./helpers.js";
export {
  resolveClassifiedPlace,
  resolveClassifiedStrtPlaceId,
  buildClassifiedTravelLocation,
  buildClassifiedRadiusLocation,
  resolveClassifiedLocation,
  buildClassifiedLocation,
  buildClassifiedSearchUrl,
} from "./place.js";
export { mapClassifiedCardToListing } from "./mapper.js";
export { applyClassifiedSearchMetadata } from "./parsers/searchMetadata.js";
export { parseClassifiedSearchHtml } from "./parsers/searchHtml.js";
export { parseClassifiedDetailEnergy } from "./parsers/detailEnergy.js";
export { parseClassifiedDetailPage } from "./parsers/detailPage.js";
export {
  extractClassifiedCoordsFromData,
  parseClassifiedCoordinatesFromHtml,
} from "./parsers/coordinates.js";
export { describeClassifiedSearchHtmlFailure } from "./parsers/htmlDiagnostics.js";

export type {
  ClassifiedPortalId,
  ClassifiedPortalConfig,
  ClassifiedPlace,
  ClassifiedPricing,
  ClassifiedCard,
  ClassifiedSearchResponse,
  ClassifiedData,
  ClassifiedUfrnPageProps,
  ClassifiedEnergyDetails,
  ClassifiedListingDetails,
} from "./types.js";
export { CLASSIFIED_PAGE_SIZE } from "./types.js";
