import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { ListingsMapView } from "@/components/listings/listings-map-view";
import { ListingSearchFiltersForm } from "@/components/listings/listing-search-filters-form";
import { FilterChipsBar } from "@/components/listings/filter-chips-bar";
import {
  PropertyGridCard,
  PropertyGridCardSkeleton,
} from "@/components/listings/property-grid-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { useListingSearch } from "@/hooks/use-listing-search";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getErrorMessage } from "@/lib/error-message";
import { clearFilterChip, searchParamsToFilters } from "@/lib/listing-filters";
import * as m from "@/paraglide/messages.js";

export const Route = createFileRoute("/listings/")({
  validateSearch: (search) => searchParamsToFilters(search),
  component: ListingsPage,
});

function activeFilterCount(filters: ReturnType<typeof searchParamsToFilters>) {
  return Object.entries(filters).filter(([key, value]) => {
    if (key === "limit" || key === "sort" || key === "offset") return false;
    if (typeof value === "boolean") return value;
    return value !== undefined && value !== "";
  }).length;
}

function ListingsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const filters = Route.useSearch();
  const search = useListingSearch(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapPreviewOpen, setMapPreviewOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const filterCount = activeFilterCount(filters);

  const submitFilters = () => {
    const next = search.applyFilters(search.draft);
    void navigate({ search: next });
    setFiltersOpen(false);
  };

  const selectMapProperty = (id: number | null) => {
    search.setSelectedId(id);
    if (search.view === "map" && id !== null) {
      setMapPreviewOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{m.listings_title()}</h1>
          <p className="text-sm text-muted-foreground">
            {m.listings_subtitle()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="md:hidden"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="size-4" />
            {m.listings_filters_open()}
            {filterCount > 0 ? (
              <Badge variant="secondary" className="ml-1">
                {filterCount}
              </Badge>
            ) : null}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={search.view === "list" ? "default" : "outline"}
            onClick={() => search.selectView("list")}
          >
            {m.listings_view_list()}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={search.view === "map" ? "default" : "outline"}
            onClick={() => search.selectView("map")}
          >
            {m.listings_view_map()}
          </Button>
        </div>
      </div>

      <div className="hidden md:block">
        <ListingSearchFiltersForm
          draft={search.draft}
          onDraftChange={search.setDraft}
          onSubmit={submitFilters}
        />
      </div>

      <Sheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={m.listings_filters_title()}
      >
        <ListingSearchFiltersForm
          draft={search.draft}
          onDraftChange={search.setDraft}
          onSubmit={submitFilters}
        />
        <Button type="button" className="mt-4 w-full" onClick={submitFilters}>
          {m.listings_filters_apply()}
        </Button>
      </Sheet>

      <FilterChipsBar
        className="md:hidden"
        filters={filters}
        onRemove={(key) => {
          void navigate({ search: clearFilterChip(filters, key) });
        }}
      />

      {search.listQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <PropertyGridCardSkeleton />
          <PropertyGridCardSkeleton />
        </div>
      ) : null}

      {search.listQuery.error ? (
        <Alert variant="destructive">
          {getErrorMessage(search.listQuery.error)}
        </Alert>
      ) : null}

      {search.listQuery.data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {m.listings_result_count({ count: search.total })}
            {search.view === "list" && search.items.length < search.total
              ? m.listings_showing_count({ count: search.items.length })
              : ""}
            {(
              search.view === "map"
                ? search.mapZone
                : search.listQuery.data.pages[0]?.zone
            )
              ? ` · ${search.view === "map" ? search.mapZone : search.listQuery.data.pages[0]?.zone}`
              : ""}
          </p>

          {search.view === "map" ? (
            <ListingsMapView
              layout={isDesktop ? "desktop" : "mobile"}
              properties={search.mapItems}
              selectedId={search.selectedId}
              selectedProperty={search.selectedProperty}
              totalCount={search.total}
              mapBoundsKey={search.mapBoundsKey}
              mapLoading={search.mapQuery.isLoading && !search.mapQuery.data}
              mapPreviewOpen={mapPreviewOpen}
              onMapPreviewOpenChange={setMapPreviewOpen}
              onPropertySelect={selectMapProperty}
            />
          ) : search.items.length === 0 ? (
            <EmptyState
              title={m.listings_empty_title()}
              description={m.listings_empty_desc()}
              action={{
                label: m.listings_empty_action(),
                to: "/listings",
              }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {search.items.map((property) => (
                <PropertyGridCard key={property.id} property={property} />
              ))}
            </div>
          )}

          {search.view === "list" && search.listQuery.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              disabled={search.listQuery.isFetchingNextPage}
              onClick={() => void search.listQuery.fetchNextPage()}
            >
              {search.listQuery.isFetchingNextPage
                ? m.common_loading()
                : m.common_load_more()}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
