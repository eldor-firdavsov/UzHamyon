'use client';

import React from 'react';
import { ChevronRight, Download, Flame, LayoutGrid, Settings, Snowflake, Trophy } from 'lucide-react';
import { formatAmount, type DisplayCurrency, type FxRate } from '@/lib/fx/currency';
import { haptic } from '@/lib/ui/haptics';
import type { StreakSummary } from '@/lib/streak/compute';
import { useI18n } from '@/lib/i18n/client';
import type { Dict } from '@/lib/i18n/dict';
import type { Lang } from '@/lib/i18n/config';
import { shortDate, somLabel } from '@/lib/i18n/format';

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

function rateNote(fx: FxRate, t: Dict, lang: Lang): string {
  const rate = `1 $ = ${formatAmount(fx.usdUzs, 'UZS')} ${somLabel(lang)}`;
  if (fx.source === 'fallback') return `${rate} · ${t.currency.approxRate}`;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(fx.date) ? shortDate(fx.date, lang) : '';
  const who = fx.source === 'cbu' ? t.currency.cbuRate : t.currency.marketRate;
  return `${rate} · ${who}${d ? `, ${d}` : ''}`;
}

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
  const { t, lang } = useI18n();
  const options: Array<{ value: DisplayCurrency; symbol: string; label: string }> = [
    { value: 'UZS', symbol: somLabel(lang), label: t.currency.som },
    { value: 'USD', symbol: '$', label: t.currency.dollar },
  ];
  return (
    <section className="uz-p-cur" aria-labelledby="uz-p-cur-title">
      <div className="uz-p-cur-head">
        <span id="uz-p-cur-title" className="uz-p-link-label">{t.currency.title}</span>
        <span className="uz-m-row-sub">{t.currency.hint}</span>
      </div>
      <div className="uz-cur-seg" role="radiogroup" aria-label={t.currency.title} data-value={value} aria-busy={busy || undefined}>
        <span className="uz-cur-seg-thumb" aria-hidden="true" />
        {options.map((o) => (
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
      {fx && <p className="uz-p-cur-note">{rateNote(fx, t, lang)}</p>}
    </section>
  );
}

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
  const { t } = useI18n();
  const name = userName.trim();
  const links = [
    { href: '/settings', label: t.profile.settings, bg: '#6B7068', Icon: Settings },
    { href: '/categories', label: t.profile.categories, bg: '#7A5AE0', Icon: LayoutGrid },
    { href: '/imports', label: t.profile.import, bg: '#2457C5', Icon: Download },
  ];
  return (
    <div className="uz-p">
      <div className="uz-p-head">
        <div className="uz-p-avatar" aria-hidden="true">{name ? name[0].toUpperCase() : '?'}</div>
        <div className="uz-p-name">{name || t.sheets.profile}</div>
        {userEmail && <div className="uz-m-row-sub">{userEmail}</div>}
      </div>

      {streak && (
        <div className="uz-p-stats">
          <div className="uz-p-stat" aria-label={t.profile.currentAria(streak.current)}>
            <Flame size={22} color="#E8930C" fill="#FFB020" aria-hidden="true" />
            <span className="num">{streak.current}</span>
            <span>{t.profile.now}</span>
          </div>
          <div className="uz-p-stat" aria-label={t.profile.bestAria(streak.best)}>
            <Trophy size={22} color="#B8860B" aria-hidden="true" />
            <span className="num">{streak.best}</span>
            <span>{t.streak.record}</span>
          </div>
          <div className="uz-p-stat" aria-label={t.profile.freezeAria(streak.freezesLeft)}>
            <Snowflake size={22} color="#3B8FD9" aria-hidden="true" />
            <span className="num">{streak.freezesLeft}</span>
            <span>{t.streak.freeze}</span>
          </div>
        </div>
      )}

      {onCurrencyChange && <CurrencySwitch value={currency} fx={fx} busy={currencyBusy} onChange={onCurrencyChange} />}

      <div className="uz-m-list">
        {links.map(({ href, label, bg, Icon }) => (
          <a key={href} href={href} className="uz-m-row uz-p-link">
            <span className="uz-p-link-ic" style={{ background: bg }}><Icon size={17} strokeWidth={2.2} /></span>
            <span className="uz-m-row-main"><span className="uz-p-link-label">{label}</span></span>
            <ChevronRight size={16} color="#AEB4AA" aria-hidden="true" />
          </a>
        ))}
      </div>

      <div className="uz-m-list">
        <button type="button" className="uz-m-row uz-p-danger" onClick={onLogout}>
          {t.profile.logout}
        </button>
      </div>
    </div>
  );
}
