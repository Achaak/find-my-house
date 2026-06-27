import { createClassifiedPortalScraper } from "./classifiedPortalScraper.js";
import {
  applyLogicImmoSearchMetadata,
  buildLogicImmoLocation,
  buildLogicImmoSearchUrl,
  fetchLogicImmoClassifieds,
  mapLogicImmoCardToListing,
  resolveLogicImmoPlace,
} from "../utils/logicimmo/index.js";

export const logicImmoScraper = createClassifiedPortalScraper(
  "logicimmo",
  "Logic-Immo",
  {
    resolvePlace: resolveLogicImmoPlace,
    buildLocation: buildLogicImmoLocation,
    buildSearchUrl: buildLogicImmoSearchUrl,
    fetchClassifieds: fetchLogicImmoClassifieds,
    applySearchMetadata: applyLogicImmoSearchMetadata,
    mapCardToListing: mapLogicImmoCardToListing,
  }
);
