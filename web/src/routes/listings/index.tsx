import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { ListingsMap } from "@/components/listings/listings-map";
import { ListingSearchFiltersForm } from "@/components/listings/listing-search-filters-form";
import { PropertyCard } from "@/components/listings/property-card";
import { Button } from "@/components/ui/button";
import { useListingSearch } from "@/hooks/use-listing-search";
import { getErrorMessage } from "@/lib/error-message";
import { searchParamsToFilters } from "@/lib/listing-filters";
import * as m from "@/paraglide/messages.js";

export const Route = createFileRoute("/listings/")({
  validateSearch: (search) => searchParamsToFilters(search),
  component: ListingsPage,
});

function ListingsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const filters = Route.useSearch();
  const search = useListingSearch(filters);

  const submitFilters = () => {
    const next = search.applyFilters(search.draft);
    void navigate({ search: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{m.listings_title()}</h1>
          <p className="text-sm text-muted-foreground">
            {m.listings_subtitle()}
          </p>
        </div>
        <div className="flex gap-2">
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

      <ListingSearchFiltersForm
        draft={search.draft}
        onDraftChange={search.setDraft}
        onSubmit={submitFilters}
      />

      {search.listQuery.isLoading ? <p>{m.common_loading()}</p> : null}
      {search.listQuery.error ? (
        <p className="text-destructive">
          {getErrorMessage(search.listQuery.error)}
        </p>
      ) : null}

      {search.listQuery.data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {m.listings_result_count({ count: search.total })}
            {search.view === "list" && search.items.length < search.total
              ? m.listings_showing_count({ count: search.items.length })
              : ""}
            {search.view === "map" &&
            search.mapQuery.isFetching &&
            !search.mapQuery.data
              ? m.listings_loading_map()
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="order-2 lg:order-1 lg:w-2/5 lg:shrink-0">
                <div className="lg:sticky lg:top-20 space-y-3">
                  {search.selectedProperty ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                          {search.selectedIndex + 1} / {search.mapItems.length}
                        </p>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={search.selectedIndex <= 0}
                            onClick={() => {
                              const previous =
                                search.mapItems[search.selectedIndex - 1];
                              if (previous) search.setSelectedId(previous.id);
                            }}
                          >
                            {m.common_previous()}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              search.selectedIndex < 0 ||
                              search.selectedIndex >= search.mapItems.length - 1
                            }
                            onClick={() => {
                              const next =
                                search.mapItems[search.selectedIndex + 1];
                              if (next) search.setSelectedId(next.id);
                            }}
                          >
                            {m.common_next()}
                          </Button>
                        </div>
                      </div>
                      <PropertyCard property={search.selectedProperty} />
                    </>
                  ) : (
                    <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                      {m.listings_map_select_prompt()}
                    </div>
                  )}
                </div>
              </div>
              <div className="order-1 lg:order-2 lg:sticky lg:top-20 lg:flex-1">
                {search.mapQuery.isLoading && !search.mapQuery.data ? (
                  <div
                    className="flex items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground"
                    style={{ height: "min(70vh, 720px)" }}
                  >
                    {m.listings_map_loading()}
                  </div>
                ) : (
                  <ListingsMap
                    properties={search.mapItems}
                    selectedId={search.selectedId}
                    onPropertySelect={search.setSelectedId}
                    totalCount={search.total}
                    resetBoundsKey={search.mapBoundsKey}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {search.items.map((property) => (
                <PropertyCard key={property.id} property={property} />
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
