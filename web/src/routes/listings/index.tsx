import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { cloneElement, useId, useMemo, useState } from "react";
import { ListingsMap } from "@/components/listings/listings-map";
import { PropertyCard } from "@/components/listings/property-card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import {
  normalizeListingFilters,
  searchParamsToFilters,
} from "@/lib/listing-filters";
import type {
  ListingSearchSort,
  ListingSource,
} from "@find-my-house/api-types";
import { parseOptionalNumber } from "@/lib/utils";

export const Route = createFileRoute("/listings/")({
  validateSearch: (search) => searchParamsToFilters(search),
  component: ListingsPage,
});

function ListingsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const filters = Route.useSearch();
  const [draft, setDraft] = useState(() => filters);
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const searchFilters = { ...filters, offset: undefined };
  const mapBoundsKey = useMemo(() => JSON.stringify(filters), [filters]);

  const query = useInfiniteQuery({
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

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  const mapQuery = useQuery({
    queryKey: [...queryKeys.listings(searchFilters), "all"] as const,
    queryFn: () => api.listingsAll(searchFilters),
    enabled: view === "map" && query.isSuccess,
  });

  const mapItems = mapQuery.data?.items ?? items;
  const mapZone = mapQuery.data?.zone ?? query.data?.pages[0]?.zone;
  const selectedProperty = useMemo(
    () => mapItems.find((property) => property.id === selectedId) ?? null,
    [mapItems, selectedId]
  );
  const selectedIndex = selectedProperty
    ? mapItems.findIndex((property) => property.id === selectedProperty.id)
    : -1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Listings</h1>
          <p className="text-sm text-muted-foreground">
            Search saved listings with filters for city, price, surface, source,
            and more.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "default" : "outline"}
            onClick={() => {
              setSelectedId(null);
              setView("list");
            }}
          >
            List
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "map" ? "default" : "outline"}
            onClick={() => {
              setSelectedId(null);
              setView("map");
            }}
          >
            Map
          </Button>
        </div>
      </div>

      <form
        className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = normalizeListingFilters(draft);
          setDraft(next);
          setSelectedId(null);
          void navigate({ search: next });
        }}
      >
        <FilterField label="City">
          <Input
            value={draft.city ?? ""}
            onChange={(event) =>
              setDraft((current) => ({ ...current, city: event.target.value }))
            }
          />
        </FilterField>
        <FilterField label="Postal code">
          <Input
            value={draft.postalCode ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                postalCode: event.target.value,
              }))
            }
          />
        </FilterField>
        <FilterField label="Text">
          <Input
            value={draft.text ?? ""}
            onChange={(event) =>
              setDraft((current) => ({ ...current, text: event.target.value }))
            }
          />
        </FilterField>
        <FilterField label="Source">
          <Select
            value={draft.source ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                source: (event.target.value || undefined) as
                  | ListingSource
                  | undefined,
              }))
            }
          >
            <option value="">All</option>
            <option value="bienici">Bien&apos;ici</option>
            <option value="leboncoin">Leboncoin</option>
            <option value="seloger">SeLoger</option>
            <option value="logicimmo">Logic-Immo</option>
          </Select>
        </FilterField>
        <FilterField label="Min price">
          <Input
            type="number"
            value={draft.minPrice ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                minPrice: parseOptionalNumber(event.target.value),
              }))
            }
          />
        </FilterField>
        <FilterField label="Max price">
          <Input
            type="number"
            value={draft.maxPrice ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                maxPrice: parseOptionalNumber(event.target.value),
              }))
            }
          />
        </FilterField>
        <FilterField label="Min surface">
          <Input
            type="number"
            value={draft.minSurface ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                minSurface: parseOptionalNumber(event.target.value),
              }))
            }
          />
        </FilterField>
        <FilterField label="Min land surface">
          <Input
            type="number"
            value={draft.minLandSurface ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                minLandSurface: parseOptionalNumber(event.target.value),
              }))
            }
          />
        </FilterField>
        <FilterField label="Min rooms">
          <Input
            type="number"
            value={draft.minRooms ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                minRooms: parseOptionalNumber(event.target.value),
              }))
            }
          />
        </FilterField>
        <FilterField label="Min bedrooms">
          <Input
            type="number"
            value={draft.minBedrooms ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                minBedrooms: parseOptionalNumber(event.target.value),
              }))
            }
          />
        </FilterField>
        <FilterField label="Max travel (min)">
          <Input
            type="number"
            value={draft.maxTravelMinutes ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                maxTravelMinutes: parseOptionalNumber(event.target.value),
              }))
            }
          />
        </FilterField>
        <FilterField label="Limit">
          <Input
            type="number"
            min={1}
            max={100}
            value={draft.limit ?? 20}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                limit: parseOptionalNumber(event.target.value) ?? 20,
              }))
            }
          />
        </FilterField>
        <FilterField label="Sort">
          <Select
            value={draft.sort ?? "date_desc"}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sort: event.target.value as ListingSearchSort,
              }))
            }
          >
            <option value="date_desc">Most recent</option>
            <option value="price_asc">Price ascending</option>
            <option value="price_desc">Price descending</option>
            <option value="surface_desc">Surface descending</option>
            <option value="compat_desc">Adéquation</option>
          </Select>
        </FilterField>
        <FilterField label="Property type">
          <div className="flex flex-col gap-2 pt-1 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.ancienOnly ?? false}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    ancienOnly: event.target.checked,
                    neufOnly: event.target.checked ? false : current.neufOnly,
                  }))
                }
              />
              Ancien only
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.neufOnly ?? false}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    neufOnly: event.target.checked,
                    ancienOnly: event.target.checked
                      ? false
                      : current.ancienOnly,
                  }))
                }
              />
              Neuf only
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.priceDropOnly ?? false}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    priceDropOnly: event.target.checked,
                  }))
                }
              />
              Price drops only
            </label>
          </div>
        </FilterField>
        <div className="flex items-end">
          <Button type="submit">Search</Button>
        </div>
      </form>

      {query.isLoading ? <p>Loading…</p> : null}
      {query.error ? (
        <p className="text-destructive">{getErrorMessage(query.error)}</p>
      ) : null}

      {query.data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {total} result(s)
            {view === "list" && items.length < total
              ? ` · showing ${String(items.length)}`
              : ""}
            {view === "map" && mapQuery.isFetching && !mapQuery.data
              ? " · loading map data…"
              : ""}
            {(view === "map" ? mapZone : query.data.pages[0]?.zone)
              ? ` · ${view === "map" ? mapZone : query.data.pages[0]?.zone}`
              : ""}
          </p>
          {view === "map" ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="order-2 lg:order-1 lg:w-2/5 lg:shrink-0">
                <div className="lg:sticky lg:top-20 space-y-3">
                  {selectedProperty ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                          {selectedIndex + 1} / {mapItems.length}
                        </p>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={selectedIndex <= 0}
                            onClick={() => {
                              const previous = mapItems[selectedIndex - 1];
                              if (previous) setSelectedId(previous.id);
                            }}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              selectedIndex < 0 ||
                              selectedIndex >= mapItems.length - 1
                            }
                            onClick={() => {
                              const next = mapItems[selectedIndex + 1];
                              if (next) setSelectedId(next.id);
                            }}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                      <PropertyCard property={selectedProperty} compact />
                    </>
                  ) : (
                    <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                      Click a marker on the map to view listing details.
                    </div>
                  )}
                </div>
              </div>
              <div className="order-1 lg:order-2 lg:sticky lg:top-20 lg:flex-1">
                {mapQuery.isLoading && !mapQuery.data ? (
                  <div
                    className="flex items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground"
                    style={{ height: "min(70vh, 720px)" }}
                  >
                    Loading map…
                  </div>
                ) : (
                  <ListingsMap
                    properties={mapItems}
                    selectedId={selectedId}
                    onPropertySelect={setSelectedId}
                    totalCount={total}
                    resetBoundsKey={mapBoundsKey}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          )}
          {view === "list" && query.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  const id = useId();

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id })}
    </div>
  );
}
