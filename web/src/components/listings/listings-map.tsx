import { Maximize2, Minimize2, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildMarkerHtml,
  buildPopupHtml,
  filterMappable,
  isDarkMode,
  MAP_ATTRIBUTION,
  MAP_TILE_URLS,
} from "@/lib/map-utils";
import type { Property } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

type LeafletModule = typeof import("leaflet");
type MarkerClusterGroup = import("leaflet").MarkerClusterGroup;
type LeafletMap = import("leaflet").Map;
type Marker = import("leaflet").Marker;
type TileLayer = import("leaflet").TileLayer;
type LatLngBounds = import("leaflet").LatLngBounds;

export type ListingsMapProps = {
  properties: Property[];
  selectedId?: number | null;
  onPropertySelect?: (id: number) => void;
  totalCount?: number;
  resetBoundsKey?: string;
};

const MAP_HEIGHT = "min(70vh, 720px)";

function createTileLayer(L: LeafletModule, dark: boolean): TileLayer {
  return L.tileLayer(dark ? MAP_TILE_URLS.dark : MAP_TILE_URLS.light, {
    attribution: dark ? MAP_ATTRIBUTION.dark : MAP_ATTRIBUTION.light,
    maxZoom: 19,
  });
}

function createMarkerIcon(
  L: LeafletModule,
  property: Property,
  selected: boolean
) {
  return L.divIcon({
    className: "fmh-map-marker-wrap",
    html: buildMarkerHtml(property, { selected }),
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function ListingsMap({
  properties,
  selectedId = null,
  onPropertySelect,
  totalCount,
  resetBoundsKey,
}: ListingsMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const clusterRef = useRef<MarkerClusterGroup | null>(null);
  const markersRef = useRef<globalThis.Map<number, Marker>>(
    new globalThis.Map()
  );
  const tileLayerRef = useRef<TileLayer | null>(null);
  const boundsRef = useRef<LatLngBounds | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const onPropertySelectRef = useRef(onPropertySelect);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(isDarkMode);

  const mappable = useMemo(() => filterMappable(properties), [properties]);
  const missingGeo = Math.max(0, properties.length - mappable.length);

  useEffect(() => {
    onPropertySelectRef.current = onPropertySelect;
  }, [onPropertySelect]);

  const updateBounds = useCallback((L: LeafletModule, points: Property[]) => {
    const bounds = L.latLngBounds([]);
    for (const property of points) {
      bounds.extend([property.latitude!, property.longitude!]);
    }
    boundsRef.current = bounds;
    return bounds;
  }, []);

  const syncMarkers = useCallback(
    (L: LeafletModule, points: Property[], selection: number | null) => {
      const cluster = clusterRef.current;
      if (!cluster) return;

      const markers = markersRef.current;
      const nextIds = new Set(points.map((property) => property.id));

      for (const [id, marker] of markers) {
        if (!nextIds.has(id)) {
          cluster.removeLayer(marker);
          markers.delete(id);
        }
      }

      for (const property of points) {
        const lat = property.latitude!;
        const lng = property.longitude!;
        const isSelected = selection === property.id;
        const existing = markers.get(property.id);

        if (existing) {
          existing.setLatLng([lat, lng]);
          existing.setIcon(createMarkerIcon(L, property, isSelected));
          existing.setPopupContent(buildPopupHtml(property));
          continue;
        }

        const marker = L.marker([lat, lng], {
          icon: createMarkerIcon(L, property, isSelected),
        });
        marker.bindPopup(buildPopupHtml(property), {
          maxWidth: 280,
          minWidth: 260,
          className: "fmh-map-popup-container",
          autoPan: true,
          autoPanPadding: [48, 48],
          keepInView: true,
        });
        marker.on("click", () => {
          onPropertySelectRef.current?.(property.id);
        });
        cluster.addLayer(marker);
        markers.set(property.id, marker);
      }
    },
    []
  );

  const fitAllMarkers = useCallback(() => {
    const map = mapRef.current;
    const bounds = boundsRef.current;
    if (!map || !bounds || !bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }, []);

  useEffect(() => {
    if (mappable.length === 0) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        clusterRef.current = null;
        markersRef.current.clear();
        tileLayerRef.current = null;
        leafletRef.current = null;
      }
      return;
    }

    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      const dark = isDarkMode();
      setIsDark(dark);
      const tileLayer = createTileLayer(L, dark);
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;

      const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 17,
      });
      cluster.addTo(map);
      clusterRef.current = cluster;

      updateBounds(L, mappable);
      syncMarkers(L, mappable, selectedId);
      fitAllMarkers();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mappable,
    mappable.length,
    fitAllMarkers,
    syncMarkers,
    updateBounds,
    selectedId,
  ]);

  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !clusterRef.current) return;
    updateBounds(L, mappable);
    syncMarkers(L, mappable, selectedId);
  }, [mappable, selectedId, syncMarkers, updateBounds]);

  useEffect(() => {
    if (!mapRef.current || !boundsRef.current?.isValid()) return;
    fitAllMarkers();
  }, [resetBoundsKey, fitAllMarkers]);

  useEffect(() => {
    if (!selectedId || !mapRef.current || !leafletRef.current) return;

    const marker = markersRef.current.get(selectedId);
    if (!marker) return;

    const map = mapRef.current;
    const latLng = marker.getLatLng();
    map.panTo(latLng, { animate: true });
    const timer = window.setTimeout(() => {
      marker.openPopup();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      const dark = isDarkMode();
      setIsDark(dark);
      const L = leafletRef.current;
      const map = mapRef.current;
      const currentTile = tileLayerRef.current;
      if (!L || !map || !currentTile) return;
      map.removeLayer(currentTile);
      const nextTile = createTileLayer(L, dark);
      nextTile.addTo(map);
      tileLayerRef.current = nextTile;
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
      mapRef.current?.invalidateSize();
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markers.clear();
      tileLayerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  const toggleFullscreen = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    if (document.fullscreenElement === wrapper) {
      void document.exitFullscreen();
      return;
    }

    void wrapper.requestFullscreen();
  };

  if (mappable.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        {m.map_no_geolocated()}
      </p>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="fmh-map-shell relative overflow-hidden rounded-xl border bg-card"
      style={{ height: isFullscreen ? "100vh" : MAP_HEIGHT }}
    >
      <div ref={containerRef} className="absolute inset-0 z-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto rounded-lg border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
          <span className="font-medium text-foreground">
            {m.map_geolocated_count({ count: mappable.length })}
          </span>
          {missingGeo > 0 ? (
            <span>{m.map_without_coords({ count: missingGeo })}</span>
          ) : null}
          {totalCount !== undefined && totalCount > properties.length ? (
            <span>
              {m.map_loaded_count({
                loaded: properties.length,
                total: totalCount,
              })}
            </span>
          ) : null}
        </div>

        <div className="pointer-events-auto flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 bg-background/95 shadow-sm backdrop-blur"
            onClick={fitAllMarkers}
            aria-label={m.map_recenter()}
          >
            <Target className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 bg-background/95 shadow-sm backdrop-blur"
            onClick={toggleFullscreen}
            aria-label={
              isFullscreen ? m.map_exit_fullscreen() : m.map_fullscreen()
            }
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border px-3 py-2 text-xs shadow-sm backdrop-blur ${
          isDark ? "bg-zinc-900/95 text-zinc-100" : "bg-background/95"
        }`}
      >
        <p className="mb-1.5 font-medium">{m.map_legend_title()}</p>
        <ul className="space-y-1">
          <li className="flex items-center gap-2">
            <span className="fmh-map-legend-swatch fmh-map-legend-swatch--default" />
            {m.map_legend_default()}
          </li>
          <li className="flex items-center gap-2">
            <span className="fmh-map-legend-swatch fmh-map-legend-swatch--liked" />
            {m.map_legend_liked()}
          </li>
          <li className="flex items-center gap-2">
            <span className="fmh-map-legend-swatch fmh-map-legend-swatch--disliked" />
            {m.map_legend_disliked()}
          </li>
          <li className="flex items-center gap-2">
            <span className="fmh-map-legend-swatch fmh-map-legend-swatch--price-drop" />
            {m.map_legend_price_drop()}
          </li>
        </ul>
      </div>
    </div>
  );
}
