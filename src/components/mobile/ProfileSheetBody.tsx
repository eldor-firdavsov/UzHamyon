'use client';

import React from 'react';
import { ChevronRight, Download, Flame, LayoutGrid, Settings, Snowflake, Trophy } from 'lucide-react';
import { formatAmount, type DisplayCurrency, type FxRate } from '@/lib/fx/currency';
import { haptic } from '@/lib/ui/haptics';
import type { StreakSummary } from '@/lib/streak/compute';

interface ProfileSheetBodyProps {
  userName: string;
  userEmail?: string | null;
  streak: StreakSummary | null;
  /** Currency the whole app is shown in. */
  currency?: DisplayCurrency;
  fx?: FxRate;
  currencyBusy?: boolean;
  onCurrencyChange?: (next: DisplayCurrency) => void;
  onLogout: () => void;
}

const SHORT_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

function rateNote(fx: FxRate): string {
  const rate = `1 $ = ${formatAmount(fx.usdUzs, 'UZS')} so‘m`;
  if (fx.source === 'fallback') return `${rate} · taxminiy kurs`;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(fx.date) ? `${Number(fx.date.slice(8, 10))}-${SHORT_MONTHS[Number(fx.date.slice(5, 7)) - 1]}` : '';
  const who = fx.source === 'cbu' ? 'Markaziy bank kursi' : 'bozor kursi';
  return `${rate} · ${who}${d ? `, ${d}` : ''}`;
}

const OPTIONS: Array<{ value: DisplayCurrency; symbol: string; label: string }> = [
  { value: 'UZS', symbol: 'so‘m', label: 'So‘m' },
  { value: 'USD', symbol: '$', label: 'Dollar' },
];

/** Two-option switch with a sliding thumb: every amount in the app follows it. */
function CurrencySwitch({
  value,
  fx,
  busy,
  onChange,
}: {
  value: DisplayCurrency;
  fx?: FxRate;
  busy?: boolean;
  onChange: (next: DisplayCurrency) => void;
}) {
  return (
    <section className="uz-p-cur" aria-labelledby="uz-p-cur-title">
      <div className="uz-p-cur-head">
        <span id="uz-p-cur-title" className="uz-p-link-label">Valyuta</span>
        <span className="uz-m-row-sub">Barcha summalar shu valyutada</span>
      </div>
      <div className="uz-cur-seg" role="radiogroup" aria-label="Valyuta" data-value={value} aria-busy={busy || undefined}>
        <span className="uz-cur-seg-thumb" aria-hidden="true" />
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={busy}
            onClick={() => {
              if (value === o.value) return;
              haptic('light');
              onChange(o.value);
            }}
          >
            <span className="uz-cur-seg-sym">{o.symbol}</span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      {fx && <p className="uz-p-cur-note">{rateNote(fx)}</p>}
    </section>
  );
}

const LINKS = [
  { href: '/settings', label: 'Sozlamalar', bg: '#6B7068', Icon: Settings },
  { href: '/categories', label: 'Kategoriyalar', bg: '#7A5AE0', Icon: LayoutGrid },
  { href: '/imports', label: 'Import', bg: '#2457C5', Icon: Download },
];

/** Profile: who you are, your streak in three numbers, a short settings list. */
export default function ProfileSheetBody({
  userName,
  userEmail,
  streak,
  currency = 'UZS',
  fx,
  currencyBusy,
  onCurrencyChange,
  onLogout,
}: ProfileSheetBodyProps) {
  const name = userName.trim();
  return (
    <div className="uz-p">
      <div className="uz-p-head">
        <div className="uz-p-avatar" aria-hidden="true">{name ? name[0].toUpperCase() : '?'}</div>
        <div className="uz-p-name">{name || 'Profil'}</div>
        {userEmail && <div className="uz-m-row-sub">{userEmail}</div>}
      </div>

      {streak && (
        <div className="uz-p-stats">
          <div className="uz-p-stat" aria-label={`Hozirgi seriya ${streak.current} kun`}>
            <Flame size={22} color="#E8930C" fill="#FFB020" aria-hidden="true" />
            <span className="num">{streak.current}</span>
            <span>Hozir</span>
          </div>
          <div className="uz-p-stat" aria-label={`Eng uzun seriya ${streak.best} kun`}>
            <Trophy size={22} color="#B8860B" aria-hidden="true" />
            <span className="num">{streak.best}</span>
            <span>Rekord</span>
          </div>
          <div className="uz-p-stat" aria-label={`Shu hafta muzlatish: ${streak.freezesLeft}`}>
            <Snowflake size={22} color="#3B8FD9" aria-hidden="true" />
            <span className="num">{streak.freezesLeft}</span>
            <span>Muzlatish</span>
          </div>
        </div>
      )}

      {onCurrencyChange && <CurrencySwitch value={currency} fx={fx} busy={currencyBusy} onChange={onCurrencyChange} />}

      <div className="uz-m-list">
        {LINKS.map(({ href, label, bg, Icon }) => (
          <a key={href} href={href} className="uz-m-row uz-p-link">
            <span className="uz-p-link-ic" style={{ background: bg }}><Icon size={17} strokeWidth={2.2} /></span>
            <span className="uz-m-row-main"><span className="uz-p-link-label">{label}</span></span>
            <ChevronRight size={16} color="#AEB4AA" aria-hidden="true" />
          </a>
        ))}
      </div>

      <div className="uz-m-list">
        <button type="button" className="uz-m-row uz-p-danger" onClick={onLogout}>
          Hisobdan chiqish
        </button>
      </div>
    </div>
  );
}
