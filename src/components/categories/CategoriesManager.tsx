'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import type { Category, CategoryType } from '@/types/database';
import { getCategoryMeta } from '@/components/categories/CategoryIcon';
import { getCategoryDisplayName } from '@/lib/categories/schemas';
import { TxListSkeleton } from '@/components/mobile/TxRows';

type SheetState = { mode: 'new' } | { mode: 'edit'; category: Category } | { mode: 'delete'; category: Category } | null;

/**
 * Categories in the new phone design: one list per type. Your own categories open an edit sheet;
 * built-in ones are shown for reference only (they cannot be changed), so they have no chevron.
 */
export default function CategoriesManager() {
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
        if (!res.ok) throw new Error(data.error || 'Kategoriyalarni yuklab bo‘lmadi');
        if (active) {
          setCategories(data.categories || []);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => active && setLoadError(err instanceof Error ? err.message : 'Kategoriyalarni yuklab bo‘lmadi'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
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
    if (!res) return 'Internet aloqasini tekshiring.';
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || 'Saqlab bo‘lmadi.';
    setSheet(null);
    setToast(editing ? 'Saqlandi' : 'Qo‘shildi');
    if (!editing) setType(newType);
    refresh();
    return null;
  };

  const remove = async (category: Category): Promise<string | null> => {
    const res = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res) return 'Internet aloqasini tekshiring.';
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || 'O‘chirib bo‘lmadi.';
    setSheet(null);
    setToast('O‘chirildi');
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
          <span className="uz-m-row-name">{getCategoryDisplayName(c.name)}</span>
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
        <Link href="/settings" aria-label="Orqaga" className="uz-page-back">
          <ChevronLeft size={22} />
        </Link>
        <h1>Kategoriyalar</h1>
        <button type="button" id="add-category-btn" className="uz-page-add" aria-label="Kategoriya qo‘shish" onClick={() => setSheet({ mode: 'new' })}>
          <Plus size={22} strokeWidth={2.6} />
        </button>
      </header>

      <div className="uz-m-seg" role="group" aria-label="Turi">
        <button type="button" aria-pressed={type === 'expense'} onClick={() => setType('expense')}>Chiqim</button>
        <button type="button" aria-pressed={type === 'income'} onClick={() => setType('income')}>Kirim</button>
      </div>

      {loading ? (
        <TxListSkeleton count={6} />
      ) : loadError ? (
        <div className="uz-m-empty" role="alert">
          <span>{loadError}</span>
          <button type="button" className="uz-page-retry" onClick={() => { setLoading(true); refresh(); }}>Qayta yuklash</button>
        </div>
      ) : (
        <>
          <section className="uz-m-section">
            <h2 className="uz-page-sub">Sizniki</h2>
            {own.length ? (
              <div className="uz-m-list">{own.map((c) => row(c, true))}</div>
            ) : (
              <button type="button" className="uz-m-empty" onClick={() => setSheet({ mode: 'new' })}>
                <span className="uz-m-empty-ic"><Plus size={26} strokeWidth={2.6} /></span>
                <span>O‘z kategoriyangiz</span>
              </button>
            )}
          </section>
          {builtIn.length > 0 && (
            <section className="uz-m-section">
              <h2 className="uz-page-sub">Standart</h2>
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
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState<CategoryType>(editing?.type ?? defaultType);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = getCategoryMeta(name || undefined, type === 'income' ? 'in' : 'ex');
  const Icon = meta.icon;
  const changed = name.trim() && name.trim() !== editing?.name;

  const submit = async () => {
    if (!changed || busy) return;
    setBusy(true);
    setError(await onSave(name.trim(), type, editing));
    setBusy(false);
  };

  return (
    <div className="uz-sh-overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="uz-sh" role="dialog" aria-modal="true" aria-label={editing ? 'Kategoriya' : 'Yangi kategoriya'}>
        <div className="uz-sh-grab" />
        <div className="uz-sh-head">
          <button type="button" className="uz-qa-round" aria-label="Yopish" onClick={onClose}>
            <X size={20} strokeWidth={2.2} />
          </button>
          <h2>{editing ? 'Kategoriya' : 'Yangi kategoriya'}</h2>
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
          placeholder="Nomi"
          aria-label="Kategoriya nomi"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        {!editing && (
          <div className="uz-m-seg" role="group" aria-label="Turi">
            <button type="button" aria-pressed={type === 'expense'} onClick={() => setType('expense')}>Chiqim</button>
            <button type="button" aria-pressed={type === 'income'} onClick={() => setType('income')}>Kirim</button>
          </div>
        )}
        {error && <div className="uz-qa-error" role="alert">{error}</div>}

        <div className="uz-sh-foot">
          {onDelete && (
            <button type="button" className="uz-qa-trash" aria-label="Kategoriyani o‘chirish" onClick={onDelete} disabled={busy}>
              <Trash2 size={22} strokeWidth={2.2} />
            </button>
          )}
          <button type="button" className="uz-qa-save" disabled={!changed || busy} onClick={submit}>
            <Check size={20} strokeWidth={2.8} /> {busy ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteSheet({ category, onCancel, onConfirm }: { category: Category; onCancel: () => void; onConfirm: () => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="uz-sh-overlay" onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="uz-sh" role="alertdialog" aria-modal="true" aria-label="Kategoriya o‘chirilsinmi?">
        <div className="uz-sh-grab" />
        <div className="uz-sh-confirm">
          <span className="uz-sh-confirm-ic"><Trash2 size={26} strokeWidth={2.2} /></span>
          <h2>“{category.name}” o‘chirilsinmi?</h2>
          <p>Uning amallari kategoriyasiz qoladi.</p>
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
            {busy ? 'O‘chirilmoqda…' : 'O‘chirish'}
          </button>
          <button type="button" className="uz-sh-plain" onClick={onCancel} disabled={busy}>
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
}
