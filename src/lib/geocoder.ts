/**
 * Geocoding service for converting location strings to coordinates.
 *
 * Uses OpenStreetMap's Nominatim API (free, no API key required).
 * Includes caching to minimize API calls and respect rate limits.
 */

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

// Rate limiter: Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // ms

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();
  return fetch(url);
}

/**
 * Geocode a location string to lat/lng coordinates
 * Uses OpenStreetMap Nominatim (free, no API key needed)
 */
export async function geocodeLocation(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  // Check cache
  const cacheKey = query.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null;
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
    });

    const response = await rateLimitedFetch(
      `https://nominatim.openstreetmap.org/search?${params}`
    );

    if (!response.ok) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();
    if (data.length === 0) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const result = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };

    geocodeCache.set(cacheKey, result);
    return result;
  } catch {
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Reverse geocode coordinates to a location name
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ city: string; state: string; country: string } | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) return null; // Simplified

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
    });

    const response = await rateLimitedFetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      city: data.address?.city || data.address?.town || data.address?.village || '',
      state: data.address?.state || '',
      country: data.address?.country || '',
    };
  } catch {
    return null;
  }
}

/**
 * Calculate distance between two points in km (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
