'use client';

import React from 'react';
import { Send } from 'lucide-react';
import { getCategoryMeta } from '@/components/categories/CategoryIcon';
import { dayLabel } from '@/lib/time/dayLabel';
import { formatAmount, formatWithUnit } from '@/lib/fx/currency';

export interface TxRowData {
  id: string;
  type: 'in' | 'ex';
  amount: number;
  cat: string;
  desc: string;
  date: string;
  currency?: string;
  /**
   * Set when the row is shown converted into the display currency:
   * the amount and currency it was actually saved in.
   */
  origAmount?: number;
  origCurrency?: string;
  /** Logged through the Telegram bot. */
  viaBot?: boolean;
  /** Just saved: the row flashes once. */
  fresh?: boolean;
}

export function groupNumber(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function signedAmount(t: Pick<TxRowData, 'type' | 'amount' | 'currency'>): string {
  const usd = (t.currency || 'UZS').toUpperCase() === 'USD';
  return `${t.type === 'in' ? '+' : '−'}${usd ? '$' : ''}${formatAmount(t.amount, usd ? 'USD' : 'UZS')}`;
}

/** "50 000 so‘m" under a converted row, so the user still sees what was saved. */
function originalNote(t: TxRowData): string | null {
  if (!t.origCurrency || t.origAmount === undefined) return null;
  if ((t.origCurrency || 'UZS').toUpperCase() === (t.currency || 'UZS').toUpperCase()) return null;
  return formatWithUnit(t.origAmount, t.origCurrency);
}

function TxRow({ t, sub: daySub, onOpen }: { t: TxRowData; sub?: string; onOpen: (t: TxRowData) => void }) {
  const meta = getCategoryMeta(t.cat, t.type);
  const note = originalNote(t);
  const sub = [daySub, note].filter(Boolean).join(' · ') || undefined;
  const Icon = meta.icon;
  return (
    <button type="button" className="uz-m-row" data-fresh={t.fresh ? 'true' : undefined} onClick={() => onOpen(t)}>
      <span className="uz-m-row-ic" style={{ background: meta.bg, color: meta.color }}>
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="uz-m-row-main">
        <span className="uz-m-row-name">{t.desc || t.cat}</span>
        {sub && <span className="uz-m-row-sub">{sub}</span>}
      </span>
      {t.viaBot && <Send size={14} color="#2AABEE" aria-label="Telegram orqali" />}
      <span className="uz-m-row-amt" data-in={t.type === 'in'}>
        {signedAmount(t)}
      </span>
    </button>
  );
}

/** Flat inset list; each row shows "Bugun / Kecha / 18-noy" under the name. */
export function TxFlatList({ rows, today, onOpen }: { rows: TxRowData[]; today: string; onOpen: (t: TxRowData) => void }) {
  return (
    <div className="uz-m-list">
      {rows.map((t) => (
        <TxRow key={t.id} t={t} sub={dayLabel(t.date, today)} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** Rows grouped by day; the header shows the day and its net total (rows' own display currency). */
export function TxDayGroups({ rows, today, onOpen }: { rows: TxRowData[]; today: string; onOpen: (t: TxRowData) => void }) {
  const groups: Array<{ date: string; rows: TxRowData[] }> = [];
  for (const t of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === t.date) last.rows.push(t);
    else groups.push({ date: t.date, rows: [t] });
  }
  return (
    <div className="uz-m-groups">
      {groups.map((g) => {
        const cur = (g.rows[0]?.currency || 'UZS').toUpperCase();
        const net = g.rows
          .filter((t) => (t.currency || 'UZS').toUpperCase() === cur)
          .reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
        return (
          <section key={g.date} className="uz-m-group">
            <header className="uz-m-group-hd">
              <span>{dayLabel(g.date, today)}</span>
              <span className="num">{net === 0 ? '0' : `${net > 0 ? '+' : '−'}${cur === 'USD' ? '$' : ''}${formatAmount(net, cur)}`}</span>
            </header>
            <div className="uz-m-list">
              {g.rows.map((t) => (
                <TxRow key={t.id} t={t} onOpen={onOpen} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function TxListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="uz-m-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="uz-m-row" style={{ pointerEvents: 'none' }}>
          <span className="uz-m-row-ic uz-skel" />
          <span className="uz-m-row-main" style={{ gap: 6 }}>
            <span className="uz-skel" style={{ width: `${46 + ((i * 17) % 30)}%`, height: 14 }} />
            <span className="uz-skel" style={{ width: 54, height: 11 }} />
          </span>
          <span className="uz-skel" style={{ width: 70, height: 14 }} />
        </div>
      ))}
    </div>
  );
}
