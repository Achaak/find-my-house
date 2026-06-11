import type { GeoPoint } from "../../geo.js";
import type { SeLogerClassifiedData } from "../types.js";

const FRANCE_LAT_MIN = 41;
const FRANCE_LAT_MAX = 52;
const FRANCE_LNG_MIN = -5.5;
const FRANCE_LNG_MAX = 10;

function isFranceCoordinate(lat: number, lng: number): boolean {
  return (
    lat >= FRANCE_LAT_MIN &&
    lat <= FRANCE_LAT_MAX &&
    lng >= FRANCE_LNG_MIN &&
    lng <= FRANCE_LNG_MAX
  );
}

function toGeoPoint(lat: number, lng: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isFranceCoordinate(lat, lng)) return null;
  return { lat, lng };
}

function readLatLng(
  coords:
    | { lat?: number; lng?: number; latitude?: number; longitude?: number }
    | undefined
): GeoPoint | null {
  if (!coords) return null;

  const lat = coords.lat ?? coords.latitude;
  const lng = coords.lng ?? coords.longitude;
  if (lat === undefined || lng === undefined) return null;

  return toGeoPoint(lat, lng);
}

/** Extracts coordinates from embedded classified JSON when present. */
export function extractSeLogerCoordsFromClassifiedData(
  data: SeLogerClassifiedData
): GeoPoint | null {
  const fromLocation =
    readLatLng(data.location?.coordinates) ?? readLatLng(data.location?.geo);
  if (fromLocation) return fromLocation;

  if (
    data.rawData?.latitude !== undefined &&
    data.rawData.longitude !== undefined
  ) {
    return toGeoPoint(data.rawData.latitude, data.rawData.longitude);
  }

  return null;
}

function parseCoordinatePair(lat: number, lng: number): GeoPoint | null {
  if (isFranceCoordinate(lat, lng)) return { lat, lng };
  if (isFranceCoordinate(lng, lat)) return { lat: lng, lng: lat };
  return null;
}

function parseGeoJsonCoordinates(values: number[]): GeoPoint | null {
  if (values.length < 2) return null;

  const [first, second] = values;
  return parseCoordinatePair(first, second);
}

/** Fallback parsers for detail HTML (Mapbox URL, escaped GeoJSON, inline JSON). */
export function parseSeLogerCoordinatesFromHtml(html: string): GeoPoint | null {
  const mapboxCenter =
    /\/static\/[^/]+\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/i.exec(html);
  if (mapboxCenter) {
    const lng = Number(mapboxCenter[1]);
    const lat = Number(mapboxCenter[2]);
    const point = parseCoordinatePair(lat, lng);
    if (point) return point;
  }

  const escapedPoint =
    /\\"type\\":\\"Point\\"[^[]*\\"coordinates\\":\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/i.exec(
      html
    );
  if (escapedPoint) {
    const first = Number(escapedPoint[1]);
    const second = Number(escapedPoint[2]);
    const point = parseGeoJsonCoordinates([first, second]);
    if (point) return point;
  }

  const inlinePair =
    /"latitude"\s*:\s*(-?\d+(?:\.\d+)?)[^}]{0,120}"longitude"\s*:\s*(-?\d+(?:\.\d+)?)/i.exec(
      html
    );
  if (inlinePair) {
    const point = parseCoordinatePair(
      Number(inlinePair[1]),
      Number(inlinePair[2])
    );
    if (point) return point;
  }

  const inlinePairReversed =
    /"longitude"\s*:\s*(-?\d+(?:\.\d+)?)[^}]{0,120}"latitude"\s*:\s*(-?\d+(?:\.\d+)?)/i.exec(
      html
    );
  if (inlinePairReversed) {
    const point = parseCoordinatePair(
      Number(inlinePairReversed[2]),
      Number(inlinePairReversed[1])
    );
    if (point) return point;
  }

  return null;
}
