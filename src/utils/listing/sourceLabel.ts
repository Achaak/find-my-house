import type { ListingSource } from "../../types/listing.js";

const SOURCE_LABELS: Record<ListingSource, string> = {
  bienici: "Bien'ici",
  leboncoin: "Leboncoin",
  seloger: "SeLoger",
  logicimmo: "Logic-Immo",
};

export function formatSourceLabel(source: ListingSource): string {
  return SOURCE_LABELS[source];
}
