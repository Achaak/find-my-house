import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PropertyCard } from "@/components/listings/property-card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { api, queryKeys } from "@/lib/api";
import type {
  ListingSearchFilters,
  ListingSearchSort,
  ListingSource,
} from "@/lib/types";

export const Route = createFileRoute("/listings/")({
  component: ListingsPage,
});

function ListingsPage() {
  const [filters, setFilters] = useState<ListingSearchFilters>({
    limit: 20,
    sort: "date_desc",
  });
  const [draft, setDraft] = useState(filters);

  const query = useQuery({
    queryKey: queryKeys.listings(filters),
    queryFn: () => api.listings(filters),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Listings</h1>
        <p className="text-sm text-muted-foreground">
          Search saved listings — same filters as <code>/listings</code> on
          Discord.
        </p>
      </div>

      <form
        className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({
            ...draft,
            minPrice: draft.minPrice || undefined,
            maxPrice: draft.maxPrice || undefined,
            minSurface: draft.minSurface || undefined,
            minLandSurface: draft.minLandSurface || undefined,
            minRooms: draft.minRooms || undefined,
            minBedrooms: draft.minBedrooms || undefined,
            maxTravelMinutes: draft.maxTravelMinutes || undefined,
          });
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
                minPrice: Number(event.target.value) || undefined,
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
                maxPrice: Number(event.target.value) || undefined,
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
                minSurface: Number(event.target.value) || undefined,
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
            <option value="compat_desc">Compatibility</option>
          </Select>
        </FilterField>
        <div className="flex items-end">
          <Button type="submit">Search</Button>
        </div>
      </form>

      {query.isLoading ? <p>Loading…</p> : null}
      {query.error ? (
        <p className="text-destructive">{(query.error as Error).message}</p>
      ) : null}

      {query.data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {query.data.total} result(s)
            {query.data.zone ? ` · ${query.data.zone}` : ""}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {query.data.items.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
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
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
