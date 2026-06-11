export type GeoPoint = {
  lat: number;
  lng: number;
};

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bboxCenter(bbox: {
  west: number;
  south: number;
  east: number;
  north: number;
}): GeoPoint {
  return {
    lat: (bbox.south + bbox.north) / 2,
    lng: (bbox.west + bbox.east) / 2,
  };
}

export function isWithinRadiusKm(
  point: GeoPoint,
  center: GeoPoint,
  radiusKm: number
): boolean {
  return (
    haversineDistanceKm(center.lat, center.lng, point.lat, point.lng) <=
    radiusKm
  );
}
