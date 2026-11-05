/**
 * UzHamyon — Transaction Date and Time Utilities
 *
 * Provides timezone-accurate local date and time resolution,
 * preventing UTC day-drift (e.g. UTC+5 Tashkent where early morning
 * transactions would shift to the previous day if using toISOString()).
 */

import { getDaysInCalendarMonth } from '../../prototype/dateUtils.ts';

/**
 * Returns the current date in the user's local timezone formatted as YYYY-MM-DD.
 */
export function getNowLocalDateString(dateObj: Date = new Date()): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current time in the user's local timezone formatted as HH:mm.
 */
export function getNowLocalTimeString(dateObj: Date = new Date()): string {
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Returns both date and time for initializing new transaction forms.
 */
export function getDefaultTransactionDateTime(dateObj: Date = new Date()): {
  date: string;
  time: string;
} {
  return {
    date: getNowLocalDateString(dateObj),
    time: getNowLocalTimeString(dateObj),
  };
}

/**
 * Validates whether a given string is a valid YYYY-MM-DD calendar date.
 * Accurately enforces leap years (Feb 29) and standard month day limits (30 vs 31 days).
 */
export function isValidCalendarDate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const parts = dateStr.split('-').map(Number);
  const [year, month, day] = parts;

  if (month < 1 || month > 12) {
    return false;
  }

  const maxDays = getDaysInCalendarMonth(year, month);
  if (day < 1 || day > maxDays) {
    return false;
  }

  return true;
}

/**
 * Validates whether a given string is a valid HH:mm (or HH:mm:ss) 24-hour time.
 */
export function isValidTimeString(timeStr: unknown): boolean {
  if (typeof timeStr !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(timeStr)) {
    return false;
  }
  return true;
}

/**
 * Combines a local date (YYYY-MM-DD) and local time (HH:mm) into a local ISO timestamp.
 */
export function combineLocalDateTime(dateStr: string, timeStr?: string): string {
  const safeTime = timeStr && isValidTimeString(timeStr) ? timeStr.slice(0, 5) : '12:00';
  return `${dateStr}T${safeTime}:00`;
}

/**
 * Extracts local date (YYYY-MM-DD) from a Date, ISO timestamp, or date string
 * without UTC day shift.
 */
export function extractLocalDate(input?: string | Date | null): string {
  if (!input) return getNowLocalDateString();
  if (input instanceof Date) {
    return getNowLocalDateString(input);
  }

  // If already formatted as YYYY-MM-DD
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const d = new Date(input);
  if (isNaN(d.getTime())) {
    return getNowLocalDateString();
  }
  return getNowLocalDateString(d);
}

/**
 * Extracts local time (HH:mm) from a Date, ISO timestamp, or time string.
 */
export function extractLocalTime(input?: string | Date | null): string {
  if (!input) return getNowLocalTimeString();
  if (input instanceof Date) {
    return getNowLocalTimeString(input);
  }

  // If input contains a time component T14:30 or 14:30
  const timeMatch = input.match(/(\d{2}):(\d{2})/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${timeMatch[1]}:${timeMatch[2]}`;
    }
  }

  const d = new Date(input);
  if (isNaN(d.getTime())) {
    return getNowLocalTimeString();
  }
  return getNowLocalTimeString(d);
}
