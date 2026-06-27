import { ListingsMap } from "@/components/listings/listings-map";
import { PropertyGridCard } from "@/components/listings/property-grid-card";
import { PropertyMapPreview } from "@/components/listings/property-hero";
import { Sheet } from "@/components/ui/sheet";
import type { Property } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";

export function ListingsMapView({
  properties,
  selectedId,
  selectedProperty,
  totalCount,
  mapBoundsKey,
  mapLoading,
  mapPreviewOpen,
  onMapPreviewOpenChange,
  onPropertySelect,
  layout,
}: {
  properties: Property[];
  selectedId: number | null;
  selectedProperty: Property | null;
  totalCount: number;
  mapBoundsKey: string;
  mapLoading: boolean;
  mapPreviewOpen: boolean;
  onMapPreviewOpenChange: (open: boolean) => void;
  onPropertySelect: (id: number | null) => void;
  layout: "mobile" | "desktop";
}) {
  const mapHeight =
    layout === "mobile" ? "min(72dvh, 720px)" : "min(70vh, 720px)";

  if (layout === "mobile") {
    return (
      <>
        <div className="-mx-4 overflow-hidden" style={{ height: mapHeight }}>
          {mapLoading ? (
            <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
              {m.listings_map_loading()}
            </div>
          ) : (
            <ListingsMap
              properties={properties}
              selectedId={selectedId}
              onPropertySelect={onPropertySelect}
              totalCount={totalCount}
              resetBoundsKey={mapBoundsKey}
            />
          )}
        </div>
        <Sheet
          open={mapPreviewOpen && Boolean(selectedProperty)}
          onOpenChange={onMapPreviewOpenChange}
          title={m.property_details()}
        >
          {selectedProperty ? (
            <PropertyMapPreview property={selectedProperty} />
          ) : null}
        </Sheet>
      </>
    );
  }

  return (
    <div className="flex gap-4 lg:flex-row lg:items-start">
      <div className="lg:w-2/5 lg:shrink-0">
        <div className="sticky top-20 space-y-3">
          {selectedProperty ? (
            <PropertyGridCard property={selectedProperty} />
          ) : (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              {m.listings_map_select_prompt()}
            </div>
          )}
        </div>
      </div>
      <div className="sticky top-20 flex-1">
        {mapLoading ? (
          <div
            className="flex items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground"
            style={{ height: mapHeight }}
          >
            {m.listings_map_loading()}
          </div>
        ) : (
          <ListingsMap
            properties={properties}
            selectedId={selectedId}
            onPropertySelect={onPropertySelect}
            totalCount={totalCount}
            resetBoundsKey={mapBoundsKey}
          />
        )}
      </div>
    </div>
  );
}
