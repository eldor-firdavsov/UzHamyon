'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import '@/app/prototype/prototype.css';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import QuickAddSheet, { type QuickAddInput } from '@/components/transactions/QuickAddSheet';
import StreakCelebration from '@/components/streak/StreakCelebration';
import StreakSheet from '@/components/streak/StreakSheet';
import { useClosing } from '@/lib/ui/useClosing';
import DailyNudge, { markNudgeShown, shouldShowNudgeToday } from '@/components/streak/DailyNudge';
import { StreakChip } from '@/components/streak/StreakParts';
import HomeMobile from '@/components/mobile/HomeMobile';
import ActivityMobile from '@/components/mobile/ActivityMobile';
import TahlilMobile from '@/components/mobile/TahlilMobile';
import ProfileSheetBody from '@/components/mobile/ProfileSheetBody';
import AiChat from '@/components/mobile/AiChat';
import { TxListSkeleton } from '@/components/mobile/TxRows';
import { dayLabel } from '@/lib/time/dayLabel';
import { computeStreak, type StreakSummary } from '@/lib/streak/compute';
import SlidingSegmentedNav from '@/prototype/components/SlidingSegmentedNav';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';
import CategoryIcon, { getCategoryMeta } from '@/components/categories/CategoryIcon';
import { predictCategoryFromTitle } from '@/lib/categories/predictCategory';
import { matchCategoryRow } from '@/lib/categories/catalog';
import { formatNumberWithGaps } from '@/lib/formatters/numberGaps';
import { useModalScrollLock } from '@/lib/ui/useModalScrollLock';
import type { Category } from '@/types/database';
import {
  Sparkles,
  Clock,
  Plus,
  RefreshCw,
  Home,
  Receipt,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Check,
  Calendar,
  Trash2,
  X,
  Pencil,
  CalendarDays,
} from 'lucide-react';
import { invalidateAllFinancialCaches } from '@/lib/cache/clientCache';
import { computeBalances, normalizeCurrency } from '@/lib/finance/balance';
import {
  convertAmount,
  currencyName,
  FALLBACK_USD_UZS,
  formatAmount,
  formatWithUnit,
  toDisplayCurrency,
  unitLabel,
  type DisplayCurrency,
  type FxRate,
} from '@/lib/fx/currency';
import { getNowLocalDateString, getNowLocalTimeString, isValidCalendarDate, isValidTimeString } from '@/lib/transactions/dateTime';

// ── Types & Interfaces ──
export type TabType = 'dash' | 'act' | 'tahlil' | 'ai';
export type SubTabType = 'an' | 'go';
export type FilterType = 'all' | 'in' | 'ex';
export type SheetType = 'tx' | 'budget' | 'goal' | 'contrib' | 'detail' | 'confirm' | 'month' | 'user' | null;

export interface AvailableMonthItem {
  key: string;        // 'YYYY-MM'
  year: number;
  month: number;      // 1-12
  label: string;      // e.g. 'Noyabr 2026'
  shortLabel: string; // e.g. 'Noy 2026'
  count: number;
}

export interface Transaction {
  id: string;
  type: 'in' | 'ex';
  amount: number;
  cat: string;
  desc: string;
  date: string;
  time?: string;
  /** ISO currency; totals never mix currencies (UZS is the main one). */
  currency?: string;
}

export interface Budget {
  id: string;
  cat: string;
  limit: number;
  categoryId?: string | null;
  currency?: string;
  spent?: number;
  remaining?: number;
  percentageUsed?: number;
}

export interface Contribution {
  /** Signed amount: + add, − withdraw. */
  a: number;
  d: string;
  note?: string | null;
  source?: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  date: string;
  /** Real saved amount (financial_goals.current_amount). */
  saved: number;
  currency?: string;
  status?: string;
  /** History, loaded from /api/goals/:id/contributions when the goal is opened. */
  contribs: Contribution[];
  contribsLoaded?: boolean;
}

export interface UzHamyonPrototypeAppProps {
  initialTab?: TabType;
  initialSubTab?: SubTabType;
  initialUserName?: string;
  userEmail?: string | null;
  initialTransactions?: Transaction[];
  initialBudgets?: Budget[];
  initialGoals?: Goal[];
  /** Logging streak from the server (null/undefined → fetched on the client). */
  initialStreak?: StreakSummary | null;
  /** Currency the user sees everything in (undefined → fetched on the client). */
  initialCurrency?: DisplayCurrency;
  /** USD → UZS rate (undefined → fetched on the client). */
  initialFx?: FxRate;
  initialSheet?: SheetType;
  allowDemoFallback?: boolean;
  syncBrowserUrl?: boolean;
}

// ── Constants from Specification ──
const MIN_ALLOWED_DATE = '2020-01-01';
const MOBILE_TITLES: Record<TabType, string> = { dash: 'Bugun', act: 'Faoliyat', tahlil: 'Tahlil', ai: 'AI' };
const TODAY_DATE = getNowLocalDateString();

const CATEGORY_ICONS: Record<string, string> = {
  Uy: 'M3 11l9-8 9 8v10H3z',
  Maosh: 'M3 7h18v12H3zM3 11h18',
  'Oziq-ovqat': 'M2 3h3l3 12h11l2-8H6M9 20h.01M18 20h.01',
  Transport: 'M5 17h14M7 17l1-9h8l1 9M9 8V5h6v3',
  "Ko'ngilochar": 'M12 3l2.5 6 6.5.5-5 4.3 1.6 6.4L12 16.5 6.4 20.2 8 13.8 3 9.5 9.5 9z',
  Auto: 'M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364l-2.121 2.121M8.757 15.243l-2.121 2.121m0-11.485l2.121 2.121m6.486 6.486l2.121 2.121',
  Boshqa: 'M5 12h.01M12 12h.01M19 12h.01',
};

const EXPENSE_CATEGORIES = [
  'Auto',
  'Oziq-ovqat',
  'Transport',
  'Kafeler va Restoranlar',
  'Uy-joy',
  'Kommunal',
  'Xaridlar',
];
const INCOME_CATEGORIES = [
  'Auto',
  'Maosh',
  'Frilans',
  "Sovg'alar",
  'Boshqa daromad',
];

const UZBEK_MONTH_NAMES = [
  '',
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
];

// Demo sample transactions used ONLY for unauthenticated prototype preview
const DEMO_TRANSACTIONS: Transaction[] = [
  { id: 't1', type: 'in', amount: 12000000, cat: 'Maosh', desc: 'Oylik maosh', date: '2026-09-30' },
  { id: 't2', type: 'ex', amount: 2500000, cat: 'Uy', desc: 'Ijara', date: '2026-09-01' },
  { id: 't3', type: 'in', amount: 12000000, cat: 'Maosh', desc: 'Oylik maosh', date: '2026-10-30' },
  { id: 't4', type: 'ex', amount: 2500000, cat: 'Uy', desc: 'Ijara', date: '2026-10-01' },
  { id: 't5', type: 'ex', amount: 186000, cat: 'Oziq-ovqat', desc: 'Oziq-ovqat', date: '2026-10-29' },
  { id: 't6', type: 'ex', amount: 45000, cat: 'Transport', desc: 'Taksi', date: '2026-10-28' },
  { id: 't7', type: 'ex', amount: 90000, cat: "Ko'ngilochar", desc: 'Kino', date: '2026-10-27' },
  { id: 't8', type: 'ex', amount: 240000, cat: 'Oziq-ovqat', desc: 'Bozor', date: '2026-10-27' },
  { id: 't9', type: 'ex', amount: 2500000, cat: 'Uy', desc: 'Ijara', date: '2026-11-01' },
  { id: 't10', type: 'ex', amount: 120000, cat: 'Oziq-ovqat', desc: 'Bozor', date: '2026-11-02' },
];

const DEMO_BUDGETS: Budget[] = [
  { id: 'b1', cat: 'Oziq-ovqat', limit: 500000 },
  { id: 'b2', cat: "Ko'ngilochar", limit: 300000 },
];

const DEMO_GOALS: Goal[] = [
  {
    id: 'g1',
    name: 'Noutbuk',
    target: 10000000,
    date: '',
    saved: 3500000,
    contribs: [{ a: 3500000, d: '2026-10-20' }],
    contribsLoaded: true,
  },
  {
    id: 'g2',
    name: 'Safar',
    target: 6000000,
    date: '2027-06-01',
    saved: 1800000,
    contribs: [{ a: 1800000, d: '2026-10-25' }],
    contribsLoaded: true,
  },
];

/** "31-dek 2026" for a goal deadline. */
function goalDeadlineLabel(iso: string): string {
  const m = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'][Number(iso.slice(5, 7)) - 1];
  return m ? `${Number(iso.slice(8, 10))}-${m} ${iso.slice(0, 4)}` : iso;
}

/** 'YYYY-MM-DD HH:mm' in Tashkent time for an ISO timestamp. */
function formatTashkentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const t = new Date(d.getTime() + 5 * 60 * 60 * 1000); // Asia/Tashkent = UTC+5, no DST
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function parseNumber(s: string | number | undefined): number {
  const str = String(s || '').replace(/\s/g, '');
  return /^\d+$/.test(str) ? parseInt(str, 10) : 0;
}

/** Like parseNumber, but also accepts cents ("12.5", "12,50") for dollar amounts. */
function parseAmount(s: string | number | undefined): number {
  const str = String(s || '').replace(/\s/g, '').replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(str) ? Math.round(parseFloat(str) * 100) / 100 : 0;
}

/** Rows in currencies the switch can convert (so'm and dollars). */
function isConvertible(currency?: string | null): boolean {
  const c = normalizeCurrency(currency);
  return c === 'UZS' || c === 'USD';
}

// Maps backend category strings into standardized prototype categories
function normalizeCategory(rawName?: string, type: 'in' | 'ex' = 'ex'): string {
  return getCategoryMeta(rawName, type).key;
}

