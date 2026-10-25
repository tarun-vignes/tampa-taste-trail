import type { Profile } from '../shared';
// Approximate app-selected search centers, not official neighborhood boundaries.
export const searchAreas: Record<
  Profile['area'],
  { latitude: number; longitude: number; radius: number }
> = {
  Tampa: { latitude: 27.9506, longitude: -82.4572, radius: 9000 },
  Downtown: { latitude: 27.9475, longitude: -82.4584, radius: 3500 },
  'Ybor City': { latitude: 27.9608, longitude: -82.4418, radius: 3000 },
  'Seminole Heights': { latitude: 27.9979, longitude: -82.4501, radius: 4000 },
  'Hyde Park': { latitude: 27.9364, longitude: -82.474, radius: 3500 },
};
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function inSearchArea(
  point: { latitude: number; longitude: number },
  area: Profile['area'],
) {
  return (
    point.latitude >= 27.85 &&
    point.latitude <= 28.1 &&
    point.longitude >= -82.6 &&
    point.longitude <= -82.34 &&
    distanceMeters(searchAreas[area], point) <= searchAreas[area].radius
  );
}
