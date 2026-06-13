import {
  SELOGER_PORTAL,
  ClassifiedPortalAccessBlockedError,
  createClassifiedPortalFacade,
} from "../classifiedPortal/index.js";

const facade = createClassifiedPortalFacade(SELOGER_PORTAL);

export const BASE_URL = facade.BASE_URL;
export const IMAGE_BASE_URL = facade.IMAGE_BASE_URL;
export const SELOGER_PAGE_SIZE = facade.PAGE_SIZE;

export class SeLogerAccessBlockedError extends ClassifiedPortalAccessBlockedError {
  constructor(statusCode = 403) {
    super(SELOGER_PORTAL, statusCode);
    this.name = "SeLogerAccessBlockedError";
  }
}

export const { SEARCH_PAGE_DELAY_MS, DETAIL_FETCH_DELAY_MS } = facade;

export const fetchSeLogerClassifieds = facade.fetchClassifieds;
export const fetchSeLogerListingDetails = facade.fetchListingDetails;
export const parseSeLogerPrice = facade.parsePrice;
export const parseSeLogerBedrooms = facade.parseBedrooms;
export const parseSeLogerRooms = facade.parseRooms;
export const buildSeLogerListingUrl = facade.buildListingUrl;
export const buildSeLogerImageUrl = facade.buildImageUrl;
export const resolveSeLogerPlace = facade.resolvePlace;
export const resolveSeLogerStrtPlaceId = facade.resolveStrtPlaceId;
export const buildSeLogerTravelLocation = facade.buildTravelLocation;
export const buildSeLogerRadiusLocation = facade.buildRadiusLocation;
export const buildSeLogerLocation = facade.buildLocation;
export const buildSeLogerSearchUrl = facade.buildSearchUrl;
export const mapSeLogerCardToListing = facade.mapCardToListing;
export const applySeLogerSearchMetadata = facade.applySearchMetadata;
export const parseSeLogerSearchHtml = facade.parseSearchHtml;
export const parseSeLogerDetailEnergy = facade.parseDetailEnergy;
export const parseSeLogerDetailPage = facade.parseDetailPage;
export const extractSeLogerCoordsFromClassifiedData =
  facade.extractCoordsFromClassifiedData;
export const parseSeLogerCoordinatesFromHtml = facade.parseCoordinatesFromHtml;
export const describeSeLogerSearchHtmlFailure =
  facade.describeSearchHtmlFailure;

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
