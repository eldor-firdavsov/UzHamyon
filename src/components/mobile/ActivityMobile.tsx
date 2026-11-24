'use client';

import React from 'react';
import { Plus, Search, SearchX } from 'lucide-react';
import { TxDayGroups, TxListSkeleton, type TxRowData } from './TxRows';
import { useI18n } from '@/lib/i18n/client';

type Filter = 'all' | 'in' | 'ex';

interface ActivityMobileProps {
  rows: TxRowData[];
  hasAny: boolean;
  today: string;
  loading: boolean;
  query: string;
  filter: Filter;
  onQuery: (q: string) => void;
  onFilter: (f: Filter) => void;
  onOpenTx: (t: TxRowData) => void;
  onAdd: () => void;
}


/** Phone activity: search, one segmented filter, rows grouped by day. */
export default function ActivityMobile({
  rows,
  hasAny,
  today,
  loading,
  query,
  filter,
  onQuery,
  onFilter,
  onOpenTx,
  onAdd,
}: ActivityMobileProps) {
  const { t } = useI18n();
  const segments: Array<[Filter, string]> = [
    ['all', t.common.all],
    ['ex', t.common.expense],
    ['in', t.common.income],
  ];
  return (
    <div className="uz-m-page" data-page="act">
      <label className="uz-m-search">
        <Search size={17} strokeWidth={2.2} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder={t.activity.search}
          aria-label={t.activity.search}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>

      <div className="uz-m-seg" role="group" aria-label={t.common.type}>
        {segments.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => onFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <TxListSkeleton count={6} />
      ) : !hasAny ? (
        <button type="button" className="uz-m-empty" onClick={onAdd}>
          <span className="uz-m-empty-ic"><Plus size={26} strokeWidth={2.6} /></span>
          <span>{t.common.firstEntry}</span>
        </button>
      ) : rows.length === 0 ? (
        <div className="uz-m-empty" role="status">
          <span className="uz-m-empty-ic" data-muted="true"><SearchX size={24} strokeWidth={2.2} /></span>
          <span>{t.common.notFound}</span>
        </div>
      ) : (
        <TxDayGroups rows={rows} today={today} onOpen={onOpenTx} />
      )}
    </div>
  );
}
