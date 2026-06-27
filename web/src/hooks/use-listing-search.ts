import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, queryKeys } from "@/lib/api";
import { normalizeListingFilters } from "@/lib/listing-filters";
import type { ListingSearchFilters } from "@find-my-house/api-types";

export function useListingSearch(filters: ListingSearchFilters) {
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const [draft, setDraft] = useState(filters);
  const [draftSourceKey, setDraftSourceKey] = useState(filtersKey);

  if (draftSourceKey !== filtersKey) {
    setDraftSourceKey(filtersKey);
    setDraft(filters);
  }

  const searchFilters = useMemo(
    () => ({ ...filters, offset: undefined }),
    [filters]
  );
  const mapBoundsKey = useMemo(() => JSON.stringify(filters), [filters]);

  const listQuery = useInfiniteQuery({
    queryKey: queryKeys.listings(searchFilters),
    queryFn: ({ pageParam = 0 }) =>
      api.listings({
        ...searchFilters,
        offset: pageParam,
        limit: filters.limit ?? 20,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const items = listQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = listQuery.data?.pages[0]?.total ?? 0;

  const mapQuery = useQuery({
    queryKey: [...queryKeys.listings(searchFilters), "map"] as const,
    queryFn: () => api.listingsMap(searchFilters),
    enabled: view === "map" && listQuery.isSuccess,
  });

  const mapItems = mapQuery.data?.items ?? items;
  const mapZone = mapQuery.data?.zone ?? listQuery.data?.pages[0]?.zone;
  const selectedProperty = useMemo(
    () => mapItems.find((property) => property.id === selectedId) ?? null,
    [mapItems, selectedId]
  );
  const selectedIndex = selectedProperty
    ? mapItems.findIndex((property) => property.id === selectedProperty.id)
    : -1;

  const applyFilters = (nextDraft: ListingSearchFilters) => {
    const next = normalizeListingFilters(nextDraft);
    setDraft(next);
    setSelectedId(null);
    return next;
  };

  const selectView = (nextView: "list" | "map") => {
    setSelectedId(null);
    setView(nextView);
  };

  return {
    draft,
    setDraft,
    view,
    selectView,
    selectedId,
    setSelectedId,
    mapBoundsKey,
    listQuery,
    mapQuery,
    items,
    total,
    mapItems,
    mapZone,
    selectedProperty,
    selectedIndex,
    applyFilters,
  };
}
