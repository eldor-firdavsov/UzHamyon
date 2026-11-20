'use client';

import React from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Plus } from 'lucide-react';
import type { StreakSummary } from '@/lib/streak/compute';
import { StreakWeek } from '@/components/streak/StreakParts';
import { TxFlatList, TxListSkeleton, groupNumber, type TxRowData } from './TxRows';
import { useCountUp } from '@/lib/ui/useCountUp';

interface HomeMobileProps {
  balance: number;
  monthIncome: number;
  monthExpense: number;
  streak: StreakSummary | null;
  recent: TxRowData[];
  today: string;
  loading: boolean;
  onOpenTx: (t: TxRowData) => void;
  onSeeAll: () => void;
  onAdd: () => void;
}

/** Phone home: balance, this week's streak, last few entries. Numbers over words. */
export default function HomeMobile({
  balance,
  monthIncome,
  monthExpense,
  streak,
  recent,
  today,
  loading,
  onOpenTx,
  onSeeAll,
  onAdd,
}: HomeMobileProps) {
  // Start from 0 on first show so the balance visibly counts up.
  const bal = useCountUp(loading ? 0 : balance);
  const inc = useCountUp(loading ? 0 : monthIncome);
  const exp = useCountUp(loading ? 0 : monthExpense);
  return (
    <div className="uz-m-page" data-page="home">
      <section className="uz-m-hero" aria-label="Balans">
        <div className="uz-m-hero-bal" data-neg={balance < 0}>
          {loading ? (
            <span className="uz-skel uz-skel-dark" style={{ width: 220, height: 40 }} aria-label="Yuklanmoqda" />
          ) : (
            <span className="num">{bal < 0 ? '−' : ''}{groupNumber(bal)}</span>
          )}
          <span className="uz-m-hero-cur">so‘m</span>
        </div>
        <div className="uz-m-hero-pills">
          <div className="uz-m-hero-pill" data-kind="in" aria-label={`Shu oy kirim ${groupNumber(monthIncome)} so‘m`}>
            <span className="uz-m-hero-dot" data-kind="in"><ArrowDown size={15} strokeWidth={2.6} /></span>
            <span className="num">{groupNumber(inc)}</span>
          </div>
          <div className="uz-m-hero-pill" data-kind="ex" aria-label={`Shu oy chiqim ${groupNumber(monthExpense)} so‘m`}>
            <span className="uz-m-hero-dot" data-kind="ex"><ArrowUp size={15} strokeWidth={2.6} /></span>
            <span className="num">{groupNumber(exp)}</span>
          </div>
        </div>
      </section>

      {streak && <StreakWeek streak={streak} />}

      <section className="uz-m-section">
        <header className="uz-m-section-hd">
          <h2>Oxirgi</h2>
          {recent.length > 0 && (
            <button type="button" className="uz-m-icon-btn" aria-label="Barcha amallar" onClick={onSeeAll}>
              <ChevronRight size={22} strokeWidth={2.2} />
            </button>
          )}
        </header>
        {loading ? (
          <TxListSkeleton count={3} />
        ) : recent.length === 0 ? (
          <button type="button" className="uz-m-empty" onClick={onAdd}>
            <span className="uz-m-empty-ic"><Plus size={26} strokeWidth={2.6} /></span>
            <span>Birinchi amal</span>
          </button>
        ) : (
          <TxFlatList rows={recent} today={today} onOpen={onOpenTx} />
        )}
      </section>
    </div>
  );
}
