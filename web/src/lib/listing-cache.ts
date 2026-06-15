import type { QueryClient } from "@tanstack/react-query";
import type { BrowseState, Property } from "@/lib/types";
import { queryKeys } from "@/lib/api";

function findInPropertyLists(
  entries: [readonly unknown[], unknown][],
  propertyId: number
): Property | undefined {
  for (const [, data] of entries) {
    if (!data || typeof data !== "object") continue;

    if ("items" in data && Array.isArray(data.items)) {
      const found = (data.items as Property[]).find(
        (item) => item.id === propertyId
      );
      if (found) return found;
    }

    if ("pages" in data && Array.isArray(data.pages)) {
      for (const page of data.pages as { items: Property[] }[]) {
        const found = page.items.find((item) => item.id === propertyId);
        if (found) return found;
      }
    }
  }

  return undefined;
}

export function findCachedListing(
  queryClient: QueryClient,
  propertyId: number
): Property | undefined {
  const fromListings = findInPropertyLists(
    queryClient.getQueriesData({ queryKey: ["listings"] }),
    propertyId
  );
  if (fromListings) return fromListings;

  const fromReactions = findInPropertyLists(
    queryClient.getQueriesData({ queryKey: ["reactions"] }),
    propertyId
  );
  if (fromReactions) return fromReactions;

  const browse = queryClient.getQueryData<BrowseState>(queryKeys.browse);
  if (browse?.item?.id === propertyId) {
    return browse.item;
  }

  return undefined;
}
