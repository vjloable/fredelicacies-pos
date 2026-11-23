// Kiosk tablet location for each face check. Best effort: a missing location
// never blocks a punch, the reason is sent instead so it is recorded.

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in metres. Wi-Fi-only tablets report tens to hundreds of metres. */
  accuracy: number;
}

export type LocationError = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export type LocationResult = { location: DeviceLocation; locationError: null } | { location: null; locationError: LocationError };

const CODES: Record<number, LocationError> = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };

export function getDeviceLocation(timeoutMs = 10_000): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ location: null, locationError: 'unsupported' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          location: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          },
          locationError: null,
        }),
      (err) => resolve({ location: null, locationError: CODES[err.code] ?? 'unavailable' }),
      // A reading up to a minute old is fine: the kiosk tablet doesn't move.
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** Whether the browser has blocked location for this site (null when the browser can't tell). */
export async function isLocationBlocked(): Promise<boolean | null> {
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'denied';
  } catch {
    return null;
  }
}

export const mapsUrl = (l: { latitude: number; longitude: number }) =>
  `https://www.google.com/maps?q=${l.latitude},${l.longitude}`;
