'use client';

import React from 'react';
import { Check, Flame, Snowflake } from 'lucide-react';
import type { StreakDay, StreakSummary } from '@/lib/streak/compute';

const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

/** Flame + number. Dashed outline while today is not logged yet (streak at risk). */
export function StreakChip({ streak, onClick }: { streak: StreakSummary; onClick?: () => void }) {
  const atRisk = !streak.todayDone;
  return (
    <button
      type="button"
      className="uz-streak-chip"
      data-risk={atRisk}
      onClick={onClick}
      aria-label={`Seriya: ${streak.current} kun${atRisk ? ', bugun hali yozilmagan' : ''}`}
    >
      <Flame
        size={18}
        strokeWidth={2.2}
        color="#E8930C"
        fill={atRisk ? 'none' : '#FFB020'}
        aria-hidden="true"
      />
      <span>{streak.current}</span>
    </button>
  );
}

function DayDot({ day }: { day: StreakDay }) {
  return (
    <span className="uz-week-dot" data-state={day.state} aria-hidden="true">
      {day.state === 'done' && <Check size={14} strokeWidth={3} />}
      {day.state === 'frozen' && <Snowflake size={14} strokeWidth={2.4} />}
    </span>
  );
}

const STATE_LABEL: Record<StreakDay['state'], string> = {
  done: 'yozildi',
  frozen: 'muzlatildi',
  missed: 'o‘tkazildi',
  today: 'bugun',
  future: '',
};

/** Monday → Sunday with logged / frozen / today states. */
export function StreakWeek({ streak }: { streak: StreakSummary }) {
  if (!streak.week.length) return null;
  const today = todayOf(streak);
  return (
    <div className="uz-week" role="list" aria-label="Shu hafta">
      {streak.week.map((d, i) => (
        <div
          key={d.date}
          className="uz-week-day"
          data-today={d.date === today}
          role="listitem"
          aria-label={`${WEEKDAYS[i]} ${STATE_LABEL[d.state]}`}
        >
          <span>{WEEKDAYS[i]}</span>
          <DayDot day={d} />
        </div>
      ))}
    </div>
  );
}

/** Today = the last day that is not in the future. */
function todayOf(streak: StreakSummary): string {
  const past = streak.week.filter((d) => d.state !== 'future');
  return past.length ? past[past.length - 1].date : '';
}
