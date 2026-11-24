'use client';

import React from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Plus } from 'lucide-react';
import type { StreakSummary } from '@/lib/streak/compute';
import { StreakWeek } from '@/components/streak/StreakParts';
import { TxFlatList, TxListSkeleton, type TxRowData } from './TxRows';
import { useCountUp } from '@/lib/ui/useCountUp';
import { formatAmount, formatWithUnit, unitLabel, type DisplayCurrency } from '@/lib/fx/currency';
import { useI18n } from '@/lib/i18n/client';

interface HomeMobileProps {
  balance: number;
  /** Currency every number on this screen is in. */
  currency?: DisplayCurrency;
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
  currency = 'UZS',
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
  const { t, lang } = useI18n();
  // Start from 0 on first show so the balance visibly counts up.
  const bal = useCountUp(loading ? 0 : balance);
  const inc = useCountUp(loading ? 0 : monthIncome);
  const exp = useCountUp(loading ? 0 : monthExpense);
  const usd = currency === 'USD';
  // Count-up runs on whole numbers; dollars show cents once the animation lands.
  const show = (animated: number, real: number) => formatAmount(animated === Math.round(real) ? real : animated, currency);
  return (
    <div className="uz-m-page" data-page="home">
      <section className="uz-m-hero" aria-label={t.home.balance}>
        <div className="uz-m-hero-bal" data-neg={balance < 0}>
          {loading ? (
            <span className="uz-skel uz-skel-dark" style={{ width: 220, height: 40 }} aria-label={t.common.loading} />
          ) : (
            <span className="num">{bal < 0 ? '−' : ''}{usd ? '$' : ''}{show(bal, balance)}</span>
          )}
          {!usd && <span className="uz-m-hero-cur">{unitLabel(currency, lang)}</span>}
        </div>
        <div className="uz-m-hero-pills">
          <div className="uz-m-hero-pill" data-kind="in" aria-label={t.home.monthIncome(formatWithUnit(monthIncome, currency, lang))}>
            <span className="uz-m-hero-dot" data-kind="in"><ArrowDown size={15} strokeWidth={2.6} /></span>
            <span className="num">{usd ? '$' : ''}{show(inc, monthIncome)}</span>
          </div>
          <div className="uz-m-hero-pill" data-kind="ex" aria-label={t.home.monthExpense(formatWithUnit(monthExpense, currency, lang))}>
            <span className="uz-m-hero-dot" data-kind="ex"><ArrowUp size={15} strokeWidth={2.6} /></span>
            <span className="num">{usd ? '$' : ''}{show(exp, monthExpense)}</span>
          </div>
        </div>
      </section>

      {streak && <StreakWeek streak={streak} />}

      <section className="uz-m-section">
        <header className="uz-m-section-hd">
          <h2>{t.home.recent}</h2>
          {recent.length > 0 && (
            <button type="button" className="uz-m-icon-btn" aria-label={t.home.allEntries} onClick={onSeeAll}>
              <ChevronRight size={22} strokeWidth={2.2} />
            </button>
          )}
        </header>
        {loading ? (
          <TxListSkeleton count={3} />
        ) : recent.length === 0 ? (
          <button type="button" className="uz-m-empty" onClick={onAdd}>
            <span className="uz-m-empty-ic"><Plus size={26} strokeWidth={2.6} /></span>
            <span>{t.home.firstExpense}</span>
            <span className="uz-m-empty-hint">{t.home.orBot} <b>{t.home.botExample}</b></span>
          </button>
        ) : (
          <TxFlatList rows={recent} today={today} onOpen={onOpenTx} />
        )}
      </section>
    </div>
  );
}
