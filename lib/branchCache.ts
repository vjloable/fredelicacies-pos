// Tiny persistent cache for stale-while-revalidate page loads.
// Stores last-known data in localStorage so pages can render instantly from
// cache, then update silently once the network fetch resolves. The universal
// PageLoader only shows on a genuine first load (no cache for the key).
const PREFIX = 'fx-cache:';

export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota/serialization failures are non-fatal — the network fetch still runs.
  }
}
