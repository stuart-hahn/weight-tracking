/**
 * Timezone-aware date helpers for "today" and "yesterday" in the user's timezone.
 * Entry dates are YYYY-MM-DD; these helpers return the calendar date in the given zone (or browser local if unset).
 */

/**
 * Returns YYYY-MM-DD for "now" in the given IANA timezone.
 * If timezone is missing, null, or empty, uses the browser's local date.
 */
export function getTodayInTimezone(timezone?: string | null): string {
  const opts = timezone ? { timeZone: timezone } : undefined;
  return new Date().toLocaleDateString('en-CA', opts);
}

/**
 * Returns YYYY-MM-DD for the calendar day before today in the same timezone.
 * Uses getTodayInTimezone then subtracts one calendar day.
 */
export function getYesterdayInTimezone(timezone?: string | null): string {
  const today = getTodayInTimezone(timezone);
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = new Date(y, m - 1, d - 1);
  return yesterday.toISOString().slice(0, 10);
}
