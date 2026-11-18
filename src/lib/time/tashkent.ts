/**
 * Asia/Tashkent time helpers (UTC+5, no daylight saving time).
 *
 * Server code must use these instead of the server clock: on Vercel the server
 * runs in UTC, so between 00:00 and 05:00 Tashkent "today" would otherwise be
 * yesterday. Client components may keep using the browser clock.
 */

export const TASHKENT_TZ = 'Asia/Tashkent';
export const TASHKENT_UTC_OFFSET = '+05:00';
const OFFSET_MS = 5 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Wall-clock parts in Tashkent for the given instant. */
function tashkentParts(at: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  // Tashkent has had a fixed UTC+5 offset since 1991, so plain arithmetic is exact
  // and avoids depending on the runtime's ICU time-zone data.
  const shifted = new Date(at.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** Today's date in Tashkent, `YYYY-MM-DD`. */
export function todayTashkent(at: Date = new Date()): string {
  const p = tashkentParts(at);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Current time in Tashkent, `HH:mm`. */
export function nowTimeTashkent(at: Date = new Date()): string {
  const p = tashkentParts(at);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Both date and time in Tashkent. */
export function nowTashkent(at: Date = new Date()): { date: string; time: string } {
  return { date: todayTashkent(at), time: nowTimeTashkent(at) };
}

/** Adds whole days to a `YYYY-MM-DD` date (calendar arithmetic, no time zone involved). */
export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Yesterday's date in Tashkent, `YYYY-MM-DD`. */
export function yesterdayTashkent(at: Date = new Date()): string {
  return addDaysToDate(todayTashkent(at), -1);
}

/** First and last day of a month, `YYYY-MM-DD`. Defaults to the current Tashkent month. */
export function monthRangeTashkent(
  year?: number,
  month?: number,
  at: Date = new Date()
): { start: string; end: string } {
  const p = tashkentParts(at);
  const y = year ?? p.year;
  const m = month ?? p.month;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay)}` };
}

/** Current Tashkent month as `YYYY-MM`. */
export function currentMonthKeyTashkent(at: Date = new Date()): string {
  return todayTashkent(at).slice(0, 7);
}

/**
 * Converts a Tashkent wall-clock date + time into an ISO timestamp with the correct
 * offset, e.g. ('2026-11-18', '14:30') → '2026-11-18T14:30:00+05:00'.
 * Invalid / missing time falls back to 12:00.
 */
export function tashkentToIso(date: string, time?: string | null): string {
  const safe = typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d/.test(time) ? time.slice(0, 5) : '12:00';
  return `${date}T${safe}:00${TASHKENT_UTC_OFFSET}`;
}
