'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import type { Category, CategoryType } from '@/types/database';
import { getCategoryMeta } from '@/components/categories/CategoryIcon';
import { useI18n } from '@/lib/i18n/client';
import { categoryLabel } from '@/lib/i18n/format';
import { getCategoryDisplayName } from '@/lib/categories/schemas';
import { TxListSkeleton } from '@/components/mobile/TxRows';
import { useClosing } from '@/lib/ui/useClosing';

type SheetState = { mode: 'new' } | { mode: 'edit'; category: Category } | { mode: 'delete'; category: Category } | null;

/**
 * Categories in the new phone design: one list per type. Your own categories open an edit sheet;
 * built-in ones are shown for reference only (they cannot be changed), so they have no chevron.
 */
export default function CategoriesManager() {
  const { t, lang } = useI18n();
  /** Server errors are Uzbek: show them as-is only to Uzbek readers. */
  const serverError = (msg: unknown, fallback: string) => (lang === 'uz' && typeof msg === 'string' && msg ? msg : fallback);
  const displayName = (c: Category) => (lang === 'uz' ? getCategoryDisplayName(c.name) : categoryLabel(c.name, lang));
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<CategoryType>('expense');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/categories', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(serverError(data.error, t.categories.loadError));
        if (active) {
          setCategories(data.categories || []);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => active && setLoadError(err instanceof Error ? err.message : t.categories.loadError))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const refresh = () => setReload((n) => n + 1);
  const list = categories.filter((c) => c.type === type);
  const own = list.filter((c) => !c.is_system);
  const builtIn = list.filter((c) => c.is_system);
  const txType = type === 'income' ? 'in' : 'ex';

  const save = async (name: string, newType: CategoryType, editing?: Category): Promise<string | null> => {
    const payload = {
      name,
      type: editing ? editing.type : newType,
      description: editing?.description ?? null,
      icon: editing?.icon ?? null,
      color: editing?.color ?? null,
    };
    const res = await fetch(editing ? `/api/categories/${editing.id}` : '/api/categories', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!res) return t.common.checkInternet;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return serverError(data.error, t.common.cannotSave);
    setSheet(null);
    setToast(editing ? t.common.saved : t.common.added);
    if (!editing) setType(newType);
    refresh();
    return null;
  };

  const remove = async (category: Category): Promise<string | null> => {
    const res = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res) return t.common.checkInternet;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return serverError(data.error, t.common.cannotDelete);
    setSheet(null);
    setToast(t.common.deleted);
    refresh();
    return null;
  };

  const row = (c: Category, editable: boolean) => {
    const meta = getCategoryMeta(c.name, txType);
    const Icon = meta.icon;
    const content = (
      <>
        <span className="uz-m-row-ic" style={{ background: meta.bg, color: meta.color }}>
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="uz-m-row-main">
          <span className="uz-m-row-name">{displayName(c)}</span>
        </span>
        {editable && <ChevronRight size={18} color="#AEB4AA" aria-hidden="true" />}
      </>
    );
    return editable ? (
      <button key={c.id} type="button" className="uz-m-row" onClick={() => setSheet({ mode: 'edit', category: c })}>
        {content}
      </button>
    ) : (
      <div key={c.id} className="uz-m-row" style={{ cursor: 'default' }}>
        {content}
      </div>
    );
  };

  return (
    <div id="categories-container" className="uz-page">
      <header className="uz-page-head">
        <Link href="/settings" aria-label={t.common.back} className="uz-page-back">
          <ChevronLeft size={22} />
        </Link>
        <h1>{t.categories.title}</h1>
        <button type="button" id="add-category-btn" className="uz-page-add" aria-label={t.categories.add} onClick={() => setSheet({ mode: 'new' })}>
          <Plus size={22} strokeWidth={2.6} />
        </button>
      </header>

      <div className="uz-m-seg" role="group" aria-label={t.common.type}>
        <button type="button" aria-pressed={type === 'expense'} onClick={() => setType('expense')}>{t.common.expense}</button>
        <button type="button" aria-pressed={type === 'income'} onClick={() => setType('income')}>{t.common.income}</button>
      </div>

      {loading ? (
        <TxListSkeleton count={6} />
      ) : loadError ? (
        <div className="uz-m-empty" role="alert">
          <span>{loadError}</span>
          <button type="button" className="uz-page-retry" onClick={() => { setLoading(true); refresh(); }}>{t.common.reload}</button>
        </div>
      ) : (
        <>
          <section className="uz-m-section">
            <h2 className="uz-page-sub">{t.categories.yours}</h2>
            {own.length ? (
              <div className="uz-m-list">{own.map((c) => row(c, true))}</div>
            ) : (
              <button type="button" className="uz-m-empty" onClick={() => setSheet({ mode: 'new' })}>
                <span className="uz-m-empty-ic"><Plus size={26} strokeWidth={2.6} /></span>
                <span>{t.categories.yourOwn}</span>
              </button>
            )}
          </section>
          {builtIn.length > 0 && (
            <section className="uz-m-section">
              <h2 className="uz-page-sub">{t.categories.standard}</h2>
              <div className="uz-m-list">{builtIn.map((c) => row(c, false))}</div>
            </section>
          )}
        </>
      )}

      {(sheet?.mode === 'new' || sheet?.mode === 'edit') && (
        <CategorySheet
          editing={sheet.mode === 'edit' ? sheet.category : undefined}
          defaultType={type}
          onClose={() => setSheet(null)}
          onSave={save}
          onDelete={sheet.mode === 'edit' ? () => setSheet({ mode: 'delete', category: sheet.category }) : undefined}
        />
      )}
      {sheet?.mode === 'delete' && (
        <DeleteSheet category={sheet.category} onCancel={() => setSheet(null)} onConfirm={() => remove(sheet.category)} />
      )}

      {toast && (
        <div role="status" className="uz-toast">
          <Check size={18} color="#9FE870" strokeWidth={2.6} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

function CategorySheet({
  editing,
  defaultType,
  onClose,
  onSave,
  onDelete,
}: {
  editing?: Category;
  defaultType: CategoryType;
  onClose: () => void;
  onSave: (name: string, type: CategoryType, editing?: Category) => Promise<string | null>;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState<CategoryType>(editing?.type ?? defaultType);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = getCategoryMeta(name || undefined, type === 'income' ? 'in' : 'ex');
  const Icon = meta.icon;
  const changed = name.trim() && name.trim() !== editing?.name;
  const { closing, close } = useClosing(onClose);

  const submit = async () => {
    if (!changed || busy) return;
    setBusy(true);
    setError(await onSave(name.trim(), type, editing));
    setBusy(false);
  };

  return (
    <div className="uz-sh-overlay" data-closing={closing} onClick={(e) => e.target === e.currentTarget && !busy && close()}>
      <div className="uz-sh" role="dialog" aria-modal="true" aria-label={editing ? t.categories.category : t.categories.newCategory}>
        <div className="uz-sh-grab" />
        <div className="uz-sh-head">
          <button type="button" className="uz-qa-round" aria-label={t.common.close} onClick={close}>
            <X size={20} strokeWidth={2.2} />
          </button>
          <h2>{editing ? t.categories.category : t.categories.newCategory}</h2>
          <span style={{ width: 44 }} aria-hidden="true" />
        </div>

        <div style={{ display: 'grid', placeItems: 'center' }}>
          <span className="uz-qa-fav-ic" style={{ width: 72, height: 72, background: meta.bg, color: meta.color }}>
            <Icon size={32} strokeWidth={2} />
          </span>
        </div>
        <input
          className="uz-qa-desc"
          style={{ alignSelf: 'center' }}
          value={name}
          maxLength={50}
          placeholder={t.categories.namePlaceholder}
          aria-label={t.categories.nameAria}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        {!editing && (
          <div className="uz-m-seg" role="group" aria-label={t.common.type}>
            <button type="button" aria-pressed={type === 'expense'} onClick={() => setType('expense')}>{t.common.expense}</button>
            <button type="button" aria-pressed={type === 'income'} onClick={() => setType('income')}>{t.common.income}</button>
          </div>
        )}
        {error && <div className="uz-qa-error" role="alert">{error}</div>}

        <div className="uz-sh-foot">
          {onDelete && (
            <button type="button" className="uz-qa-trash" aria-label={t.categories.deleteAria} onClick={onDelete} disabled={busy}>
              <Trash2 size={22} strokeWidth={2.2} />
            </button>
          )}
          <button type="button" className="uz-qa-save" disabled={!changed || busy} onClick={submit}>
            <Check size={20} strokeWidth={2.8} /> {busy ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteSheet({ category, onCancel, onConfirm }: { category: Category; onCancel: () => void; onConfirm: () => Promise<string | null> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { closing, close } = useClosing(onCancel);
  return (
    <div className="uz-sh-overlay" data-closing={closing} onClick={(e) => e.target === e.currentTarget && !busy && close()}>
      <div className="uz-sh" role="alertdialog" aria-modal="true" aria-label={t.categories.confirmDeleteAria}>
        <div className="uz-sh-grab" />
        <div className="uz-sh-confirm">
          <span className="uz-sh-confirm-ic"><Trash2 size={26} strokeWidth={2.2} /></span>
          <h2>{t.categories.confirmDelete(category.name)}</h2>
          <p>{t.categories.deleteHint}</p>
          {error && <div className="uz-qa-error" role="alert">{error}</div>}
          <button
            type="button"
            className="uz-sh-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(await onConfirm());
              setBusy(false);
            }}
          >
            {busy ? t.common.deleting : t.common.delete}
          </button>
          <button type="button" className="uz-sh-plain" onClick={close} disabled={busy}>
            {t.common.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
