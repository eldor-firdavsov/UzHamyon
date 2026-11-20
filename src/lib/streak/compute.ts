/**
 * Logging streak — pure calculation (no I/O), shared by server and client.
 *
 * Rules (shown to the user in onboarding and on the streak screen):
 * - A day counts when at least one transaction was logged that day (Tashkent).
 * - Today not logged yet does not break the streak: it is "at risk" until midnight.
 * - One free freeze per calendar week (Mon–Sun) covers a single missed day,
 *   but only when the very next day was logged (or is today, still pending).
 *   So two missed days in a row always break the streak.
 */
import { addDaysToDate } from '../time/tashkent.ts';

export type StreakDayState = 'done' | 'frozen' | 'missed' | 'today' | 'future';

export interface StreakDay {
  date: string;
  state: StreakDayState;
}

export interface StreakSummary {
  /** Consecutive logged days ending today (or yesterday while today is pending). */
  current: number;
  /** Longest streak ever. */
  best: number;
  todayDone: boolean;
  /** Freezes still available this week (0 or 1). */
  freezesLeft: number;
  /** Monday → Sunday of the current week. */
  week: StreakDay[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDaysToDate(date, -((weekday + 6) % 7));
}

export const EMPTY_STREAK: StreakSummary = {
  current: 0,
  best: 0,
  todayDone: false,
  freezesLeft: 1,
  week: [],
};

export function computeStreak(days: Iterable<string>, today: string): StreakSummary {
  const logged = new Set<string>();
  for (const d of days) {
    if (typeof d === 'string' && DATE_RE.test(d.slice(0, 10)) && d.slice(0, 10) <= today) {
      logged.add(d.slice(0, 10));
    }
  }

  const frozen = new Set<string>();
  const frozenWeeks = new Set<string>();
  let run = 0;
  let best = 0;

  if (logged.size > 0) {
    let cursor = [...logged].sort()[0];
    while (cursor < today) {
      if (logged.has(cursor)) {
        run += 1;
        if (run > best) best = run;
      } else {
        const next = addDaysToDate(cursor, 1);
        const wk = weekStart(cursor);
        const nextKeepsStreak = logged.has(next) || next === today;
        if (run > 0 && nextKeepsStreak && !frozenWeeks.has(wk)) {
          frozenWeeks.add(wk);
          frozen.add(cursor);
        } else {
          run = 0;
        }
      }
      cursor = addDaysToDate(cursor, 1);
    }
  }

  const todayDone = logged.has(today);
  if (todayDone) {
    run += 1;
    if (run > best) best = run;
  }

  const monday = weekStart(today);
  const week: StreakDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDaysToDate(monday, i);
    let state: StreakDayState;
    if (date > today) state = 'future';
    else if (logged.has(date)) state = 'done';
    else if (date === today) state = 'today';
    else if (frozen.has(date)) state = 'frozen';
    else state = 'missed';
    week.push({ date, state });
  }

  return {
    current: run,
    best,
    todayDone,
    freezesLeft: frozenWeeks.has(monday) ? 0 : 1,
    week,
  };
}
