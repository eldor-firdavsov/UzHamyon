'use client';

import React from 'react';
import { Check, Flame, Snowflake } from 'lucide-react';
import type { StreakDay, StreakSummary } from '@/lib/streak/compute';
import { useI18n } from '@/lib/i18n/client';
import { WEEKDAYS_SHORT } from '@/lib/i18n/format';


/** Flame + number. Dashed outline while today is not logged yet (streak at risk). */
export function StreakChip({ streak, onClick }: { streak: StreakSummary; onClick?: () => void }) {
  const { t } = useI18n();
  const atRisk = !streak.todayDone;
  return (
    <button
      type="button"
      className="uz-streak-chip"
      data-risk={atRisk}
      onClick={onClick}
      aria-label={t.streak.chipAria(streak.current, atRisk)}
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


/** Monday → Sunday with logged / frozen / today states. */
export function StreakWeek({ streak }: { streak: StreakSummary }) {
  const { t, lang } = useI18n();
  if (!streak.week.length) return null;
  const weekdays = WEEKDAYS_SHORT[lang];
  const today = todayOf(streak);
  return (
    <div className="uz-week" role="list" aria-label={t.streak.thisWeek}>
      {streak.week.map((d, i) => (
        <div
          key={d.date}
          className="uz-week-day"
          data-today={d.date === today}
          role="listitem"
          aria-label={`${weekdays[i]} ${t.streak.states[d.state]}`}
        >
          <span>{weekdays[i]}</span>
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
