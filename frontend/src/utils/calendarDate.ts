/** localStorage: 'auto' or IANA zone id */
export const TIME_ZONE_STORAGE_KEY = 'bodyfat_tz_preference_v1';

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** Raw stored value: null = never set */
export function getStoredTimeZonePreference(): 'auto' | string | null {
  try {
    const raw = localStorage.getItem(TIME_ZONE_STORAGE_KEY);
    if (raw == null) return null;
    if (raw === 'auto') return 'auto';
    if (isValidIanaTimeZone(raw)) return raw;
    return 'auto';
  } catch {
    return null;
  }
}

export function setStoredTimeZonePreference(value: 'auto' | string): void {
  try {
    localStorage.setItem(TIME_ZONE_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function isValidIanaTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== 'string' || tz.length > 120) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar YYYY-MM-DD for "now" in the given IANA zone */
export function calendarTodayISO(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (y == null || m == null || d == null) return new Date().toISOString().slice(0, 10);
  return `${y}-${m}-${d}`;
}

export function getEffectiveTimeZone(preference: 'auto' | string): string {
  if (preference === 'auto') return getDeviceTimeZone();
  return isValidIanaTimeZone(preference) ? preference : getDeviceTimeZone();
}

/** IANA ids for environments without `supportedValuesOf` */
const FALLBACK_TIME_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function listSelectableTimeZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof fn === 'function') {
      const list = fn.call(Intl, 'timeZone') as string[];
      return [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
  } catch {
    /* ignore */
  }
  return [...FALLBACK_TIME_ZONES];
}
