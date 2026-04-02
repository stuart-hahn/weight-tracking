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

/**
 * UTC milliseconds for chart geometry only: calendar YYYY-MM-DD at ~12:00 wall time in `timeZone`.
 * Avoids interpreting date-only strings as UTC midnight (which shifts the X axis vs user calendar days).
 */
export function calendarDateToChartTime(isoDate: string, timeZone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    const t = Date.parse(isoDate);
    return Number.isNaN(t) ? 0 : t;
  }
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  if (!isValidIanaTimeZone(timeZone)) {
    return Date.UTC(y, mo - 1, d, 12, 0, 0);
  }

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function wallParts(utcMs: number): { y: number; m: number; d: number; h: number; min: number } {
    const o = { y: 0, m: 0, d: 0, h: 0, min: 0 };
    for (const p of dtf.formatToParts(new Date(utcMs))) {
      if (p.type === 'year') o.y = Number(p.value);
      if (p.type === 'month') o.m = Number(p.value);
      if (p.type === 'day') o.d = Number(p.value);
      if (p.type === 'hour') o.h = Number(p.value);
      if (p.type === 'minute') o.min = Number(p.value);
    }
    return o;
  }

  let ms = Date.UTC(y, mo - 1, d, 12, 0, 0);
  for (let i = 0; i < 56; i++) {
    const w = wallParts(ms);
    if (w.y === y && w.m === mo && w.d === d && w.h === 12 && w.min === 0) {
      return ms;
    }
    // Spring-forward: 12:00 may not exist; accept adjacent hour on same calendar day
    if (w.y === y && w.m === mo && w.d === d && (w.h === 11 || w.h === 13) && w.min === 0) {
      return ms;
    }
    const deltaDays = (Date.UTC(y, mo - 1, d) - Date.UTC(w.y, w.m - 1, w.d)) / 86400000;
    ms += Math.round(deltaDays) * 86400000;
    ms += (12 - w.h) * 3600000 + (0 - w.min) * 60000;
  }

  return Date.UTC(y, mo - 1, d, 12, 0, 0);
}
