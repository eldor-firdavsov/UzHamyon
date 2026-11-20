'use client';

import React, { useEffect, useState } from 'react';
import { Check, Snowflake, Trophy } from 'lucide-react';
import type { StreakSummary } from '@/lib/streak/compute';
import { useClosing } from '@/lib/ui/useClosing';
import { useModalScrollLock } from '@/lib/ui/useModalScrollLock';
import { haptic } from '@/lib/ui/haptics';

/** Milestones the progress bar aims at. */
const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

function nextMilestone(n: number): number {
  return MILESTONES.find((m) => m > n) ?? Math.ceil((n + 1) / 100) * 100;
}

const SPARKS = [
  { dx: '-80px', dy: '-60px', c: '#9FE870' },
  { dx: '84px', dy: '-48px', c: '#FFB020' },
  { dx: '-70px', dy: '70px', c: '#FFD27A' },
  { dx: '76px', dy: '64px', c: '#9FE870' },
  { dx: '0px', dy: '-96px', c: '#FFFFFF' },
];

interface StreakCelebrationProps {
  /** Streak before this log (shown rolling out). */
  from: number;
  streak: StreakSummary;
  onClose: () => void;
}

/** Full-screen "streak grew" moment after the first log of the day. */
export default function StreakCelebration({ from, streak, onClose }: StreakCelebrationProps) {
  const to = streak.current;
  const goal = nextMilestone(to);
  const prevGoalBase = [...MILESTONES].reverse().find((m) => m <= to) ?? 0;
  const [barWidth, setBarWidth] = useState(((from - prevGoalBase) / Math.max(1, goal - prevGoalBase)) * 100);

  useModalScrollLock(true);
  const { closing, close } = useClosing(onClose);

  useEffect(() => {
    haptic('success');
    const t = window.setTimeout(() => {
      setBarWidth(((to - prevGoalBase) / Math.max(1, goal - prevGoalBase)) * 100);
    }, 50);
    return () => window.clearTimeout(t);
  }, [to, goal, prevGoalBase]);

  const todayIndex = streak.week.reduce((idx, d, i) => (d.state !== 'future' ? i : idx), -1);

  return (
    <div className="uz-cele" data-closing={closing} role="dialog" aria-modal="true" aria-label={`Seriya: ${to} kun`}>
      <div className="uz-cele-flame-wrap" aria-hidden="true">
        <div className="uz-cele-glow" />
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="uz-cele-spark"
            style={{ background: s.c, ['--dx' as string]: s.dx, ['--dy' as string]: s.dy } as React.CSSProperties}
          />
        ))}
        <svg className="uz-cele-flame" viewBox="0 0 24 24" fill="#FFB020" stroke="#FFD27A" strokeWidth="1" strokeLinejoin="round">
          <path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.2-5.6-3.6-7.6-.4 1.9-1.4 3-2.6 3.6C13 7 11.5 4.5 9 2c.2 3.3-1.5 5.4-3 7.3C4.8 10.8 5 12.6 5 15c0 4.2 3 7 7 7z" />
        </svg>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className="uz-cele-num" aria-hidden="true">
          {from !== to && <span className="uz-cele-out">{from}</span>}
          <span className={from !== to ? 'uz-cele-in' : ''} style={{ color: '#9FE870' }}>{to}</span>
        </div>
        <span style={{ fontSize: 24, fontWeight: 700, color: '#CFE3BF' }}>kun</span>
      </div>

      {streak.week.length > 0 && (
        <div className="uz-cele-week" aria-hidden="true">
          {streak.week.map((d, i) => (
            <span key={d.date} className="uz-cele-dot" data-state={d.state} data-new={i === todayIndex}>
              {d.state === 'done' && <Check size={16} strokeWidth={3} />}
              {d.state === 'frozen' && <Snowflake size={16} strokeWidth={2.4} />}
            </span>
          ))}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#CFE3BF' }}>
          <span>{to}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={15} color="#FFB020" aria-hidden="true" />
            {goal}
          </span>
        </div>
        <div className="uz-cele-bar">
          <div style={{ width: `${Math.min(100, Math.max(0, barWidth))}%` }} />
        </div>
      </div>

      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.08)', borderRadius: 14, padding: '10px 14px', fontSize: 14, fontWeight: 600, color: '#E3F0D8' }}
        aria-label={`Muzlatish: ${streak.freezesLeft}`}
      >
        <Snowflake size={18} color="#9AD7FF" aria-hidden="true" />
        <span>{streak.freezesLeft}</span>
      </div>

      <button type="button" className="uz-cele-btn" onClick={close} autoFocus>
        Zo‘r!
      </button>
    </div>
  );
}
