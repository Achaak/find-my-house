import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./api";
import { invalidateReactionSideEffects } from "./property-invalidation";
import type { BrowseState, Property } from "@find-my-house/api-types";

function makeProperty(id: number): Property {
  return {
    id,
    title: `Property ${String(id)}`,
    price: 100_000,
    firstPrice: 100_000,
    surface: 90,
    landSurface: null,
    rooms: 4,
    bedrooms: 2,
    isNewProperty: false,
    latitude: null,
    longitude: null,
    city: "Paris",
    postalCode: "75001",
    address: null,
    dpeNumero: null,
    description: null,
    imageUrl: null,
    photos: [],
    propertyType: "house",
    dpeClass: null,
    gesClass: null,
    dpeConsumptionKwhM2: null,
    gesEmissionKgM2: null,
    bathrooms: null,
    constructionYear: null,
    heating: null,
    orientation: null,
    propertyCondition: null,
    parkingSpaces: null,
    highlights: null,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    publications: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reaction: null,
    archived: false,
  };
}

function makeBrowseState(id: number, shownCount: number): BrowseState {
  return {
    item: makeProperty(id),
    shownCount,
    isExplore: false,
    hasPreferences: false,
    finished: false,
    criteria: { city: "Paris" },
  };
}

describe("browse reaction cache updates", () => {
  it("documents that a late browse refetch overwrites a newer mutation result", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    let releaseFirstRefetch!: (state: BrowseState) => void;
    const firstRefetch = new Promise<BrowseState>((resolve) => {
      releaseFirstRefetch = resolve;
    });

    const inFlight = queryClient.fetchQuery({
      queryKey: queryKeys.browse,
      queryFn: () => firstRefetch,
    });

    queryClient.setQueryData(queryKeys.browse, makeBrowseState(3, 3));
    expect(
      queryClient.getQueryData<BrowseState>(queryKeys.browse)?.item?.id
    ).toBe(3);

    releaseFirstRefetch(makeBrowseState(2, 2));
    await inFlight;

    // React Query writes the late response into the cache — this is why browse
    // mutations must setQueryData without invalidating/refetching browse.
    expect(
      queryClient.getQueryData<BrowseState>(queryKeys.browse)?.item?.id
    ).toBe(2);
  });

  it("invalidateReactionSideEffects does not refetch browse session state", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    let fetches = 0;
    await queryClient.fetchQuery({
      queryKey: queryKeys.browse,
      queryFn: async () => {
        fetches += 1;
        return makeBrowseState(fetches, fetches);
      },
    });
    expect(fetches).toBe(1);

    queryClient.setQueryData(queryKeys.browse, makeBrowseState(99, 99));
    invalidateReactionSideEffects(queryClient);
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetches).toBe(1);
    expect(
      queryClient.getQueryData<BrowseState>(queryKeys.browse)?.item?.id
    ).toBe(99);
  });
});
