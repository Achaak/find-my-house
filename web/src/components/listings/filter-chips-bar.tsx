import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFilterChips, type FilterChip } from "@/lib/listing-filters";
import type { ListingSearchFilters } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";

export function FilterChipsBar({
  filters,
  onRemove,
  className,
}: {
  filters: ListingSearchFilters;
  onRemove: (key: string) => void;
  className?: string;
}) {
  const chips: FilterChip[] = formatFilterChips(filters);
  if (chips.length === 0) return null;

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {m.listings_active_filters()}
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
            {chip.label}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5 rounded-full"
              aria-label={m.listings_filter_remove({ label: chip.label })}
              onClick={() => onRemove(chip.key)}
            >
              <X className="size-3" />
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