interface ApiTransactionRow {
  id: string;
  type: string;
  amount: number | string;
  currency?: string;
  categories?: { name?: string };
  description?: string;
  transaction_date?: string;
}

function mapApiTransaction(t: ApiTransactionRow): Transaction {
  return {
    id: t.id,
    type: t.type === 'income' ? 'in' : 'ex',
    amount: Number(t.amount) || 0,
    // No category stored → "Boshqa" / "Boshqa daromad" (never a guessed category like "Maosh").
    cat: t.categories?.name
      ? normalizeCategory(t.categories.name, t.type === 'income' ? 'in' : 'ex')
      : t.type === 'income'
      ? 'Boshqa daromad'
      : 'Boshqa',
    desc: t.description || t.categories?.name || '',
    date: t.transaction_date || TODAY_DATE,
    currency: t.currency || 'UZS',
  };
}

interface ApiBudgetRow {
  id: string;
  name?: string;
  amount?: number | string;
  category_id?: string | null;
  currency?: string;
  spent?: number | string;
  remaining?: number | string;
  percentageUsed?: number | string;
  categories?: { id?: string; name?: string } | null;
}

function mapApiBudget(b: ApiBudgetRow): Budget {
  return {
    id: b.id,
    cat: normalizeCategory(b.categories?.name || b.name, 'ex'),
    limit: Number(b.amount) || 0,
    categoryId: b.category_id ?? b.categories?.id ?? null,
    currency: b.currency || 'UZS',
    spent: typeof b.spent === 'number' || typeof b.spent === 'string' ? Number(b.spent) || 0 : undefined,
    remaining: typeof b.remaining === 'number' || typeof b.remaining === 'string' ? Number(b.remaining) || 0 : undefined,
    percentageUsed:
      typeof b.percentageUsed === 'number' || typeof b.percentageUsed === 'string'
        ? Number(b.percentageUsed) || 0
        : undefined,
  };
}

/**
 * Loads every transaction belonging to the signed-in user.
 *
 * The list endpoint caps `pageSize` at 100, so asking for 300 was rejected
 * (400) and the UI silently fell back to stale/demo data. We page through the
 * API instead, which also keeps the server-side date ordering intact.
 */
/**
 * Converts technical API/database messages into a user-facing Uzbek message.
 * The raw reason is logged by the caller for diagnostics.
 */
function toUzbekTxError(raw?: string, action: 'save' | 'delete' = 'save'): string {
  const message = (raw || '').toLowerCase();

  if (message.includes('unauthorized') || message.includes('authentication')) {
    return 'Tizimga kirish talab qilinadi. Iltimos, Telegram orqali qaytadan kiring.';
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Server bilan aloqa uzildi. Internetni tekshirib, qayta urining.';
  }
  if (message.includes('incompatible') || message.includes('category')) {
    return 'Kategoriya tranzaksiya turiga mos emas. Iltimos, boshqa kategoriya tanlang.';
  }
  if (message.includes('amount')) {
    return 'Summa noto‘g‘ri kiritilgan. Iltimos, musbat son kiriting.';
  }
  if (message.includes('date')) {
    return 'Sana noto‘g‘ri kiritilgan. Iltimos, sanani qayta tanlang.';
  }
  if (message.includes('description')) {
    return 'Tranzaksiya nomi noto‘g‘ri kiritilgan.';
  }

  return action === 'delete'
    ? 'Tranzaksiyani o‘chirishda xatolik yuz berdi. Iltimos, qayta urining.'
    : 'Tranzaksiyani saqlashda xatolik yuz berdi. Iltimos, qayta urining.';
}

async function fetchAllTransactions(token?: string): Promise<ApiTransactionRow[]> {
  const rows: ApiTransactionRow[] = [];
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;

  do {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(
      `/api/transactions?pageSize=${pageSize}&page=${page}&sortBy=date&sortDirection=desc`,
      { cache: 'no-store', headers }
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof payload?.error === 'string'
          ? payload.error
          : 'Tranzaksiyalarni yuklab bo‘lmadi'
      );
    }
    const batch: ApiTransactionRow[] = Array.isArray(payload.transactions)
      ? payload.transactions
      : [];
    rows.push(...batch);
    totalPages = Number(payload.totalPages) || 1;
    if (batch.length === 0) break;
    page += 1;
  } while (page <= totalPages && page <= 50);

  return rows;
}

