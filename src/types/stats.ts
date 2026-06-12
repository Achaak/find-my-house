import type { ListingSource } from "./listing.js";

export type SourcePublicationCounts = Record<
  ListingSource,
  { active: number; inactive: number }
>;

export type PriceStats = {
  count: number;
  min: number;
  max: number;
  median: number;
  average: number;
};

export type CityCount = {
  city: string;
  count: number;
};

export type ActivityStats = {
  lastScrapedAt: Date | null;
  addedLast7Days: number;
  deactivatedLast7Days: number;
  multiSourceCount: number;
};
