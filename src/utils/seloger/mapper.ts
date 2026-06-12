import type { Listing } from "../../types/listing.js";
import { SELOGER_PORTAL } from "../classifiedPortal/config.js";
import { mapClassifiedCardToListing } from "../classifiedPortal/mapper.js";
import type { SeLogerClassifiedCard } from "./types.js";

export function mapSeLogerCardToListing(
  card: SeLogerClassifiedCard,
  scrapedAt: string,
  fallbackCity: string
): Listing {
  return mapClassifiedCardToListing(
    SELOGER_PORTAL,
    card,
    scrapedAt,
    fallbackCity
  );
}
