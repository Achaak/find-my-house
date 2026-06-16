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

/** @deprecated Use seLogerScraper — kept for tests importing the class. */
export class SeLogerScraper {
  readonly name = seLogerScraper.name;
  readonly supportsTravelTime = seLogerScraper.supportsTravelTime;
  scrape = seLogerScraper.scrape.bind(seLogerScraper);
}
