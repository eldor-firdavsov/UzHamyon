'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Plus, Target } from 'lucide-react';
import { getCategoryMeta } from '@/components/categories/CategoryIcon';
import { shortAmount } from '@/lib/transactions/quickPicks';
import { groupNumber } from './TxRows';

const RING_COLORS = ['#2457C5', '#E8930C', '#3E8E0A', '#7A5AE0', '#C9CFC4'];

export interface TahlilBudget {
  id: string;
  cat: string;
  limit: number;
  spent: number;
}

export interface TahlilGoal {
  id: string;
  name: string;
  target: number;
  saved: number;
}

interface TahlilMobileProps {
  loading?: boolean;
  /** So'm spent per category this month. */
  byCategory: Record<string, number>;
  monthExpense: number;
  prevMonthExpense: number;
  budgets: TahlilBudget[];
  goals: TahlilGoal[];
  onAddBudget: () => void;
  onOpenBudget: (id: string) => void;
  onAddGoal: () => void;
  onOpenGoal: (id: string) => void;
}

function compact(n: number): string {
  return shortAmount(n) || '0';
}

/** Phone analytics: one ring, limits as bars, goals as rings. */
export default function TahlilMobile({
  loading = false,
  byCategory,
  monthExpense,
  prevMonthExpense,
  budgets,
  goals,
  onAddBudget,
  onOpenBudget,
  onAddGoal,
  onOpenGoal,
}: TahlilMobileProps) {
  const sorted = Object.entries(byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
  const slices = [...top, ...(rest > 0 ? [['Boshqa', rest] as [string, number]] : [])].map(([name, v], i) => ({
    name,
    value: v,
    pct: monthExpense > 0 ? Math.round((v / monthExpense) * 100) : 0,
    color: name === 'Boshqa' ? RING_COLORS[4] : RING_COLORS[i] ?? RING_COLORS[4],
  }));

  // conic-gradient with 0.8% gaps between slices.
  let acc = 0;
  const stops: string[] = [];
  for (const s of slices) {
    const share = monthExpense > 0 ? (s.value / monthExpense) * 100 : 0;
    const end = acc + share;
    const gap = slices.length > 1 ? Math.min(0.8, share / 3) : 0;
    stops.push(`${s.color} ${acc}% ${end - gap}%`, `#fff ${end - gap}% ${end}%`);
    acc = end;
  }
  const ring = slices.length ? `conic-gradient(${stops.join(',')})` : '#ECEFE8';

  const change = prevMonthExpense > 0 ? Math.round(((monthExpense - prevMonthExpense) / prevMonthExpense) * 100) : null;

  return (
    <div className="uz-m-page" data-page="tahlil">
      <section className="uz-m-card uz-t-ring-card" aria-label="Xarajatlar taqsimoti">
        {loading ? (
          <>
            <div className="uz-t-ring uz-skel" style={{ borderRadius: '50%' }} aria-label="Yuklanmoqda" />
            <div className="uz-t-legend">
              {[70, 55, 62].map((w) => (
                <span key={w} className="uz-skel" style={{ width: `${w}%`, height: 14 }} />
              ))}
            </div>
          </>
        ) : (
        <>
        <div className="uz-t-ring" style={{ background: ring }} role="img" aria-label={`Shu oy chiqim ${groupNumber(monthExpense)} so‘m`}>
          <div className="uz-t-ring-hole">
            <span className="uz-t-ring-total num">{compact(monthExpense)}</span>
            {change !== null && change !== 0 && (
              <span
                className="uz-t-ring-change"
                data-good={change < 0}
                aria-label={`O‘tgan oyga nisbatan ${change > 0 ? 'ko‘p' : 'kam'} ${Math.abs(change)}%`}
              >
                {change < 0 ? <ArrowDown size={12} strokeWidth={3} /> : <ArrowUp size={12} strokeWidth={3} />}
                {Math.abs(change)}%
              </span>
            )}
          </div>
        </div>
        <div className="uz-t-legend">
          {slices.length === 0 ? (
            <span className="uz-m-row-sub">—</span>
          ) : (
            slices.map((s) => (
              <div key={s.name} className="uz-t-legend-row">
                <span className="uz-t-swatch" style={{ background: s.color }} />
                <span className="uz-t-legend-name">{s.name}</span>
                <span className="uz-t-legend-pct num">{s.pct}%</span>
              </div>
            ))
          )}
        </div>
        </>
        )}
      </section>

      <section className="uz-m-section">
        <header className="uz-m-section-hd">
          <h2>Limitlar</h2>
          <button type="button" className="uz-m-add-btn" aria-label="Limit qo‘shish" onClick={onAddBudget}>
            <Plus size={16} strokeWidth={2.6} />
          </button>
        </header>
        {budgets.length > 0 && (
          <div className="uz-m-list">
            {budgets.map((b) => {
              const meta = getCategoryMeta(b.cat, 'ex');
              const Icon = meta.icon;
              const r = b.limit > 0 ? b.spent / b.limit : 0;
              const over = r >= 1;
              const bar = over ? '#D93A2B' : r >= 0.8 ? '#E8930C' : '#3E8E0A';
              return (
                <button key={b.id} type="button" className="uz-m-row" onClick={() => onOpenBudget(b.id)}>
                  <span className="uz-m-row-ic" style={{ background: meta.bg, color: meta.color }}>
                    <Icon size={20} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="uz-m-row-main" style={{ gap: 7 }}>
                    <span className="uz-t-budget-top">
                      <span className="uz-m-row-name">{b.cat}</span>
                      <span
                        className="num"
                        style={{ color: over ? '#C62F21' : '#6B7068' }}
                        aria-label={over ? `Limitdan ${groupNumber(b.spent - b.limit)} oshdi` : `Qoldi ${groupNumber(b.limit - b.spent)}`}
                      >
                        {over ? `−${groupNumber(b.spent - b.limit)}` : groupNumber(b.limit - b.spent)}
                      </span>
                    </span>
                    <span className="uz-t-bar"><span style={{ width: `${Math.min(100, Math.round(r * 100))}%`, background: bar }} /></span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="uz-m-section">
        <header className="uz-m-section-hd">
          <h2>Maqsadlar</h2>
          <button type="button" className="uz-m-add-btn" aria-label="Maqsad qo‘shish" onClick={onAddGoal}>
            <Plus size={16} strokeWidth={2.6} />
          </button>
        </header>
        {goals.length > 0 && (
          <div className="uz-t-goals">
            {goals.map((g) => {
              const p = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
              return (
                <button key={g.id} type="button" className="uz-m-card uz-t-goal" onClick={() => onOpenGoal(g.id)}>
                  <span className="uz-t-goal-top">
                    <span className="uz-t-goal-ring" style={{ '--p': p } as React.CSSProperties}>
                      <span><Target size={17} strokeWidth={2.2} /></span>
                    </span>
                    <span className="uz-t-goal-pct num">{p}%</span>
                  </span>
                  <span className="uz-t-goal-name">{g.name}</span>
                  <span className="uz-m-row-sub num">{compact(g.saved)} / {compact(g.target)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
