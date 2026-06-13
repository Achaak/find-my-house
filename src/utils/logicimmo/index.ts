import {
  LOGIC_IMMO_PORTAL,
  ClassifiedPortalAccessBlockedError,
  createClassifiedPortalFacade,
} from "../classifiedPortal/index.js";

const facade = createClassifiedPortalFacade(LOGIC_IMMO_PORTAL);

export const BASE_URL = facade.BASE_URL;
export const IMAGE_BASE_URL = facade.IMAGE_BASE_URL;
export const LOGIC_IMMO_PAGE_SIZE = facade.PAGE_SIZE;

export class LogicImmoAccessBlockedError extends ClassifiedPortalAccessBlockedError {
  constructor(statusCode = 403) {
    super(LOGIC_IMMO_PORTAL, statusCode);
    this.name = "LogicImmoAccessBlockedError";
  }
}

export const { SEARCH_PAGE_DELAY_MS, DETAIL_FETCH_DELAY_MS } = facade;

export const fetchLogicImmoClassifieds = facade.fetchClassifieds;
export const fetchLogicImmoListingDetails = facade.fetchListingDetails;
export const parseLogicImmoPrice = facade.parsePrice;
export const parseLogicImmoBedrooms = facade.parseBedrooms;
export const parseLogicImmoRooms = facade.parseRooms;
export const buildLogicImmoListingUrl = facade.buildListingUrl;
export const buildLogicImmoImageUrl = facade.buildImageUrl;
export const resolveLogicImmoPlace = facade.resolvePlace;
export const resolveLogicImmoStrtPlaceId = facade.resolveStrtPlaceId;
export const buildLogicImmoTravelLocation = facade.buildTravelLocation;
export const buildLogicImmoRadiusLocation = facade.buildRadiusLocation;
export const buildLogicImmoLocation = facade.buildLocation;
export const buildLogicImmoSearchUrl = facade.buildSearchUrl;
export const mapLogicImmoCardToListing = facade.mapCardToListing;
export const applyLogicImmoSearchMetadata = facade.applySearchMetadata;
export const parseLogicImmoSearchHtml = facade.parseSearchHtml;
export const parseLogicImmoDetailEnergy = facade.parseDetailEnergy;
export const parseLogicImmoDetailPage = facade.parseDetailPage;
export const extractLogicImmoCoordsFromClassifiedData =
  facade.extractCoordsFromClassifiedData;
export const parseLogicImmoCoordinatesFromHtml =
  facade.parseCoordinatesFromHtml;
export const describeLogicImmoSearchHtmlFailure =
  facade.describeSearchHtmlFailure;

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
