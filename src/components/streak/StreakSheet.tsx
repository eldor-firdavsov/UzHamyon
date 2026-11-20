'use client';

import React from 'react';
import { Check, Flame, Plus, RotateCcw, Snowflake, Trophy, X } from 'lucide-react';
import type { StreakSummary } from '@/lib/streak/compute';
import { useModalScrollLock } from '@/lib/ui/useModalScrollLock';
import { useClosing } from '@/lib/ui/useClosing';

const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

interface StreakSheetProps {
  streak: StreakSummary;
  onClose: () => void;
  /** Today not logged yet: the main button opens quick add. */
  onAdd: () => void;
}

/** What the flame means: today's state, this week, the next milestone, record, freezes and the three rules. */
export default function StreakSheet({ streak, onClose, onAdd }: StreakSheetProps) {
  useModalScrollLock(true);
  const { closing, close } = useClosing(onClose);
  const n = streak.current;
  const next = MILESTONES.find((m) => m > n) ?? Math.ceil((n + 1) / 100) * 100;
  const base = [...MILESTONES].reverse().find((m) => m <= n) ?? 0;
  const progress = Math.round(((n - base) / Math.max(1, next - base)) * 100);
  const done = streak.todayDone;

  return (
    <div className="uz-sh-overlay" data-closing={closing} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="uz-sh uz-sk" role="dialog" aria-modal="true" aria-label={`Seriya: ${n} kun`}>
        <div className="uz-sh-grab" style={{ background: 'rgba(255,255,255,.25)' }} />
        <div className="uz-sh-head">
          <button type="button" className="uz-qa-round uz-sk-round" aria-label="Yopish" onClick={close}>
            <X size={20} strokeWidth={2.2} />
          </button>
          <h2 style={{ color: '#fff' }}>Seriya</h2>
          <span style={{ width: 44 }} aria-hidden="true" />
        </div>

        <div className="uz-sk-hero" data-done={done}>
          <span className="uz-sk-glow" aria-hidden="true" />
          <Flame size={96} strokeWidth={1.4} color={done ? '#FFD27A' : '#8FA386'} fill={done ? '#FFB020' : 'none'} aria-hidden="true" />
        </div>
        <div className="uz-sk-count">
          <span className="num">{n}</span>
          <span>kun ketma-ket</span>
        </div>
        <div className="uz-sk-state" data-done={done}>
          {done ? <Check size={16} strokeWidth={3} /> : <Flame size={16} strokeWidth={2.4} />}
          {done ? 'Bugun yozildi' : n > 0 ? 'Bugun hali yozilmadi — seriyani saqlang' : 'Birinchi amal bilan boshlang'}
        </div>

        <div className="uz-sk-week" role="list" aria-label="Shu hafta">
          {streak.week.map((d, i) => (
            <div key={d.date} className="uz-sk-day" role="listitem" data-state={d.state}>
              <span>{WEEKDAYS[i]}</span>
              <i>
                {d.state === 'done' && <Check size={16} strokeWidth={3} />}
                {d.state === 'frozen' && <Snowflake size={15} strokeWidth={2.4} />}
              </i>
            </div>
          ))}
        </div>

        <div className="uz-sk-goal" aria-label={`Keyingi marra: ${next} kun`}>
          <div className="uz-sk-goal-top">
            <span className="num">{n}</span>
            <span><Trophy size={15} strokeWidth={2.2} color="#FFB020" aria-hidden="true" /> <b className="num">{next}</b> kun</span>
          </div>
          <div className="uz-sk-bar"><span style={{ width: `${progress}%` }} /></div>
        </div>

        <div className="uz-sk-stats">
          <div>
            <Trophy size={20} color="#FFB020" aria-hidden="true" />
            <b className="num">{streak.best}</b>
            <span>Rekord</span>
          </div>
          <div>
            <Snowflake size={20} color="#9AD7FF" aria-hidden="true" />
            <b className="num">{streak.freezesLeft}</b>
            <span>Muzlatish</span>
          </div>
        </div>

        <ul className="uz-sk-rules">
          <li><Plus size={16} strokeWidth={2.6} aria-hidden="true" /> Har kuni kamida bitta amal yozing</li>
          <li><Snowflake size={16} strokeWidth={2.4} aria-hidden="true" /> Haftada 1 kun o‘tkazsangiz, muzlatish seriyani saqlaydi</li>
          <li><RotateCcw size={16} strokeWidth={2.4} aria-hidden="true" /> 2 kun ketma-ket o‘tkazilsa, seriya 0 dan boshlanadi</li>
        </ul>

        {done ? (
          <button type="button" className="uz-qa-save uz-sk-btn" onClick={close}>Zo‘r!</button>
        ) : (
          <button type="button" className="uz-qa-save uz-sk-btn" onClick={onAdd}>
            <Plus size={20} strokeWidth={2.8} /> Bugungi amalni qo‘shish
          </button>
        )}
      </div>
    </div>
  );
}
