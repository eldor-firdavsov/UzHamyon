import { addDaysToDate } from './tashkent.ts';

const SHORT_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

/** "Bugun", "Kecha" or "18-noy" for a YYYY-MM-DD date, relative to today (Tashkent). */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Bugun';
  if (date === addDaysToDate(today, -1)) return 'Kecha';
  const m = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  if (!Number.isFinite(d) || m < 0 || m > 11) return date;
  const label = `${d}-${SHORT_MONTHS[m]}`;
  return date.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${date.slice(0, 4)}`;
}
