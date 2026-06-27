import { createClassifiedPortalScraper } from "./classifiedPortalScraper.js";
import {
  applySeLogerSearchMetadata,
  buildSeLogerLocation,
  buildSeLogerSearchUrl,
  fetchSeLogerClassifieds,
  mapSeLogerCardToListing,
  resolveSeLogerPlace,
} from "../utils/seloger/index.js";

export const seLogerScraper = createClassifiedPortalScraper(
  "seloger",
  "SeLoger",
  {
    resolvePlace: resolveSeLogerPlace,
    buildLocation: buildSeLogerLocation,
    buildSearchUrl: buildSeLogerSearchUrl,
    fetchClassifieds: fetchSeLogerClassifieds,
    applySearchMetadata: applySeLogerSearchMetadata,
    mapCardToListing: mapSeLogerCardToListing,
  }
);