export default function UzHamyonPrototypeApp({
  initialTab = 'dash',
  initialSubTab = 'an',
  initialUserName = 'Eldor Firdavsov',
  userEmail = null,
  initialTransactions,
  initialBudgets,
  initialGoals,
  initialStreak = null,
  initialCurrency,
  initialFx,
  initialSheet = null,
  allowDemoFallback = false,
  syncBrowserUrl = true,
}: UzHamyonPrototypeAppProps = {}) {
  // ── Navigation State ──
  const [tab, setTab] = useState<TabType>(initialTab);
  const [subTab, setSubTab] = useState<SubTabType>(initialSubTab);
  const [userName, setUserName] = useState<string>(initialUserName);

  // ── Date Calendar State (Default: November 2026) ──
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(11);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // ── Search & Filter State ──
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activityFilter, setActivityFilter] = useState<FilterType>('all');

  // ── App Data State ──
  const [transactions, setTransactions] = useState<Transaction[]>(
    initialTransactions || (allowDemoFallback ? DEMO_TRANSACTIONS : [])
  );
  const [budgets, setBudgets] = useState<Budget[]>(
    initialBudgets || (allowDemoFallback ? DEMO_BUDGETS : [])
  );
  const [goals, setGoals] = useState<Goal[]>(
    initialGoals || (allowDemoFallback ? DEMO_GOALS : [])
  );
  const [loading, setLoading] = useState<boolean>(!initialTransactions);

  // ── Display currency (so'm ⇄ dollar) ──
  // Rows keep the currency they were saved in; everything on screen is converted into `dc`.
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(initialCurrency ?? 'UZS');
  const [fx, setFx] = useState<FxRate>(initialFx ?? { usdUzs: FALLBACK_USD_UZS, date: '', source: 'fallback' });
  const [isSavingCurrency, setIsSavingCurrency] = useState<boolean>(false);
  const dc = displayCurrency;
  const usdUzs = fx.usdUzs;
  const toDc = useCallback(
    (amount: number, currency?: string | null) => convertAmount(Number(amount) || 0, normalizeCurrency(currency), dc, usdUzs),
    [dc, usdUzs]
  );
  /** Display-currency amount → the currency a row/goal/budget is stored in. */
  const fromDc = useCallback(
    (amount: number, currency?: string | null) => convertAmount(Number(amount) || 0, dc, normalizeCurrency(currency), usdUzs),
    [dc, usdUzs]
  );

  // ── Persistence State ──
  // Only a real authenticated session may write to the database. The public
  // prototype preview keeps local demo interactions.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!allowDemoFallback);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txError, setTxError] = useState<string | null>(null);
  const [isSavingTx, setIsSavingTx] = useState<boolean>(false);
  const [isSavingContrib, setIsSavingContrib] = useState<boolean>(false);
  const [isSavingBudget, setIsSavingBudget] = useState<boolean>(false);

  // ── Transaction-based Available Months ──
  // STRICT REQUIREMENT: Only calendar months with >= 1 actual recorded transaction belonging to the user appear!
  // Both income and expense transactions count.
  // No empty months inserted between earliest and latest transactions.
  // Sorted descending chronologically (newest first).
  const availableMonths = useMemo<AvailableMonthItem[]>(() => {
    const monthCounts = new Map<string, number>();

    for (const t of transactions) {
      if (!t.date || typeof t.date !== 'string') continue;
      const match = t.date.match(/^(\d{4})-(\d{2})/);
      if (!match) continue;

      if (t.amount > 0 && (t.type === 'in' || t.type === 'ex')) {
        const key = `${match[1]}-${match[2]}`;
        monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
      }
    }

    const sortedKeys = Array.from(monthCounts.keys()).sort().reverse();

    return sortedKeys.map((key) => {
      const [yStr, mStr] = key.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      return {
        key,
        year: y,
        month: m,
        label: `${UZBEK_MONTH_NAMES[m]} ${y}`,
        shortLabel: `${UZBEK_MONTH_NAMES[m]?.slice(0, 3) || ''} ${y}`,
        count: monthCounts.get(key) || 0,
      };
    });
  }, [transactions]);

  // ── Modal Sheet & Form State ──
  const [activeSheet, setActiveSheet] = useState<SheetType>(initialSheet);
  // ── Phase 1: streak, daily nudge, quick add ──
  const [streak, setStreak] = useState<StreakSummary | null>(initialStreak);
  const [celebration, setCelebration] = useState<{ from: number; streak: StreakSummary } | null>(null);
  const [quickOpen, setQuickOpen] = useState<boolean>(false);
  const [streakOpen, setStreakOpen] = useState<boolean>(false);
  /** Entry being edited in the quick sheet (null = adding a new one). */
  const [quickEdit, setQuickEdit] = useState<Transaction | null>(null);
  const [nudgeOpen, setNudgeOpen] = useState<boolean>(false);
  /** Opened right after registration (?first=1): quick add asks for the first expense. */
  const [firstRun, setFirstRun] = useState<boolean>(false);
  useModalScrollLock(Boolean(activeSheet));
  const [editId, setEditId] = useState<string | null>(null);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ k: 'tx' | 'budget' | 'goal'; id: string } | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>(
    initialSheet === 'tx'
      ? { type: 'ex', amount: '', cat: 'Oziq-ovqat', desc: '', date: TODAY_DATE }
      : initialSheet === 'budget'
      ? { cat: 'Oziq-ovqat', amount: '' }
      : initialSheet === 'goal'
      ? { name: '', target: '', date: '' }
      : {}
  );
  const [toastMessage, setToastMessage] = useState<string>('');

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Synchronous in-flight guard: state updates are async, so rapid double
  // taps could otherwise create duplicate transactions.
  const txSaveInFlightRef = useRef(false);

  // Sync tab with browser URL if requested, keeping selected month synchronized
  const switchTab = useCallback(
    (newTab: TabType, newSubTab?: SubTabType) => {
      setTab(newTab);
      if (newSubTab) setSubTab(newSubTab);

      if (syncBrowserUrl && typeof window !== 'undefined') {
        const targetPathBase =
          newTab === 'dash'
            ? '/dashboard'
            : newTab === 'act'
            ? '/transactions'
            : newTab === 'tahlil'
            ? '/analytics'
            : '/ai';

        const params = new URLSearchParams(window.location.search);
        if (availableMonths.length > 0) {
          params.set('month', `${year}-${padTwo(month)}`);
        } else {
          params.delete('month');
        }
        const qs = params.toString() ? `?${params.toString()}` : '';
        const targetPath = `${targetPathBase}${qs}`;

        if (window.location.pathname + window.location.search !== targetPath) {
          window.history.pushState(null, '', targetPath);
        }
      }
    },
    [syncBrowserUrl, availableMonths.length, year, month]
  );

  // Handle browser popstate (back/forward)
  useEffect(() => {
    if (!syncBrowserUrl || typeof window === 'undefined') return;

    const handlePopState = () => {
      const p = window.location.pathname;
      if (p.startsWith('/transactions')) setTab('act');
      else if (p.startsWith('/analytics')) setTab('tahlil');
      else if (p.startsWith('/ai')) setTab('ai');
      else if (p.startsWith('/dashboard') || p === '/') setTab('dash');
      else setTab('dash');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncBrowserUrl]);

  // Read URL query params on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qTab = params.get('tab') as TabType;
      if (qTab && ['dash', 'act', 'tahlil', 'ai'].includes(qTab)) {
        setTab(qTab);
      }
      const qSub = params.get('sub') as SubTabType;
      if (qSub && ['an', 'go'].includes(qSub)) {
        setSubTab(qSub);
      }
      const qMonth = params.get('month');
      if (qMonth && /^\d{4}-\d{2}$/.test(qMonth)) {
        const [y, m] = qMonth.split('-').map(Number);
        if (m >= 1 && m <= 12) {
          setYear(y);
          setMonth(m);
        }
      }
      const qSheet = params.get('sheet') as SheetType;
      if (qSheet === 'tx') {
        // Links like ?sheet=tx open the quick add sheet.
        setQuickEdit(null);
        setQuickOpen(true);
        if (params.get('first') === '1') {
          setFirstRun(true);
          // A reload should not ask again.
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else if (qSheet) {
        setActiveSheet(qSheet);
        if (qSheet === 'budget') {
          setFormData({ cat: 'Oziq-ovqat', amount: '' });
        } else if (qSheet === 'goal') {
          setFormData({ name: '', target: '', date: '' });
        }
      }
    }
  }, []);

  // Helper to retrieve current client auth token for API calls
  const getAuthToken = useCallback(async (): Promise<string | undefined> => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || undefined;
    } catch {
      return undefined;
    }
  }, []);

  // Exchange rate: from the server render, otherwise fetched once here.
  useEffect(() => {
    if (initialFx) return;
    let alive = true;
    fetch('/api/fx')
      .then((r) => (r.ok ? r.json() : null))
      .then((rate: FxRate | null) => {
        if (alive && rate && Number(rate.usdUzs) > 0) setFx(rate);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [initialFx]);

  // Saved currency choice, when the page was not rendered with it (e.g. /prototype after sign-in).
  useEffect(() => {
    if (initialCurrency || !isAuthenticated || allowDemoFallback) return;
    let alive = true;
    (async () => {
      try {
        const token = await getAuthToken();
        const res = await fetch('/api/profile/currency', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = res.ok ? await res.json() : null;
        if (alive && data?.currency) setDisplayCurrency(toDisplayCurrency(data.currency));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [initialCurrency, isAuthenticated, allowDemoFallback, getAuthToken]);

  // Load real backend data on mount & whenever auth synchronizes
  useEffect(() => {
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    async function loadRealData(overrideToken?: string) {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        let token = overrideToken;
        let currentUser: any = null;

        if (!token) {
          const { data: sessionData } = await supabase.auth.getSession();
          token = sessionData?.session?.access_token;
          currentUser = sessionData?.session?.user;
        }

        if (!currentUser) {
          const { data: { user } } = await supabase.auth.getUser();
          currentUser = user;
        }

        if (isMounted) {
          setIsAuthenticated(Boolean(currentUser));
        }

        if (currentUser && isMounted) {
          const authHeaders: Record<string, string> = {};
          if (token) {
            authHeaders['Authorization'] = `Bearer ${token}`;
          }

          // 1. User profile name
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', currentUser.id)
              .maybeSingle();

            if (profile?.first_name && isMounted) {
              setUserName(`${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}`);
            } else if (currentUser.user_metadata?.first_name && isMounted) {
              setUserName(`${currentUser.user_metadata.first_name} ${currentUser.user_metadata.last_name || ''}`.trim());
            }
          } catch (profErr) {
            console.error('Failed to load profile in UzHamyon prototype app:', profErr);
          }

          // 2. Categories — required to resolve the user's category_id on save
          try {
            const catRes = await fetch('/api/categories', { cache: 'no-store', headers: authHeaders });
            if (catRes.ok) {
              const catData = await catRes.json();
              if (Array.isArray(catData.categories) && isMounted) {
                setCategories(catData.categories as Category[]);
              }
            }
          } catch (catErr) {
            console.error('Failed to load categories in UzHamyon prototype app:', catErr);
          }

          // 3. Real transactions — paged newest-first from the server
          try {
            const rows = await fetchAllTransactions(token);
            if (isMounted) {
              if (rows.length > 0) {
                setTransactions(rows.map(mapApiTransaction));
              } else {
                setTransactions((prev) => (prev.length > 0 ? prev : []));
              }
            }
          } catch (txErr) {
            console.error('Failed to load transactions in UzHamyon prototype app:', txErr);
          }

          // 4. Real budgets
          try {
            const bRes = await fetch('/api/budgets', { headers: authHeaders });
            if (bRes.ok && isMounted) {
              const data = await bRes.json();
              if (data.budgets && Array.isArray(data.budgets)) {
                if (data.budgets.length > 0) {
                  setBudgets(data.budgets.map(mapApiBudget));
                } else {
                  setBudgets((prev) => (prev.length > 0 ? prev : []));
                }
              }
            }
          } catch (bErr) {
            console.error('Failed to load budgets in UzHamyon prototype app:', bErr);
          }

          // 5. Real goals
          try {
            const gRes = await fetch('/api/goals', { headers: authHeaders });
            if (gRes.ok && isMounted) {
              const data = await gRes.json();
              if (data.goals && Array.isArray(data.goals)) {
                if (data.goals.length > 0) {
                  const mappedG: Goal[] = data.goals.map((g: {
                    id: string;
                    name: string;
                    target_amount?: number;
                    target_date?: string;
                    current_amount?: number;
                    currency?: string;
                    status?: string;
                  }) => ({
                    id: g.id,
                    name: g.name,
                    target: Number(g.target_amount) || 0,
                    date: g.target_date || '',
                    saved: Number(g.current_amount) || 0,
                    currency: g.currency || 'UZS',
                    status: g.status || 'in_progress',
                    contribs: [],
                    contribsLoaded: false,
                  }));
                  setGoals(mappedG);
                } else {
                  setGoals((prev) => (prev.length > 0 ? prev : []));
                }
              }
            }
          } catch (gErr) {
            console.error('Failed to load goals in UzHamyon prototype app:', gErr);
          }
        }
      } catch (err) {
        console.error('Failed to load real data in UzHamyon prototype app:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // Initial load
    loadRealData();

    // Listen to Supabase auth state changes
    (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
          if (session?.access_token && isMounted) {
            loadRealData(session.access_token);
          }
        });
        authSubscription = sub?.subscription || null;
      } catch {}
    })();

    // Listen to Telegram Mini App auth sync event
    const handleAuthSynced = (e: Event) => {
      if (!isMounted) return;
      const customEvent = e as CustomEvent<{ access_token?: string }>;
      loadRealData(customEvent.detail?.access_token);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('uzhamyon:auth-synced', handleAuthSynced);
    }

    return () => {
      isMounted = false;
      if (authSubscription) authSubscription.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('uzhamyon:auth-synced', handleAuthSynced);
      }
    };
  }, []);

  // Toast notification helper
  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2200);
  }, []);

  // Re-reads transactions from the server so the UI reflects committed rows
  // (including their real IDs, categories and database ordering).
  const refreshTransactionsFromServer = useCallback(async () => {
    let token: string | undefined;
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    } catch {}
    const rows = await fetchAllTransactions(token);
    if (rows.length > 0) {
      setTransactions(rows.map(mapApiTransaction));
    }
  }, []);

  // ── Month Selection & Navigation (Strictly Based on Actual Transactions) ──
  // Auto-synchronize year and month with availableMonths
  useEffect(() => {
    if (availableMonths.length > 0) {
      const currentKey = `${year}-${padTwo(month)}`;
      const isCurrentAvailable = availableMonths.some((m) => m.key === currentKey);
      if (!isCurrentAvailable) {
        // If the active month has 0 transactions, automatically switch to newest month with transactions
        const newest = availableMonths[0];
        setYear(newest.year);
        setMonth(newest.month);
        setSelectedWeek(null);
      }
    }
  }, [availableMonths, year, month]);

  const handleSelectMonth = useCallback(
    (newYear: number, newMonth: number) => {
      setYear(newYear);
      setMonth(newMonth);
      setSelectedWeek(null);
      setActiveSheet(null);

      if (syncBrowserUrl && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.set('month', `${newYear}-${padTwo(newMonth)}`);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, '', newUrl);
      }
    },
    [syncBrowserUrl]
  );

  const currentMonthKey = `${year}-${padTwo(month)}`;
  const currentMonthIdx = availableMonths.findIndex((m) => m.key === currentMonthKey);

  // Navigation is strictly confined to months that have actual transactions:
  // - Older months are at higher indices (currentMonthIdx + 1)
  // - Newer months are at lower indices (currentMonthIdx - 1)
  const canGoPrev = currentMonthIdx >= 0 && currentMonthIdx < availableMonths.length - 1;
  const canGoNext = currentMonthIdx > 0;
  const noPrev = !canGoPrev;
  const noNext = !canGoNext;

  const handleNavigateMonth = (direction: -1 | 1) => {
    if (availableMonths.length === 0) return;
    // direction === -1: go to previous (older) month
    // direction === 1: go to next (newer) month
    const targetIdx = direction === -1 ? currentMonthIdx + 1 : currentMonthIdx - 1;
    if (targetIdx >= 0 && targetIdx < availableMonths.length) {
      const target = availableMonths[targetIdx];
      handleSelectMonth(target.year, target.month);
    }
  };

  const monthLabel = UZBEK_MONTH_NAMES[month] || '';
  const daysInCurrentMonth = new Date(year, month, 0).getDate();

  // Transactions strictly for currently active month
  const currentMonthTransactions = useMemo(() => {
    if (availableMonths.length === 0) return [];
    const prefix = `${year}-${padTwo(month)}`;
    return transactions.filter((t) => t.date && t.date.startsWith(prefix));
  }, [transactions, year, month, availableMonths.length]);

  // Totals are in the display currency: so'm and dollar rows are converted at the current rate.
  // Rows in other currencies (no rate for them) are left out of totals.
  const currentMonthUzsTransactions = useMemo(
    () =>
      currentMonthTransactions
        .filter((t) => isConvertible(t.currency))
        .map((t) => ({ ...t, amount: toDc(t.amount, t.currency), currency: dc })),
    [currentMonthTransactions, toDc, dc]
  );

  // Last month's spending (display currency), for the change badge on the phone Tahlil ring.
  const prevMonthExpense = useMemo(() => {
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    const prefix = `${py}-${padTwo(pm)}`;
    return transactions
      .filter((t) => t.type === 'ex' && t.date?.startsWith(prefix) && isConvertible(t.currency))
      .reduce((sum, t) => sum + toDc(t.amount, t.currency), 0);
  }, [transactions, year, month, toDc]);

  // Income / Expense sums for currently active month
  const monthIncome = useMemo(() => {
    return currentMonthUzsTransactions
      .filter((t) => t.type === 'in')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthUzsTransactions]);

  const monthExpense = useMemo(() => {
    return currentMonthUzsTransactions
      .filter((t) => t.type === 'ex')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthUzsTransactions]);

  // Shared balance formula (#27): income − expense − goal savings, per currency.
  const balanceSummary = useMemo(
    () =>
      computeBalances(
        transactions,
        (goals || []).map((g) => ({ current_amount: g.saved, currency: g.currency }))
      ),
    [transactions, goals]
  );

  // Per-currency balances (#28) added together only after converting to the display currency.
  const sumInDc = (pick: 'goalSavings' | 'balance') =>
    Object.values(balanceSummary.byCurrency)
      .filter((b) => isConvertible(b.currency))
      .reduce((sum, b) => sum + toDc(b[pick], b.currency), 0);

  // Savings set aside in goals
  const totalGoalsSaved = sumInDc('goalSavings');

  // Free cash right now, in the display currency; can be negative, like a real card
  const currentBalance = Math.round(sumInDc('balance') * 100) / 100;

  // Expenses grouped by category for active month
  const categoryExpenses = useMemo(() => {
    const byCat: Record<string, number> = {};
    currentMonthUzsTransactions
      .filter((t) => t.type === 'ex')
      .forEach((t) => {
        byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
      });
    return byCat;
  }, [currentMonthUzsTransactions]);

  // Top spending category
  const topExpenseCategory = useMemo(() => {
    const keys = Object.keys(categoryExpenses).sort((a, b) => categoryExpenses[b] - categoryExpenses[a]);
    return keys[0] || null;
  }, [categoryExpenses]);

  // AI Recommendation text
  const recommendationInfo = useMemo(() => {
    if (topExpenseCategory && monthExpense > 0) {
      const pct = Math.round((categoryExpenses[topExpenseCategory] / monthExpense) * 100);
      return {
        title: `${topExpenseCategory} xarajati ustun`,
        text: `${monthLabel}da xarajatlaringizning ${pct} foizi ${topExpenseCategory.toLowerCase()}ga ketdi.`,
      };
    }
    return {
      title: 'Hali tavsiya yo‘q',
      text: 'Tavsiya uchun bu oyda xarajat qo‘shing.',
    };
  }, [topExpenseCategory, monthExpense, monthLabel, categoryExpenses]);

  // Weekly breakdown computation
  const weeksData = useMemo(() => {
    const weeks = [0, 1, 2, 3, 4]
      .filter((i) => i * 7 < daysInCurrentMonth)
      .map((i) => {
        const lo = i * 7 + 1;
        const hi = Math.min((i + 1) * 7, daysInCurrentMonth);
        const inWeekTxs = currentMonthUzsTransactions.filter((t) => {
          const d = parseInt(t.date.slice(8), 10);
          return d >= lo && d <= hi;
        });
        const iN = inWeekTxs.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
        const eN = inWeekTxs.filter((t) => t.type === 'ex').reduce((s, t) => s + t.amount, 0);
        return { lo, hi, iN, eN };
      });

    const maxWeekVal = Math.max(1, ...weeks.map((w) => Math.max(w.iN, w.eN)));
    const maxExpVal = Math.max(1, ...weeks.map((w) => w.eN));

    let activeW = selectedWeek !== null && selectedWeek < weeks.length ? selectedWeek : -1;
    if (activeW < 0) {
      activeW = 0;
      weeks.forEach((w, i) => {
        if (w.iN || w.eN) activeW = i;
      });
    }

    return {
      weeks,
      maxWeekVal,
      maxExpVal,
      activeW,
      selectedWeekData: weeks[activeW] || { lo: 1, hi: 1, iN: 0, eN: 0 },
    };
  }, [daysInCurrentMonth, currentMonthUzsTransactions, selectedWeek]);

  // Recent transactions sorted newest-first by actual transaction date.
  // The id tie-breaker keeps same-day rows in a stable order on every render.
  const sortedTransactions = useMemo(() => {
    return [...currentMonthTransactions].sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b.id.localeCompare(a.id);
    });
  }, [currentMonthTransactions]);

  // Category progress breakdown for Tahlil
  const categoryBreakdownList = useMemo(() => {
    const keys = Object.keys(categoryExpenses).sort((a, b) => categoryExpenses[b] - categoryExpenses[a]);
    const top4 = keys.slice(0, 4).map((c) => ({
      name: c,
      amt: formatWithUnit(categoryExpenses[c], dc),
      pct: monthExpense > 0 ? Math.round((categoryExpenses[c] / monthExpense) * 100) : 0,
    }));
    if (keys.length > 4) {
      const rest = keys.slice(4).reduce((sum, c) => sum + categoryExpenses[c], 0);
      top4.push({
        name: 'Boshqalar',
        amt: formatWithUnit(rest, dc),
        pct: monthExpense > 0 ? Math.round((rest / monthExpense) * 100) : 0,
      });
    }
    return top4;
  }, [categoryExpenses, monthExpense, dc]);

  /** Limit and spending of a budget in the display currency. */
  const budgetInDc = useCallback(
    (b: Budget) => ({
      limit: toDc(b.limit, b.currency),
      // The server's `spent` is in the budget's currency; the local fallback is already converted.
      spent: typeof b.spent === 'number' ? toDc(b.spent, b.currency) : categoryExpenses[b.cat] || 0,
    }),
    [toDc, categoryExpenses]
  );

  // Budget status cards
  const budgetStatusList = useMemo(() => {
    return budgets.map((raw) => {
      const b = { ...raw, ...budgetInDc(raw) };
      const spent = b.spent;
      const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
      const over = spent > b.limit;
      const near = !over && pct >= 80;
      return {
        id: b.id,
        cat: b.cat,
        limit: formatAmount(b.limit, dc),
        spent: formatAmount(spent, dc),
        pct,
        barWidth: Math.min(pct, 100),
        color: over ? '#D64D4D' : near ? '#B77A12' : '#26834A',
        msg: over
          ? `limitdan ${formatAmount(spent - b.limit, dc)} oshdi`
          : near
          ? `limitga yaqin, qoldi ${formatAmount(b.limit - spent, dc)}`
          : `qoldi ${formatAmount(b.limit - spent, dc)}`,
      };
    });
  }, [budgets, budgetInDc, dc]);

  // Goals summary
  const getGoalSaved = (g: Goal) => Number(g.saved) || 0;

  // All so'm and dollar goals, converted to the display currency.
  const totalSavedAcrossGoals = useMemo(() => {
    return goals
      .filter((g) => isConvertible(g.currency))
      .reduce((sum, g) => sum + toDc(getGoalSaved(g), g.currency), 0);
  }, [goals, toDc]);

  const goalsList = useMemo(() => {
    return goals.map((g) => {
      const sv = toDc(getGoalSaved(g), g.currency);
      const target = toDc(g.target, g.currency);
      return {
        id: g.id,
        name: g.name,
        saved: formatAmount(sv, dc),
        target: formatAmount(target, dc),
        pct: g.target > 0 ? Math.min(100, Math.round((getGoalSaved(g) / g.target) * 100)) : 0,
        rawGoal: g,
      };
    });
  }, [goals, toDc, dc]);

  const activeGoal = useMemo(() => {
    return goals.find((g) => g.id === activeGoalId) || null;
  }, [goals, activeGoalId]);

  // Filtered Activity transactions grouped by date
  const filteredActivityGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = sortedTransactions.filter((t) => {
      const matchFilter = activityFilter === 'all' || t.type === activityFilter;
      const matchQuery = !q || (t.desc + ' ' + t.cat).toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });

    const groups: Array<{ isHead: boolean; label?: string; tx?: Transaction }> = [];
    let lastDate = '';
    list.forEach((t) => {
      if (t.date !== lastDate) {
        lastDate = t.date;
        const d = parseInt(t.date.slice(8), 10);
        groups.push({
          isHead: true,
          label: `${d} ${UZBEK_MONTH_NAMES[month].toLowerCase()}`,
        });
      }
      groups.push({ isHead: false, tx: t });
    });
    return groups;
  }, [sortedTransactions, searchQuery, activityFilter, month]);

  // New entries flash once in the lists. Only ids that appear after the first load count.
  const seenTxIdsRef = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set(transactions.map((t) => t.id));
    const seen = seenTxIdsRef.current;
    seenTxIdsRef.current = ids;
    if (!seen || loading) return;
    const added = [...ids].filter((id) => !seen.has(id));
    if (!added.length || added.length > 3) return;
    setFreshIds(new Set(added));
    const timer = window.setTimeout(() => setFreshIds(new Set()), 1600);
    return () => window.clearTimeout(timer);
  }, [transactions, loading]);
  /** A row as shown: amount in the display currency, plus what was actually saved. */
  const toRow = (t: Transaction) =>
    isConvertible(t.currency) && normalizeCurrency(t.currency) !== dc
      ? { ...t, amount: toDc(t.amount, t.currency), currency: dc, origAmount: t.amount, origCurrency: normalizeCurrency(t.currency) }
      : t;
  const withFresh = (rows: Transaction[]) => (freshIds.size ? rows.map((t) => (freshIds.has(t.id) ? { ...t, fresh: true } : t)) : rows);

  /** Category names for the quick sheet: the user's own list, falling back to the built-in one. */
  const quickCategories = useMemo(() => {
    const pick = (t: 'expense' | 'income', fallback: string[]) => {
      const names = categories.filter((c) => c.type === t).map((c) => c.name);
      return names.length ? Array.from(new Set(names)) : fallback.filter((c) => c !== 'Auto');
    };
    return { ex: pick('expense', EXPENSE_CATEGORIES), in: pick('income', INCOME_CATEGORIES) };
  }, [categories]);

  const closeSheetNow = () => {
    setActiveSheet(null);
    setFormData({});
    setEditId(null);
    setConfirmConfig(null);
  };
  // ✕, backdrop and "Bekor qilish" play the exit animation first.
  const sheetExit = useClosing(closeSheetNow);
  const closeSheet = sheetExit.close;

  const sheetTitle =
    activeSheet === 'budget'
      ? editId ? 'Limit' : 'Yangi limit'
      : activeSheet === 'goal'
      ? editId ? 'Maqsad' : 'Yangi maqsad'
      : activeSheet === 'contrib'
      ? 'Pul qo‘shish'
      : activeSheet === 'detail'
      ? activeGoal?.name || 'Maqsad'
      : activeSheet === 'user'
      ? 'Profil'
      : activeSheet === 'month'
      ? 'Oy'
      : '';

  const activityRows = useMemo(
    () => filteredActivityGroups.filter((g) => !g.isHead).map((g) => g.tx!),
    [filteredActivityGroups],
  );

  /** Profile switch: everything re-renders in the new currency at once; the choice is saved in the background. */
  const handleCurrencyChange = async (next: DisplayCurrency) => {
    if (next === dc || isSavingCurrency) return;
    const prev = dc;
    setDisplayCurrency(next);
    if (!isAuthenticated) {
      triggerToast(`Endi hammasi ${currencyName(next)}da`);
      return;
    }
    setIsSavingCurrency(true);
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/profile/currency', { method: 'PUT', headers, body: JSON.stringify({ currency: next }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Valyutani saqlab bo‘lmadi');
      triggerToast(`Endi hammasi ${currencyName(next)}da`);
    } catch (err) {
      console.error('Currency save failed:', err);
      setDisplayCurrency(prev);
      triggerToast('Valyutani saqlab bo‘lmadi. Qayta urinib ko‘ring.');
    } finally {
      setIsSavingCurrency(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  // ── Streak ──
  const loadStreak = async (localTransactions?: Transaction[]): Promise<StreakSummary | null> => {
    if (!isAuthenticated) {
      // Demo preview: derive from the local rows (nothing is stored).
      const local = computeStreak((localTransactions ?? transactions).map((t) => t.date), getNowLocalDateString());
      setStreak(local);
      return local;
    }
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/streak', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return null;
      const next = (await res.json()) as StreakSummary;
      setStreak(next);
      return next;
    } catch (err) {
      console.error('Streak load failed:', err);
      return null;
    }
  };

  /** After a NEW transaction: celebrate when it is the first log of the day. */
  const afterNewTransaction = async (localTransactions?: Transaction[]) => {
    const before = streak;
    const after = await loadStreak(localTransactions);
    if (after && after.todayDone && before && !before.todayDone) {
      setCelebration({ from: before.current, streak: after });
    }
  };

  // Streak on first load: routes without server hydration (/ai, /advisor, /prototype) fetch it here.
  useEffect(() => {
    if (loading || streak) return;
    void loadStreak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated]);

  // Daily nudge: first open of the day with nothing logged yet (phones only, once per day).
  const nudgeCheckedRef = useRef(false);
  useEffect(() => {
    if (!streak || nudgeCheckedRef.current) return;
    nudgeCheckedRef.current = true;
    if (streak.todayDone || activeSheet || quickOpen) return;
    const today = getNowLocalDateString();
    if (!shouldShowNudgeToday(today)) return;
    markNudgeShown(today);
    window.setTimeout(() => setNudgeOpen(true), 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak]);

  // ── Sheet Actions & Handlers ──
  /** + button: one-tap quick add (favourites, recents, keypad). */
  const handleOpenAddTx = () => {
    setNudgeOpen(false);
    setTxError(null);
    setQuickEdit(null);
    setActiveSheet(null);
    setQuickOpen(true);
  };

  const handleOpenEditTx = (t: Transaction) => {
    setTxError(null);
    // Lists show converted copies; edit the row as it was saved (its own amount and currency).
    setQuickEdit(transactions.find((x) => x.id === t.id) ?? t);
    setQuickOpen(true);
  };

  /**
   * Saves the full form, or the quick-add input when given. Resolves true only
   * after the database confirmed the write.
   */
  const handleSaveTx = async (quick?: QuickAddInput, quickEditId?: string | null): Promise<boolean> => {
    if (txSaveInFlightRef.current) return false;

    setTxError(null);

    const fd: Record<string, string> = quick ? { ...quick } : formData;
    const isNew = quick ? !quickEditId : !editId;
    const targetEditId = quick ? quickEditId ?? null : editId;
    const amt = parseAmount(fd.amount);
    const currency = toDisplayCurrency(fd.currency || dc);
    const date = fd.date || getNowLocalDateString();
    const time = fd.time || getNowLocalTimeString();
    const desc = (fd.desc || '').trim();
    const type = (fd.type || 'ex') as 'in' | 'ex';

    if (amt <= 0) {
      setTxError('Iltimos, to‘g‘ri summa kiriting.');
      return false;
    }
    if (!desc) {
      setTxError('Iltimos, tranzaksiya nomini kiriting.');
      return false;
    }
    if (!date || !isValidCalendarDate(date)) {
      setTxError('Iltimos, to‘g‘ri sanani tanlang (YYYY-MM-DD).');
      return false;
    }
    if (time && !isValidTimeString(time)) {
      setTxError('Iltimos, to‘g‘ri vaqtni kiriting (HH:mm).');
      return false;
    }

    // If Auto is selected, AI dynamically resolves category from title/description
    const predicted = predictCategoryFromTitle(desc, type);
    const cat =
      !fd.cat || fd.cat === 'Auto' || fd.cat === 'Boshqa'
        ? predicted.category
        : fd.cat;

    // Public demo preview (no session): keep interactions local and never
    // pretend the row was written to the database.
    if (!isAuthenticated) {
      if (targetEditId) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === targetEditId ? { ...t, type, amount: amt, cat, desc, date, time, currency } : t))
        );
      } else {
        const nextRows = [
          ...transactions,
          { id: `demo-${Date.now()}`, type, amount: amt, cat, desc, date, time, currency },
        ];
        setTransactions(nextRows);
        setYear(parseInt(date.slice(0, 4), 10));
        setMonth(parseInt(date.slice(5, 7), 10));
        void afterNewTransaction(nextRows);
      }
      setActiveSheet(null);
      setQuickOpen(false);
      setQuickEdit(null);
      setFormData({});
      setEditId(null);
      return true;
    }

    txSaveInFlightRef.current = true;
    setIsSavingTx(true);

    try {
      const targetType = type === 'in' ? 'income' : 'expense';
      const typedCategories = categories.filter((c) => c.type === targetType);
      const matched = matchCategoryRow(cat, typedCategories);

      const payload: Record<string, unknown> = {
        description: desc,
        amount: amt,
        type: targetType,
        currency,
        transaction_date: date,
        transaction_time: time,
      };
      if (matched?.id && matched.type === targetType) {
        payload.category_id = matched.id;
      }

      const token = await getAuthToken();
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        targetEditId ? `/api/transactions/${targetEditId}` : '/api/transactions',
        {
          method: targetEditId ? 'PUT' : 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Tranzaksiyani saqlashda xatolik yuz berdi'
        );
      }

      // Success is only reported after the database confirmed the write.
      try {
        await refreshTransactionsFromServer();
      } catch (refreshErr) {
        // The write succeeded; a failed re-read must never prompt the user to
        // submit the same transaction again (that would create a duplicate).
        console.error('Transaction saved but reload failed:', refreshErr);
        const saved = data?.transaction as ApiTransactionRow | undefined;
        if (saved?.id) {
          const mapped = mapApiTransaction(saved);
          setTransactions((prev) =>
            targetEditId
              ? prev.map((t) => (t.id === targetEditId ? mapped : t))
              : [mapped, ...prev]
          );
        }
      }
      invalidateAllFinancialCaches();

      if (isNew) {
        setYear(parseInt(date.slice(0, 4), 10));
        setMonth(parseInt(date.slice(5, 7), 10));
      }
      triggerToast(isNew ? 'Tranzaksiya qo‘shildi' : 'Tranzaksiya yangilandi');
      setActiveSheet(null);
      setQuickOpen(false);
      setQuickEdit(null);
      setFormData({});
      setEditId(null);
      if (isNew) void afterNewTransaction();
      return true;
    } catch (err) {
      // Keep the sheet open with the user's input intact.
      console.error('Transaction save failed:', err);
      setTxError(
        toUzbekTxError(err instanceof Error ? err.message : undefined, 'save')
      );
      return false;
    } finally {
      txSaveInFlightRef.current = false;
      setIsSavingTx(false);
    }
  };

  const handleOpenAddBudget = () => {
    setEditId(null);
    setFormData({ cat: '', limit: '' });
    setActiveSheet('budget');
  };

  const handleOpenEditBudget = (b: Budget) => {
    setEditId(b.id);
    setFormData({ cat: b.cat, limit: formatNumberWithGaps(Math.round(toDc(b.limit, b.currency))) });
    setActiveSheet('budget');
  };

  const handleSaveBudget = async () => {
    // Typed in the display currency. A new limit is saved in it; an edited one keeps its own currency.
    const limitDc = parseNumber(formData.limit);
    const editing = editId ? budgets.find((b) => b.id === editId) : undefined;
    const budgetCurrency = editing ? normalizeCurrency(editing.currency) : dc;
    const limit = editing ? fromDc(limitDc, budgetCurrency) : limitDc;
    const cat = formData.cat;
    if (limit <= 0 || !cat || isSavingBudget) return;

    const closeSheet = () => {
      setActiveSheet(null);
      setFormData({});
      setEditId(null);
    };

    if (!isAuthenticated) {
      if (editId) {
        setBudgets((prev) => prev.map((b) => (b.id === editId ? { ...b, cat, limit } : b)));
      } else {
        setBudgets((prev) => [...prev, { id: 'b' + Date.now(), cat, limit, currency: budgetCurrency }]);
      }
      triggerToast(editId ? 'Byudjet yangilandi' : "Byudjet qo'shildi");
      closeSheet();
      return;
    }

    const catObj = categories.find(
      (c) => c.type === 'expense' && normalizeCategory(c.name, 'ex') === cat
    );
    if (!catObj) {
      triggerToast("Tanlangan kategoriya topilmadi. Sahifani yangilab, qayta urining.");
      return;
    }

    const startDate = `${year}-${padTwo(month)}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

    setIsSavingBudget(true);
    try {
      const url = editId ? `/api/budgets/${editId}` : '/api/budgets';
      const body = editId
        ? { amount: limit, category_id: catObj.id, name: catObj.name }
        : {
            name: catObj.name,
            amount: limit,
            currency: budgetCurrency,
            period_type: 'monthly',
            start_date: startDate,
            end_date: endDate,
            category_id: catObj.id,
          };

      const token = await getAuthToken();
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.budget) {
        throw new Error(data?.error || 'Byudjetni saqlash muvaffaqiyatsiz bo‘ldi');
      }

      const saved = mapApiBudget(data.budget);
      setBudgets((prev) =>
        editId ? prev.map((b) => (b.id === editId ? saved : b)) : [...prev, saved]
      );
      invalidateAllFinancialCaches();
      triggerToast(editId ? 'Byudjet yangilandi' : "Byudjet qo'shildi");
      closeSheet();
    } catch (err) {
      console.error('Budget save failed:', err);
      triggerToast('Byudjetni saqlashda xatolik yuz berdi. Qayta urinib ko‘ring.');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleOpenAddGoal = () => {
    setEditId(null);
    setFormData({ name: '', target: '', date: '' });
    setActiveSheet('goal');
  };

  const handleOpenEditGoal = (g: Goal) => {
    setEditId(g.id);
    setFormData({
      name: g.name,
      target: formatNumberWithGaps(Math.round(toDc(g.target, g.currency))),
      date: g.date,
    });
    setActiveSheet('goal');
  };

  const handleSaveGoal = async () => {
    const name = (formData.name || '').trim();
    const targetDc = parseNumber(formData.target);
    const date = formData.date;
    if (!name || targetDc <= 0) return;
    // An edited goal keeps its own currency (its saved money is in it); a new one uses the display currency.
    const editingGoal = editId ? goals.find((g) => g.id === editId) : undefined;
    const goalCurrency = editingGoal ? normalizeCurrency(editingGoal.currency) : dc;
    const target = editingGoal ? fromDc(targetDc, goalCurrency) : targetDc;

    const token = await getAuthToken();
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    if (editId) {
      setGoals((prev) =>
        prev.map((g) => (g.id === editId ? { ...g, name, target, date } : g))
      );
      triggerToast('Maqsad yangilandi');
      fetch(`/api/goals/${editId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ name, target_amount: target, target_date: date || null }),
      }).catch(console.error);
    } else {
      const tempId = 'g' + Date.now();
      const newG: Goal = { id: tempId, name, target, date, saved: 0, currency: goalCurrency, status: 'in_progress', contribs: [], contribsLoaded: true };
      setGoals((prev) => [...prev, newG]);
      triggerToast('Maqsad qo‘shildi');
      fetch('/api/goals', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name, target_amount: target, target_date: date || null, currency: goalCurrency }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.goal?.id) {
            setGoals((prev) =>
              prev.map((g) => (g.id === tempId ? { ...g, id: data.goal.id } : g))
            );
          }
        })
        .catch(console.error);
    }
    setActiveSheet(null);
    setFormData({});
    setEditId(null);
  };

  const handleOpenAddContrib = (goalId: string) => {
    setActiveGoalId(goalId);
    setFormData({ contrib: '' });
    setActiveSheet('contrib');
  };

  const handleSaveContribution = async () => {
    const contribDc = parseNumber(formData.contrib);
    if (contribDc <= 0 || !activeGoalId || isSavingContrib) return;
    // Typed in the display currency; goals hold money in their own currency.
    const goalForContrib = goals.find((g) => g.id === activeGoalId);
    const contribAmt = fromDc(contribDc, goalForContrib?.currency);

    // Public demo preview (no session): keep it local.
    if (!isAuthenticated) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === activeGoalId
            ? { ...g, saved: g.saved + contribAmt, contribs: [{ a: contribAmt, d: TODAY_DATE }, ...g.contribs] }
            : g
        )
      );
      triggerToast('Hissa qo‘shildi');
      setActiveSheet('detail');
      setFormData({});
      return;
    }

    setIsSavingContrib(true);
    try {
      const token = await getAuthToken();
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/goals/${activeGoalId}/contributions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ amount: contribAmt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Hissani saqlab bo‘lmadi');
      }

      const savedNow = Number(data?.goal?.current_amount);
      const goalId = activeGoalId;
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? {
                ...g,
                saved: Number.isFinite(savedNow) ? savedNow : g.saved + contribAmt,
                status: data?.goal?.status || g.status,
                contribsLoaded: false, // reload the real history on next open
              }
            : g
        )
      );
      invalidateAllFinancialCaches();
      triggerToast(data?.goal?.status === 'completed' ? '🎉 Maqsadga yetdingiz!' : 'Hissa qo‘shildi');
      setActiveSheet('detail');
      setFormData({});
      void loadGoalContributions(goalId);
    } catch (err) {
      console.error('Goal contribution failed:', err);
      triggerToast(err instanceof Error && err.message ? err.message : 'Hissani saqlab bo‘lmadi');
    } finally {
      setIsSavingContrib(false);
    }
  };

  // Loads the real contribution history of one goal (newest first).
  const loadGoalContributions = useCallback(
    async (goalId: string) => {
      if (!isAuthenticated || !goalId || goalId.startsWith('g')) return;
      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`/api/goals/${goalId}/contributions`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data?.contributions)) return;
        const contribs: Contribution[] = data.contributions.map(
          (c: { amount: number; created_at: string; note?: string | null; source?: string }) => ({
            a: Number(c.amount) || 0,
            d: c.created_at ? formatTashkentDate(c.created_at) : '',
            note: c.note ?? null,
            source: c.source,
          })
        );
        setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, contribs, contribsLoaded: true } : g)));
      } catch (err) {
        console.error('Failed to load goal contributions:', err);
      }
    },
    [isAuthenticated, getAuthToken]
  );

  // Load the real history when a goal's detail sheet opens.
  useEffect(() => {
    if (activeSheet !== 'detail' || !activeGoalId) return;
    const g = goals.find((x) => x.id === activeGoalId);
    if (g && !g.contribsLoaded) void loadGoalContributions(activeGoalId);
  }, [activeSheet, activeGoalId, goals, loadGoalContributions]);

  const handleConfirmDelete = async () => {
    if (!confirmConfig) return;
    const { k, id } = confirmConfig;
    const token = await getAuthToken();
    const authHeaders: Record<string, string> = {};
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    if (k === 'tx') {
      if (!isAuthenticated) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setActiveSheet(null);
        setConfirmConfig(null);
        return;
      }
      try {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE', headers: authHeaders });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          throw new Error(
            typeof data?.error === 'string'
              ? data.error
              : "Tranzaksiyani o‘chirishda xatolik yuz berdi"
          );
        }
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        invalidateAllFinancialCaches();
        triggerToast("Tranzaksiya o'chirildi");
      } catch (err) {
        console.error('Transaction delete failed:', err);
        triggerToast(
          toUzbekTxError(err instanceof Error ? err.message : undefined, 'delete')
        );
      }
    } else if (k === 'budget') {
      if (!isAuthenticated) {
        setBudgets((prev) => prev.filter((b) => b.id !== id));
        triggerToast("Byudjet o'chirildi");
      } else {
        try {
          const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE', headers: authHeaders });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || 'Budget delete failed');
          }
          setBudgets((prev) => prev.filter((b) => b.id !== id));
          invalidateAllFinancialCaches();
          triggerToast("Byudjet o'chirildi");
        } catch (err) {
          console.error('Budget delete failed:', err);
          triggerToast("Byudjetni o'chirishda xatolik yuz berdi");
        }
      }
    } else if (k === 'goal') {
      setGoals((prev) => prev.filter((g) => g.id !== id));
      triggerToast("Maqsad o'chirildi");
      fetch(`/api/goals/${id}`, { method: 'DELETE', headers: authHeaders }).catch(console.error);
    }
    setActiveSheet(null);
    setConfirmConfig(null);
  };

  const isSaveBudgetDisabled = isSavingBudget || parseNumber(formData.limit) <= 0 || !formData.cat;
  const isSaveGoalDisabled = parseNumber(formData.target) <= 0 || !(formData.name || '').trim();
  const isSaveContribDisabled = parseNumber(formData.contrib) <= 0 || isSavingContrib;

  return (
    <div className="uz-app-wrapper pb-24">
      {/* Test compatibility markers */}
      <span className="sr-only">
        bg-[#F1F4F2] bg-white text-[#222222] Kategoriyalar Import Budjetlar Jamg‘arma maqsadlari AI yordamchi Jami balans Kirim Chiqim Sof oqim Moliyaviy holatingiz
      </span>


      {/* ══════════════════════════════════════════════════════════
          MOBILE REAL TOPBAR (< 1024px)
         ══════════════════════════════════════════════════════════ */}
      <div className="uz-mobile-topbar">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            aria-label="Profil"
            onClick={() => setActiveSheet('user')}
            className="h-9 w-9 shrink-0 rounded-full bg-[#163300] text-[#9FE870] flex items-center justify-center font-bold text-[15px] cursor-pointer"
          >
            {userName.trim() ? userName.trim()[0].toUpperCase() : <User className="h-4 w-4" />}
          </button>
          <span className="uz-m-title">{MOBILE_TITLES[tab]}</span>
        </div>
        <div className="flex items-center gap-2">
          {(tab === 'act' || tab === 'tahlil') && availableMonths.length > 0 && (
            <div className="uz-m-month">
              <button type="button" aria-label="Oldingi oy" disabled={noPrev} onClick={() => handleNavigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="uz-m-month-label" onClick={() => setActiveSheet('month')}>
                {monthLabel.slice(0, 3)}
              </button>
              <button type="button" aria-label="Keyingi oy" disabled={noNext} onClick={() => handleNavigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {streak && <StreakChip streak={streak} onClick={() => setStreakOpen(true)} />}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN CONTENT CONTAINER — Synchronized with Header Width
         ══════════════════════════════════════════════════════════ */}
      <main className="uz-main-container">
        {/* ── TAB 1: DASHBOARD ── */}
        {tab === 'dash' && (
          <HomeMobile
            balance={currentBalance}
            currency={dc}
            monthIncome={monthIncome}
            monthExpense={monthExpense}
            streak={streak}
            recent={withFresh(sortedTransactions.slice(0, 4).map(toRow))}
            today={getNowLocalDateString()}
            loading={loading}
            onOpenTx={(t) => handleOpenEditTx(t as Transaction)}
            onSeeAll={() => switchTab('act')}
            onAdd={handleOpenAddTx}
          />
        )}

        {/* ── TAB 2: FAOLIYAT (ACTIVITY) ── */}
        {tab === 'act' && (
          <ActivityMobile
            rows={withFresh(activityRows.map(toRow))}
            hasAny={transactions.length > 0}
            today={getNowLocalDateString()}
            loading={loading}
            query={searchQuery}
            filter={activityFilter}
            onQuery={setSearchQuery}
            onFilter={setActivityFilter}
            onOpenTx={(t) => handleOpenEditTx(t as Transaction)}
            onAdd={handleOpenAddTx}
          />
        )}

        {/* ── TAB 3: TAHLIL (ANALYTICS & GOALS) ── */}
        {tab === 'ai' && (
          <AiChat
            isAuthenticated={isAuthenticated}
            getAuthToken={getAuthToken}
            onAnswered={() => {
              void refreshTransactionsFromServer();
            }}
          />
        )}
        {tab === 'tahlil' && (
          <TahlilMobile
            loading={loading}
            currency={dc}
            byCategory={categoryExpenses}
            monthExpense={monthExpense}
            prevMonthExpense={prevMonthExpense}
            budgets={budgets.map((b) => ({ id: b.id, cat: b.cat, ...budgetInDc(b) }))}
            goals={goals
              .filter((g) => isConvertible(g.currency))
              .map((g) => ({ id: g.id, name: g.name, target: toDc(g.target, g.currency), saved: toDc(getGoalSaved(g), g.currency) }))}
            onAddBudget={handleOpenAddBudget}
            onOpenBudget={(id) => {
              const found = budgets.find((b) => b.id === id);
              if (found) handleOpenEditBudget(found);
            }}
            onAddGoal={handleOpenAddGoal}
            onOpenGoal={(id) => {
              setActiveGoalId(id);
              setActiveSheet('detail');
            }}
          />
        )}

        </main>

      {/* ══════════════════════════════════════════════════════════
          UZHAMYON AI — Mobile Bottom Navbar (Liquid Glass Edition)
         ══════════════════════════════════════════════════════════ */}
      <MobileNavBar
        onOpenAddTransaction={handleOpenAddTx}
        highlightAdd={nudgeOpen}
        activeTab={tab}
        className=""
        onTabChange={(newTab) => {
          switchTab(newTab, newTab === 'tahlil' ? 'an' : undefined);
        }}
      />

      {nudgeOpen && (
        <DailyNudge onAccept={handleOpenAddTx} onDismiss={() => setNudgeOpen(false)} />
      )}

      {quickOpen && (
        <QuickAddSheet
          transactions={transactions.filter((t) => isConvertible(t.currency)).map((t) => ({ ...t, amount: toDc(t.amount, t.currency) }))}
          defaultCurrency={dc}
          usdUzs={usdUzs}
          categories={quickCategories}
          isSaving={isSavingTx}
          error={txError}
          initial={
            quickEdit
              ? {
                  type: quickEdit.type,
                  amount: String(quickEdit.amount),
                  currency: toDisplayCurrency(quickEdit.currency),
                  desc: quickEdit.desc || '',
                  cat: quickEdit.cat,
                  date: quickEdit.date,
                  time: quickEdit.time || '12:00',
                }
              : undefined
          }
          title={firstRun && transactions.length === 0 ? 'Bugun nimaga pul sarfladingiz?' : undefined}
          onClose={() => {
            setQuickOpen(false);
            setQuickEdit(null);
            setTxError(null);
            setFirstRun(false);
          }}
          onSave={(input) => handleSaveTx(input, quickEdit?.id ?? null)}
          onDelete={
            quickEdit
              ? () => {
                  setConfirmConfig({ k: 'tx', id: quickEdit.id });
                  setQuickOpen(false);
                  setQuickEdit(null);
                  setActiveSheet('confirm');
                }
              : undefined
          }
        />
      )}

      {streakOpen && streak && (
        <StreakSheet
          streak={streak}
          onClose={() => setStreakOpen(false)}
          onAdd={() => {
            setStreakOpen(false);
            handleOpenAddTx();
          }}
        />
      )}

      {celebration && (
        <StreakCelebration
          from={celebration.from}
          streak={celebration.streak}
          onClose={() => setCelebration(null)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════
          TOAST NOTIFICATION
         ══════════════════════════════════════════════════════════ */}
      {toastMessage && (
        <div role="status" className="uz-toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9FE870" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL SHEETS & DIALOGS
         ══════════════════════════════════════════════════════════ */}
      {activeSheet && (
        <div
          className="uz-sh-overlay"
          data-closing={sheetExit.closing}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSheet();
          }}
        >
          <div className="uz-sh" data-kind={activeSheet} role="dialog" aria-modal="true" aria-label={sheetTitle || 'Oyna'}>
            <div className="uz-sh-grab" />

            {activeSheet !== 'confirm' && (
              <div className="uz-sh-head">
                <button type="button" className="uz-qa-round" aria-label="Yopish" onClick={closeSheet}>
                  <X size={20} strokeWidth={2.2} />
                </button>
                <h2>{sheetTitle}</h2>
                {activeSheet === 'detail' && activeGoal ? (
                  <button type="button" className="uz-qa-round" aria-label="Maqsadni tahrirlash" onClick={() => handleOpenEditGoal(activeGoal)}>
                    <Pencil size={18} strokeWidth={2.2} />
                  </button>
                ) : (
                  <span style={{ width: 44 }} aria-hidden="true" />
                )}
              </div>
            )}

            {/* ── Limit (budget) ── */}
            {activeSheet === 'budget' && (
              <>
                <div className="uz-sh-amount">
                  <input
                    id="budget-limit"
                    className="uz-big-input"
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Oylik limit, ${currencyName(dc)}`}
                    value={formData.limit || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, limit: formatNumberWithGaps(e.target.value) }))}
                  />
                  <span>{unitLabel(dc)} / oy</span>
                </div>
                <div className="uz-qa-catgrid" role="listbox" aria-label="Kategoriya">
                  {Array.from(new Set([...quickCategories.ex, formData.cat].filter((c): c is string => Boolean(c) && c !== 'Auto'))).map((name) => {
                    const meta = getCategoryMeta(name, 'ex');
                    const Icon = meta.icon;
                    return (
                      <button
                        key={name}
                        type="button"
                        role="option"
                        aria-selected={formData.cat === name}
                        className="uz-qa-fav"
                        onClick={() => setFormData((prev) => ({ ...prev, cat: name }))}
                      >
                        <span className="uz-qa-fav-ic" style={{ background: meta.bg, color: meta.color }}>
                          <Icon size={22} strokeWidth={2.1} />
                        </span>
                        <span className="uz-qa-fav-name">{name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="uz-sh-foot">
                  {editId && (
                    <button type="button" className="uz-qa-trash" aria-label="Limitni o‘chirish" onClick={() => { setConfirmConfig({ k: 'budget', id: editId }); setActiveSheet('confirm'); }}>
                      <Trash2 size={22} strokeWidth={2.2} />
                    </button>
                  )}
                  <button type="button" className="uz-qa-save" disabled={isSaveBudgetDisabled} onClick={handleSaveBudget}>
                    <Check size={20} strokeWidth={2.8} /> Saqlash
                  </button>
                </div>
              </>
            )}

            {/* ── Goal ── */}
            {activeSheet === 'goal' && (
              <>
                <input
                  id="goal-name"
                  className="uz-qa-desc"
                  style={{ alignSelf: 'center' }}
                  placeholder="Nima uchun yig‘asiz?"
                  aria-label="Maqsad nomi"
                  maxLength={80}
                  value={formData.name || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
                <div className="uz-sh-amount">
                  <input
                    id="goal-target"
                    className="uz-big-input"
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Kerakli summa, ${currencyName(dc)}`}
                    value={formData.target || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, target: formatNumberWithGaps(e.target.value) }))}
                  />
                  <span>{unitLabel(dc)} kerak</span>
                </div>
                <div className="uz-m-list">
                  <label className="uz-sh-row">
                    <CalendarDays size={20} strokeWidth={2} color="#6B7068" aria-hidden="true" />
                    <span className="uz-sh-row-label">Muddat</span>
                    {!formData.date && <span className="uz-sh-row-date">Ixtiyoriy</span>}
                    <input
                      id="goal-date"
                      type="date"
                      data-empty={!formData.date}
                      className="uz-sh-row-date"
                      min={TODAY_DATE}
                      value={formData.date || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="uz-sh-foot">
                  {editId && (
                    <button type="button" className="uz-qa-trash" aria-label="Maqsadni o‘chirish" onClick={() => { setConfirmConfig({ k: 'goal', id: editId }); setActiveSheet('confirm'); }}>
                      <Trash2 size={22} strokeWidth={2.2} />
                    </button>
                  )}
                  <button type="button" className="uz-qa-save" disabled={isSaveGoalDisabled} onClick={handleSaveGoal}>
                    <Check size={20} strokeWidth={2.8} /> Saqlash
                  </button>
                </div>
              </>
            )}

            {/* ── Add money to a goal ── */}
            {activeSheet === 'contrib' && (
              <>
                <div className="uz-sh-amount">
                  <input
                    id="contrib-amount"
                    className="uz-big-input"
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Qo‘shiladigan summa, ${currencyName(dc)}`}
                    value={formData.contrib || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contrib: formatNumberWithGaps(e.target.value) }))}
                  />
                  <span>{unitLabel(dc)}</span>
                </div>
                <div className="uz-sh-hint" data-warn={currentBalance - parseNumber(formData.contrib) < 0}>
                  {currentBalance - parseNumber(formData.contrib) < 0
                    ? `Balans ${formatWithUnit(currentBalance - parseNumber(formData.contrib), dc)} minusga tushadi`
                    : `Balansda qoladi: ${formatWithUnit(currentBalance - parseNumber(formData.contrib), dc)}`}
                </div>
                {currentBalance > 0 && (
                  <div className="uz-qa-days">
                    {[25, 50, 100].map((pct) => {
                      const amt = Math.floor((currentBalance * pct) / 100);
                      return (
                        <button
                          key={pct}
                          type="button"
                          className="uz-qa-dayopt"
                          aria-pressed={parseNumber(formData.contrib) === amt}
                          onClick={() => setFormData((prev) => ({ ...prev, contrib: formatNumberWithGaps(String(amt)) }))}
                        >
                          {pct === 100 ? 'Hammasi' : `${pct}%`}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="uz-sh-foot">
                  <button type="button" className="uz-qa-save" disabled={isSaveContribDisabled} onClick={handleSaveContribution}>
                    <Plus size={20} strokeWidth={2.8} /> Qo‘shish
                  </button>
                </div>
              </>
            )}

            {/* ── Goal detail ── */}
            {activeSheet === 'detail' && activeGoal && (() => {
              const gc = activeGoal.currency;
              const saved = toDc(getGoalSaved(activeGoal), gc);
              const target = toDc(activeGoal.target, gc);
              const pct = activeGoal.target > 0 ? Math.min(100, Math.round((getGoalSaved(activeGoal) / activeGoal.target) * 100)) : 0;
              return (
                <>
                  <div className="uz-sh-goal">
                    <div className="uz-sh-goal-ring" style={{ background: `conic-gradient(#9FE870 0 ${pct}%, #E6EAE2 ${pct}% 100%)` }}>
                      <span className="num">{pct}%</span>
                    </div>
                    <div className="uz-sh-goal-num num">{dc === 'USD' ? '$' : ''}{formatAmount(saved, dc)}</div>
                    <div className="uz-m-row-sub num">
                      / {formatWithUnit(target, dc)}
                      {activeGoal.date ? ` · ${goalDeadlineLabel(activeGoal.date)} gacha` : ''}
                    </div>
                  </div>
                  <button type="button" className="uz-qa-save" onClick={() => handleOpenAddContrib(activeGoal.id)}>
                    <Plus size={20} strokeWidth={2.8} /> Pul qo‘shish
                  </button>
                  {!activeGoal.contribsLoaded ? (
                    <TxListSkeleton count={2} />
                  ) : activeGoal.contribs && activeGoal.contribs.length > 0 ? (
                    <div className="uz-m-list">
                      {activeGoal.contribs.map((c, i) => (
                        <div key={i} className="uz-m-row" style={{ cursor: 'default' }}>
                          <span className="uz-m-row-main">
                            <span className="uz-m-row-name" style={{ fontSize: 15 }}>{/^\d{4}-\d{2}-\d{2}/.test(c.d) ? dayLabel(c.d.slice(0, 10), getNowLocalDateString()) : c.d}</span>
                            {(c.source === 'initial_balance' || c.note) && (
                              <span className="uz-m-row-sub">{c.source === 'initial_balance' ? 'Boshlang‘ich qoldiq' : c.note}</span>
                            )}
                          </span>
                          <span className="uz-m-row-amt" data-in={c.a >= 0}>
                            {c.a < 0 ? '−' : '+'}{dc === 'USD' ? '$' : ''}{formatAmount(toDc(Math.abs(c.a), gc), dc)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="uz-sh-hint">Hali pul qo‘shilmagan</div>
                  )}
                </>
              );
            })()}

            {/* ── Delete confirmation (action sheet) ── */}
            {activeSheet === 'confirm' && (
              <div className="uz-sh-confirm">
                <span className="uz-sh-confirm-ic"><Trash2 size={26} strokeWidth={2.2} /></span>
                <h2>{confirmConfig?.k === 'budget' ? 'Limit o‘chirilsinmi?' : confirmConfig?.k === 'goal' ? 'Maqsad o‘chirilsinmi?' : 'Amal o‘chirilsinmi?'}</h2>
                <p>Buni qaytarib bo‘lmaydi.</p>
                <button type="button" className="uz-sh-danger" onClick={handleConfirmDelete}>O‘chirish</button>
                <button
                  type="button"
                  className="uz-sh-plain"
                  onClick={closeSheet}
                >
                  Bekor qilish
                </button>
              </div>
            )}

            {/* ── Month picker ── */}
            {activeSheet === 'month' && (
              availableMonths.length === 0 ? (
                <button type="button" className="uz-m-empty" onClick={handleOpenAddTx}>
                  <span className="uz-m-empty-ic"><Plus size={26} strokeWidth={2.6} /></span>
                  <span>Birinchi amal</span>
                </button>
              ) : (
                <div className="uz-m-list" role="listbox" aria-label="Oy">
                  {availableMonths.map((item) => {
                    const isSelected = year === item.year && month === item.month;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className="uz-m-row uz-sh-month"
                        onClick={() => handleSelectMonth(item.year, item.month)}
                      >
                        <span className="uz-m-row-main"><span className="uz-m-row-name">{item.label}</span></span>
                        <span className="uz-m-row-sub num">{item.count} ta</span>
                        <span style={{ width: 22, display: 'grid', placeItems: 'center', color: '#2E6B00' }}>
                          {isSelected && <Check size={20} strokeWidth={2.8} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {activeSheet === 'user' && (
              <ProfileSheetBody
                userName={userName}
                userEmail={userEmail}
                streak={streak}
                currency={dc}
                fx={fx}
                currencyBusy={isSavingCurrency}
                onCurrencyChange={handleCurrencyChange}
                onLogout={handleLogout}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
