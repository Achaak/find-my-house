import { cloneElement, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { LISTING_SOURCES } from "@find-my-house/api-types";
import type {
  ListingSearchFilters,
  ListingSearchSort,
  ListingSource,
} from "@find-my-house/api-types";
import { parseOptionalNumber } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

const SOURCE_LABELS: Record<ListingSource, () => string> = {
  bienici: m.source_bienici,
  leboncoin: m.source_leboncoin,
  seloger: m.source_seloger,
  logicimmo: m.source_logicimmo,
};

export function ListingSearchFiltersForm({
  draft,
  onDraftChange,
  onSubmit,
}: {
  draft: ListingSearchFilters;
  onDraftChange: (next: ListingSearchFilters) => void;
  onSubmit: () => void;
}) {
  const setDraft = (
    updater: (current: ListingSearchFilters) => ListingSearchFilters
  ) => {
    onDraftChange(updater(draft));
  };

  return (
    <form
      className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FilterField label={m.filter_city()}>
        <Input
          value={draft.city ?? ""}
          onChange={(event) =>
            setDraft((current) => ({ ...current, city: event.target.value }))
          }
        />
      </FilterField>
      <FilterField label={m.filter_postal_code()}>
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
      <FilterField label={m.filter_text()}>
        <Input
          value={draft.text ?? ""}
          onChange={(event) =>
            setDraft((current) => ({ ...current, text: event.target.value }))
          }
        />
      </FilterField>
      <FilterField label={m.filter_source()}>
        <Select
          value={draft.source ?? ""}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              source: (event.target.value || undefined) as
                ListingSource | undefined,
            }))
          }
        >
          <option value="">{m.filter_source_all()}</option>
          {LISTING_SOURCES.map((source) => (
            <option key={source} value={source}>
              {SOURCE_LABELS[source]()}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label={m.filter_min_price()}>
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
      <FilterField label={m.filter_max_price()}>
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
      <FilterField label={m.filter_min_surface()}>
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
      <FilterField label={m.filter_min_land_surface()}>
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
      <FilterField label={m.filter_min_rooms()}>
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
      <FilterField label={m.filter_min_bedrooms()}>
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
      <FilterField label={m.filter_max_travel()}>
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
      <FilterField label={m.filter_limit()}>
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
      <FilterField label={m.filter_sort()}>
        <Select
          value={draft.sort ?? "date_desc"}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              sort: event.target.value as ListingSearchSort,
            }))
          }
        >
          <option value="date_desc">{m.sort_date_desc()}</option>
          <option value="price_asc">{m.sort_price_asc()}</option>
          <option value="price_desc">{m.sort_price_desc()}</option>
          <option value="surface_desc">{m.sort_surface_desc()}</option>
          <option value="compat_desc">{m.compatibility_sort()}</option>
        </Select>
      </FilterField>
      <FilterField label={m.filter_property_type()}>
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
            {m.filter_ancien_only()}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.neufOnly ?? false}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  neufOnly: event.target.checked,
                  ancienOnly: event.target.checked ? false : current.ancienOnly,
                }))
              }
            />
            {m.filter_neuf_only()}
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
            {m.filter_price_drop_only()}
          </label>
        </div>
      </FilterField>
      <div className="flex items-end">
        <Button type="submit">{m.common_search()}</Button>
      </div>
    </form>
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
