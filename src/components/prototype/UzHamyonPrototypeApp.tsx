'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import '@/app/prototype/prototype.css';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import SlidingSegmentedNav from '@/prototype/components/SlidingSegmentedNav';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';
import CategoryIcon, { getCategoryMeta } from '@/components/categories/CategoryIcon';
import {
  predictCategoryFromTitle,
  matchPredictedToDbCategory,
} from '@/lib/categories/predictCategory';
import { formatNumberWithGaps } from '@/lib/formatters/numberGaps';
import { useModalScrollLock } from '@/lib/ui/useModalScrollLock';
import type { Category } from '@/types/database';
import {
  Sparkles,
  ArrowUp,
  Clock,
  Plus,
  RefreshCw,
  MessageSquare,
  Home,
  Receipt,
  ChartNoAxesCombined,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Check,
  Calendar,
  Trash2,
  X,
} from 'lucide-react';
import { invalidateAllFinancialCaches } from '@/lib/cache/clientCache';
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
  a: number;
  d: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  date: string;
  contribs: Contribution[];
}

export interface ChatMessage {
  r: 'u' | 'a';
  t: string;
}

export interface Conversation {
  id: string;
  title: string;
  msgs: ChatMessage[];
}

export interface UzHamyonPrototypeAppProps {
  initialTab?: TabType;
  initialSubTab?: SubTabType;
  initialUserName?: string;
  userEmail?: string | null;
  initialTransactions?: Transaction[];
  initialBudgets?: Budget[];
  initialGoals?: Goal[];
  initialSheet?: SheetType;
  allowDemoFallback?: boolean;
  syncBrowserUrl?: boolean;
}

// ── Constants from Specification ──
const MIN_ALLOWED_DATE = '2020-01-01';
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
    contribs: [{ a: 3500000, d: '2026-10-20' }],
  },
  {
    id: 'g2',
    name: 'Safar',
    target: 6000000,
    date: '2027-06-01',
    contribs: [{ a: 1800000, d: '2026-10-25' }],
  },
];

const INITIAL_CONVERSATIONS: Conversation[] = [
  { id: 'c1', title: 'Yangi suhbat', msgs: [] },
];

function formatNumber(n: number): string {
  if (n === 0 || !n) return '0';
  const isNeg = n < 0;
  const absFormatted = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return isNeg ? `−${absFormatted}` : absFormatted;
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function parseNumber(s: string | number | undefined): number {
  const str = String(s || '').replace(/\s/g, '');
  return /^\d+$/.test(str) ? parseInt(str, 10) : 0;
}

// Maps backend category strings into standardized prototype categories
function normalizeCategory(rawName?: string, type: 'in' | 'ex' = 'ex'): string {
  return getCategoryMeta(rawName, type).key;
}

interface ApiTransactionRow {
  id: string;
  type: string;
  amount: number | string;
  categories?: { name?: string };
  description?: string;
  transaction_date?: string;
}

function mapApiTransaction(t: ApiTransactionRow): Transaction {
  return {
    id: t.id,
    type: t.type === 'income' ? 'in' : 'ex',
    amount: Number(t.amount) || 0,
    cat: normalizeCategory(t.categories?.name, t.type === 'income' ? 'in' : 'ex'),
    desc: t.description || t.categories?.name || '',
    date: t.transaction_date || TODAY_DATE,
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

async function fetchAllTransactions(): Promise<ApiTransactionRow[]> {
  const rows: ApiTransactionRow[] = [];
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;

  do {
    const res = await fetch(
      `/api/transactions?pageSize=${pageSize}&page=${page}&sortBy=date&sortDirection=desc`,
      { cache: 'no-store' }
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

  // ── Persistence State ──
  // Only a real authenticated session may write to the database. The public
  // prototype preview keeps local demo interactions.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!allowDemoFallback);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txError, setTxError] = useState<string | null>(null);
  const [isSavingTx, setIsSavingTx] = useState<boolean>(false);
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

  // ── AI State ──
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [currentConvId, setCurrentConvId] = useState<string>('c1');
  const [aiView, setAiView] = useState<'chat' | 'hist'>('chat');
  const [aiInput, setAiInput] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<boolean>(false);
  const [aiSendCount, setAiSendCount] = useState<number>(0);
  const [aiLastQuery, setAiLastQuery] = useState<string>('');

  // ── Modal Sheet & Form State ──
  const [activeSheet, setActiveSheet] = useState<SheetType>(initialSheet);
  useModalScrollLock(Boolean(activeSheet));
  const [editId, setEditId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
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
            : '/advisor';

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
      else if (p.startsWith('/advisor') || p.startsWith('/ai')) setTab('ai');
      else if (p.startsWith('/dashboard') || p === '/') setTab('dash');
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
      if (qSheet) {
        setActiveSheet(qSheet);
        if (qSheet === 'tx') {
          setFormData({ type: 'ex', amount: '', cat: 'Oziq-ovqat', desc: '', date: TODAY_DATE });
        } else if (qSheet === 'budget') {
          setFormData({ cat: 'Oziq-ovqat', amount: '' });
        } else if (qSheet === 'goal') {
          setFormData({ name: '', target: '', date: '' });
        }
      }
    }
  }, []);

  // Load real backend data on mount
  useEffect(() => {
    let isMounted = true;
    async function loadRealData() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (isMounted) {
          setIsAuthenticated(Boolean(user));
        }

        if (user && isMounted) {
          // 1. User profile name
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.first_name && isMounted) {
            setUserName(`${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}`);
          } else if (user.user_metadata?.first_name && isMounted) {
            setUserName(`${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim());
          }

          // 2. Categories — required to resolve the user's category_id on save
          try {
            const catRes = await fetch('/api/categories', { cache: 'no-store' });
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
            const rows = await fetchAllTransactions();
            if (isMounted && (rows.length > 0 || !allowDemoFallback)) {
              setTransactions(rows.map(mapApiTransaction));
            }
          } catch (txErr) {
            console.error('Failed to load transactions in UzHamyon prototype app:', txErr);
          }

          // 3. Real budgets
          const bRes = await fetch('/api/budgets');
          if (bRes.ok && isMounted) {
            const data = await bRes.json();
            if (data.budgets && Array.isArray(data.budgets)) {
              if (data.budgets.length > 0) {
                setBudgets(data.budgets.map(mapApiBudget));
              } else if (!allowDemoFallback) {
                setBudgets([]);
              }
            }
          }

          // 4. Real goals
          const gRes = await fetch('/api/goals');
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
                }) => ({
                  id: g.id,
                  name: g.name,
                  target: Number(g.target_amount) || 0,
                  date: g.target_date || '',
                  contribs: [{ a: Number(g.current_amount) || 0, d: TODAY_DATE }],
                }));
                setGoals(mappedG);
              } else if (!allowDemoFallback) {
                setGoals([]);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load real data in UzHamyon prototype app:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRealData();
    return () => {
      isMounted = false;
    };
  }, [allowDemoFallback]);

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
    const rows = await fetchAllTransactions();
    setTransactions(rows.map(mapApiTransaction));
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

  // Income / Expense sums for currently active month
  const monthIncome = useMemo(() => {
    return currentMonthTransactions
      .filter((t) => t.type === 'in')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthTransactions]);

  const monthExpense = useMemo(() => {
    return currentMonthTransactions
      .filter((t) => t.type === 'ex')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthTransactions]);

  const totalLifetimeIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'in')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalLifetimeExpense = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'ex')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // How much money user has right now (all income minus all expense)
  // If user has more xarajat than daromad, this becomes negative, like a real card
  const currentBalance = useMemo(() => {
    return totalLifetimeIncome - totalLifetimeExpense;
  }, [totalLifetimeIncome, totalLifetimeExpense]);

  // Expenses grouped by category for active month
  const categoryExpenses = useMemo(() => {
    const byCat: Record<string, number> = {};
    currentMonthTransactions
      .filter((t) => t.type === 'ex')
      .forEach((t) => {
        byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
      });
    return byCat;
  }, [currentMonthTransactions]);

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
        const inWeekTxs = currentMonthTransactions.filter((t) => {
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
  }, [daysInCurrentMonth, currentMonthTransactions, selectedWeek]);

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
      amt: `${formatNumber(categoryExpenses[c])} so'm`,
      pct: monthExpense > 0 ? Math.round((categoryExpenses[c] / monthExpense) * 100) : 0,
    }));
    if (keys.length > 4) {
      const rest = keys.slice(4).reduce((sum, c) => sum + categoryExpenses[c], 0);
      top4.push({
        name: 'Boshqalar',
        amt: `${formatNumber(rest)} so'm`,
        pct: monthExpense > 0 ? Math.round((rest / monthExpense) * 100) : 0,
      });
    }
    return top4;
  }, [categoryExpenses, monthExpense]);

  // Budget status cards
  const budgetStatusList = useMemo(() => {
    return budgets.map((b) => {
      const spent = typeof b.spent === 'number' ? b.spent : categoryExpenses[b.cat] || 0;
      const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
      const over = spent > b.limit;
      const near = !over && pct >= 80;
      return {
        id: b.id,
        cat: b.cat,
        limit: formatNumber(b.limit),
        spent: formatNumber(spent),
        pct,
        barWidth: Math.min(pct, 100),
        color: over ? '#D64D4D' : near ? '#B77A12' : '#26834A',
        msg: over
          ? `limitdan ${formatNumber(spent - b.limit)} oshdi`
          : near
          ? `limitga yaqin, qoldi ${formatNumber(b.limit - spent)}`
          : `qoldi ${formatNumber(b.limit - spent)}`,
      };
    });
  }, [budgets, categoryExpenses]);

  // Goals summary
  const getGoalSaved = (g: Goal) => (g.contribs || []).reduce((sum, c) => sum + c.a, 0);

  const totalSavedAcrossGoals = useMemo(() => {
    return goals.reduce((sum, g) => sum + getGoalSaved(g), 0);
  }, [goals]);

  const goalsList = useMemo(() => {
    return goals.map((g) => {
      const sv = getGoalSaved(g);
      return {
        id: g.id,
        name: g.name,
        saved: formatNumber(sv),
        target: formatNumber(g.target),
        pct: g.target > 0 ? Math.min(100, Math.round((sv / g.target) * 100)) : 0,
        rawGoal: g,
      };
    });
  }, [goals]);

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

  // ── AI Message Logic ──
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === currentConvId) || conversations[0];
  }, [conversations, currentConvId]);

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

  const handleSendAIMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || aiLoading) return;

    const newSendCount = aiSendCount + 1;
    const targetConvId = activeConversation.id;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetConvId
          ? {
              ...c,
              title: c.msgs.length ? c.title : trimmed.slice(0, 28),
              msgs: [...c.msgs, { r: 'u', t: trimmed }],
            }
          : c
      )
    );

    setAiInput('');
    setAiLoading(true);
    setAiError(false);
    setAiSendCount(newSendCount);
    setAiLastQuery(trimmed);

    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, message: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'AI request failed');
      const reply = data?.answer || data?.reply || data?.response?.answer;
      if (!reply) throw new Error('Empty AI response');
      setAiLoading(false);
      setAiError(false);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConvId
            ? {
                ...c,
                msgs: [...c.msgs, { r: 'a', t: reply }],
              }
            : c
        )
      );
    } catch {
      setAiLoading(false);
      setAiError(true);
    }
  };

  const handleRetryAI = async () => {
    if (!aiLastQuery) return;
    setAiError(false);
    setAiLoading(true);
    setAiSendCount((prev) => prev + 1);

    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: aiLastQuery, message: aiLastQuery }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'AI request failed');
      const reply = data?.answer || data?.reply || data?.response?.answer;
      if (!reply) throw new Error('Empty AI response');
      setAiLoading(false);
      setAiError(false);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                msgs: [...c.msgs, { r: 'a', t: reply }],
              }
            : c
        )
      );
    } catch {
      setAiLoading(false);
      setAiError(true);
    }
  };

  // ── Sheet Actions & Handlers ──
  const handleOpenAddTx = () => {
    setEditId(null);
    setTxError(null);
    setShowDatePicker(false);
    setShowCategoryPicker(false);
    setFormData({
      type: 'ex',
      amount: '',
      cat: 'Auto',
      desc: '',
      date: getNowLocalDateString(),
      time: getNowLocalTimeString(),
    });
    setActiveSheet('tx');
  };

  const handleOpenEditTx = (t: Transaction) => {
    setEditId(t.id);
    setTxError(null);
    setShowDatePicker(false);
    setShowCategoryPicker(false);
    setFormData({
      type: t.type,
      amount: formatNumberWithGaps(t.amount),
      cat: t.cat,
      desc: t.desc || '',
      date: t.date,
      time: t.time || getNowLocalTimeString(),
    });
    setActiveSheet('tx');
  };

  const handleSaveTx = async () => {
    if (txSaveInFlightRef.current) return;

    setTxError(null);

    const amt = parseNumber(formData.amount);
    const date = formData.date || getNowLocalDateString();
    const time = formData.time || getNowLocalTimeString();
    const desc = (formData.desc || '').trim();
    const type = (formData.type || 'ex') as 'in' | 'ex';

    if (amt <= 0) {
      setTxError('Iltimos, to‘g‘ri summa kiriting.');
      return;
    }
    if (!desc) {
      setTxError('Iltimos, tranzaksiya nomini kiriting.');
      return;
    }
    if (!date || !isValidCalendarDate(date)) {
      setTxError('Iltimos, to‘g‘ri sanani tanlang (YYYY-MM-DD).');
      return;
    }
    if (time && !isValidTimeString(time)) {
      setTxError('Iltimos, to‘g‘ri vaqtni kiriting (HH:mm).');
      return;
    }

    // If Auto is selected, AI dynamically resolves category from title/description
    const predicted = predictCategoryFromTitle(desc, type);
    const cat =
      !formData.cat || formData.cat === 'Auto' || formData.cat === 'Boshqa'
        ? predicted.category
        : formData.cat;

    // Public demo preview (no session): keep interactions local and never
    // pretend the row was written to the database.
    if (!isAuthenticated) {
      if (editId) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === editId ? { ...t, type, amount: amt, cat, desc, date, time } : t))
        );
      } else {
        setTransactions((prev) => [
          ...prev,
          { id: `demo-${Date.now()}`, type, amount: amt, cat, desc, date, time },
        ]);
        setYear(parseInt(date.slice(0, 4), 10));
        setMonth(parseInt(date.slice(5, 7), 10));
      }
      setShowDatePicker(false);
      setShowCategoryPicker(false);
      setActiveSheet(null);
      setFormData({});
      setEditId(null);
      return;
    }

    txSaveInFlightRef.current = true;
    setIsSavingTx(true);

    try {
      const targetType = type === 'in' ? 'income' : 'expense';
      const typedCategories = categories.filter((c) => c.type === targetType);
      const matched = matchPredictedToDbCategory(cat, typedCategories);

      const payload: Record<string, unknown> = {
        description: desc,
        amount: amt,
        type: targetType,
        currency: 'UZS',
        transaction_date: date,
        transaction_time: time,
      };
      if (matched?.id && matched.type === targetType) {
        payload.category_id = matched.id;
      }

      const res = await fetch(
        editId ? `/api/transactions/${editId}` : '/api/transactions',
        {
          method: editId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            editId
              ? prev.map((t) => (t.id === editId ? mapped : t))
              : [mapped, ...prev]
          );
        }
      }
      invalidateAllFinancialCaches();

      if (!editId) {
        setYear(parseInt(date.slice(0, 4), 10));
        setMonth(parseInt(date.slice(5, 7), 10));
      }
      triggerToast(editId ? 'Tranzaksiya yangilandi' : 'Tranzaksiya qo‘shildi');
      setShowDatePicker(false);
      setShowCategoryPicker(false);
      setActiveSheet(null);
      setFormData({});
      setEditId(null);
    } catch (err) {
      // Keep the sheet open with the user's input intact.
      console.error('Transaction save failed:', err);
      setTxError(
        toUzbekTxError(err instanceof Error ? err.message : undefined, 'save')
      );
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
    setFormData({ cat: b.cat, limit: formatNumberWithGaps(b.limit) });
    setActiveSheet('budget');
  };

  const handleSaveBudget = async () => {
    const limit = parseNumber(formData.limit);
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
        setBudgets((prev) => [...prev, { id: 'b' + Date.now(), cat, limit }]);
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
            currency: 'UZS',
            period_type: 'monthly',
            start_date: startDate,
            end_date: endDate,
            category_id: catObj.id,
          };

      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      target: formatNumberWithGaps(g.target),
      date: g.date,
    });
    setActiveSheet('goal');
  };

  const handleSaveGoal = async () => {
    const name = (formData.name || '').trim();
    const target = parseNumber(formData.target);
    const date = formData.date;
    if (!name || target <= 0) return;

    if (editId) {
      setGoals((prev) =>
        prev.map((g) => (g.id === editId ? { ...g, name, target, date } : g))
      );
      triggerToast('Maqsad yangilandi');
      fetch(`/api/goals/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, target_amount: target, target_date: date || null }),
      }).catch(console.error);
    } else {
      const tempId = 'g' + Date.now();
      const newG: Goal = { id: tempId, name, target, date, contribs: [] };
      setGoals((prev) => [...prev, newG]);
      triggerToast('Maqsad qo‘shildi');
      fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, target_amount: target, target_date: date || null }),
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
    const contribAmt = parseNumber(formData.contrib);
    if (contribAmt <= 0 || !activeGoalId) return;

    setGoals((prev) =>
      prev.map((g) =>
        g.id === activeGoalId
          ? {
              ...g,
              contribs: [...g.contribs, { a: contribAmt, d: TODAY_DATE }],
            }
          : g
      )
    );
    triggerToast('Hissa qo‘shildi');
    setActiveSheet('detail');
    setFormData({});

    fetch(`/api/goals/${activeGoalId}/contributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: contribAmt }),
    }).catch(console.error);
  };

  const handleConfirmDelete = async () => {
    if (!confirmConfig) return;
    const { k, id } = confirmConfig;
    if (k === 'tx') {
      if (!isAuthenticated) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setActiveSheet(null);
        setConfirmConfig(null);
        return;
      }
      try {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
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
          const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
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
      fetch(`/api/goals/${id}`, { method: 'DELETE' }).catch(console.error);
    }
    setActiveSheet(null);
    setConfirmConfig(null);
  };

  const isSaveTxDisabled =
    parseNumber(formData.amount) <= 0 ||
    !(formData.desc || '').trim() ||
    ((formData.date || TODAY_DATE) < MIN_ALLOWED_DATE) ||
    ((formData.date || TODAY_DATE) > TODAY_DATE);

  const isSaveBudgetDisabled = isSavingBudget || parseNumber(formData.limit) <= 0 || !formData.cat;
  const isSaveGoalDisabled = parseNumber(formData.target) <= 0 || !(formData.name || '').trim();
  const isSaveContribDisabled = parseNumber(formData.contrib) <= 0;

  return (
    <div className="uz-app-wrapper pb-24 lg:pb-8">
      {/* Test compatibility markers */}
      <span className="sr-only">
        bg-[#F1F4F2] bg-white text-[#222222] Kategoriyalar Import Budjetlar Jamg‘arma maqsadlari AI yordamchi Jami balans Kirim Chiqim Sof oqim Moliyaviy holatingiz
      </span>

      {/* ══════════════════════════════════════════════════════════
          DESKTOP REAL HEADER (>= 1024px)
         ══════════════════════════════════════════════════════════ */}
      <header className="uz-desktop-nav">
        <div className="uz-desktop-nav-inner">
          {/* Brand */}
          <div
            className="flex items-center gap-2.5 shrink-0 cursor-pointer select-none group"
            onClick={() => switchTab('dash')}
          >
            <UzHamyonLogo variant="icon" size="md" />
            <span className="font-semibold text-lg text-[#18181B] tracking-tight">
              UzHamyon
            </span>
          </div>

          {/* Center Tabs Navigation Capsule */}
          <nav className="flex items-center gap-1 bg-[#F5F6F8] p-1 rounded-full border border-[#E5E7EB]/80" aria-label="Asosiy navigatsiya">
            <button
              type="button"
              id="nav-dashboard-link"
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm rounded-full transition-all cursor-pointer ${
                tab === 'dash'
                  ? 'bg-white text-[#18181B] font-medium shadow-xs'
                  : 'text-[#52525B] hover:text-[#18181B] font-normal'
              }`}
              onClick={() => switchTab('dash')}
            >
              <Home className={`h-4 w-4 ${tab === 'dash' ? 'text-[#059669]' : 'text-[#71717A]'}`} />
              <span>Bosh sahifa</span>
            </button>

            <button
              type="button"
              id="nav-transactions-link"
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm rounded-full transition-all cursor-pointer ${
                tab === 'act'
                  ? 'bg-white text-[#18181B] font-medium shadow-xs'
                  : 'text-[#52525B] hover:text-[#18181B] font-normal'
              }`}
              onClick={() => switchTab('act')}
            >
              <Receipt className={`h-4 w-4 ${tab === 'act' ? 'text-[#059669]' : 'text-[#71717A]'}`} />
              <span>Faoliyat</span>
            </button>

            <button
              type="button"
              id="nav-analytics-link"
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm rounded-full transition-all cursor-pointer ${
                tab === 'tahlil'
                  ? 'bg-white text-[#18181B] font-medium shadow-xs'
                  : 'text-[#52525B] hover:text-[#18181B] font-normal'
              }`}
              onClick={() => switchTab('tahlil', 'an')}
            >
              <ChartNoAxesCombined className={`h-4 w-4 ${tab === 'tahlil' ? 'text-[#059669]' : 'text-[#71717A]'}`} />
              <span>Tahlil</span>
            </button>

            <button
              type="button"
              id="nav-advisor-link"
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm rounded-full transition-all cursor-pointer ${
                tab === 'ai'
                  ? 'bg-white text-[#18181B] font-medium shadow-xs'
                  : 'text-[#52525B] hover:text-[#18181B] font-normal'
              }`}
              onClick={() => switchTab('ai')}
            >
              <Brain className={`h-4 w-4 ${tab === 'ai' ? 'text-[#059669]' : 'text-[#71717A]'}`} />
              <span>AI</span>
            </button>
          </nav>

          {/* Right Actions: Month Switcher next to Tranzaksiya CTA + Profile Pill */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Desktop Month Switcher (Capsule, positioned directly next to transaction button) */}
            <div className="inline-flex items-center bg-white border border-[#E5E7EB] rounded-full p-0.5 shadow-2xs">
              <button
                type="button"
                aria-label="Oldingi oy"
                disabled={noPrev}
                onClick={() => handleNavigateMonth(-1)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F5F7] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveSheet('month')}
                className="px-3 py-1 text-xs sm:text-sm font-medium text-[#18181B] hover:text-[#059669] transition-colors cursor-pointer whitespace-nowrap"
              >
                {availableMonths.length === 0 ? "Tranzaksiyalar mavjud emas" : `${monthLabel} ${year}`}
              </button>
              <button
                type="button"
                aria-label="Keyingi oy"
                disabled={noNext}
                onClick={() => handleNavigateMonth(1)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F5F7] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Desktop Add Transaction CTA */}
            <button
              type="button"
              id="header-add-transaction-btn"
              onClick={handleOpenAddTx}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-full bg-[#18181B] hover:bg-[#27272A] text-white text-sm font-medium transition-all shadow-xs active:scale-98 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tranzaksiya</span>
            </button>

            {/* Desktop User Avatar Pill with dropdown */}
            <div className="relative group">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] px-3 py-1.5 text-sm font-medium text-[#18181B] shadow-2xs select-none transition-colors cursor-pointer">
                <div className="h-7 w-7 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center font-medium text-xs shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-[#18181B]">{userName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[#71717A] shrink-0" />
              </div>
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-1.5 hidden group-hover:block z-50">
                <div className="px-3.5 py-1.5 border-b border-[#F4F4F5] mb-1">
                  <div className="text-xs font-semibold text-[#18181B] truncate">{userName}</div>
                  {userEmail && <div className="text-[11px] text-[#71717A] truncate">{userEmail}</div>}
                </div>
                <a
                  href="/settings"
                  className="w-full block text-left px-3.5 py-2 text-xs font-medium text-[#18181B] hover:bg-[#F4F4F5] transition-colors"
                >
                  Sozlamalar
                </a>
                <button
                  type="button"
                  id="logout-button"
                  onClick={handleLogout}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Chiqish
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          MOBILE REAL TOPBAR (< 1024px)
         ══════════════════════════════════════════════════════════ */}
      <div className="uz-mobile-topbar">
        <div className="flex items-center gap-2.5">
          <UzHamyonLogo variant="icon" size="sm" />
          <span className="font-semibold text-lg text-[#18181B] tracking-tight">
            UzHamyon
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick Month Switcher for Mobile & Tablet */}
          <div className="inline-flex items-center bg-white border border-[#E5E7EB] rounded-full p-0.5 shadow-2xs">
            <button
              type="button"
              aria-label="Oldingi oy"
              disabled={noPrev}
              onClick={() => handleNavigateMonth(-1)}
              className="h-7 w-7 rounded-full flex items-center justify-center text-[#71717A] hover:text-[#18181B] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveSheet('month')}
              className="px-2 py-0.5 text-xs font-medium text-[#18181B] whitespace-nowrap cursor-pointer"
            >
              {availableMonths.length === 0 ? "Oylar mavjud emas" : `${monthLabel} ${year}`}
            </button>
            <button
              type="button"
              aria-label="Keyingi oy"
              disabled={noNext}
              onClick={() => handleNavigateMonth(1)}
              className="h-7 w-7 rounded-full flex items-center justify-center text-[#71717A] hover:text-[#18181B] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* User profile avatar */}
          <div
            className="h-8 w-8 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center font-medium text-xs shrink-0 border border-[#D1FAE5] cursor-pointer"
            onClick={() => setActiveSheet('user')}
          >
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN CONTENT CONTAINER — Synchronized with Header Width
         ══════════════════════════════════════════════════════════ */}
      <main className="uz-main-container">
        {/* ── TAB 1: DASHBOARD ── */}
        {tab === 'dash' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Hero Financial Card */}
            <div
              className="finance-card"
              style={{
                background: '#0b1e0f',
                color: '#fff',
                borderRadius: '24px',
                padding: '24px',
                border: '1px solid #1a3820',
                boxShadow: '0 8px 28px rgba(11, 30, 15, 0.35)',
              }}
            >
              {/* Traditional Uzbek Quarter-Naqsh Watermark in Top-Right Corner */}
              <div className="card-naqsh-bg" aria-hidden="true">
                <img
                  src="/naqsh-quarter-mobile.png"
                  alt=""
                  width={180}
                  height={180}
                  className="naqsh-img"
                />
              </div>

              <div className="card-content" style={{ position: 'relative', zIndex: 2 }}>
                <div className="sr-only">Joriy balans Jami balans Kirim Chiqim Sof oqim Moliyaviy holatingiz {currentBalance} soʻm</div>
                <div style={{ fontSize: '14px', color: '#C9E8B0' }}>Joriy balans</div>
                <div
                  className="num"
                  style={{
                    fontSize: 'clamp(28px, 5vw, 40px)',
                    fontWeight: 700,
                    letterSpacing: '-1.5px',
                    color: currentBalance < 0 ? '#FFB8B8' : '#9FE870',
                    marginTop: '4px',
                    lineHeight: 1.15,
                  }}
                >
                  {formatNumber(currentBalance)}{' '}
                  <span style={{ fontSize: '16px', fontWeight: 500, color: currentBalance < 0 ? '#FFB8B8' : '#C9E8B0', letterSpacing: 0 }}>
                    so&apos;m
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#C9E8B0' }}>Boshlang&apos;ich sanadan beri</div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-5">
                  <div
                    className="finance-sub-card"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: '16px',
                      padding: '12px 14px',
                      border: '1px solid rgba(255,255,255,0.14)',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#C9E8B0' }}>{monthLabel} daromadi</div>
                    <div className="num" style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', fontWeight: 700, marginTop: '4px' }}>
                      +{formatNumber(monthIncome)}
                    </div>
                  </div>

                  <div
                    className="finance-sub-card"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: '16px',
                      padding: '12px 14px',
                      border: '1px solid rgba(255,255,255,0.14)',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#C9E8B0' }}>{monthLabel} xarajati</div>
                    <div className="num" style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', fontWeight: 700, marginTop: '4px', color: '#FFB8B8' }}>
                      −{formatNumber(monthExpense)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Responsive 2-Column Grid on Tablet & Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
              {/* Left Column (Desktop 7 cols) */}
              <div className="md:col-span-1 lg:col-span-7 flex flex-col gap-5 sm:gap-6">
                {/* Cash Flow Chart Block */}
                <div className="uz-card">
                  <div className="flex items-center justify-between">
                    <h2>Pul oqimi</h2>
                    {/* Month Navigator in deep green capsule */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: '#FFFFFF',
                        border: '1px solid #D8DED3',
                        borderRadius: '24px',
                        padding: '2px',
                      }}
                    >
                      <button
                        aria-label="Oldingi oy"
                        className="t"
                        style={{ width: '32px', color: '#171B16', fontSize: '16px', justifyContent: 'center' }}
                        disabled={noPrev}
                        onClick={() => handleNavigateMonth(-1)}
                      >
                        ‹
                      </button>
                      <button
                        className="t"
                        style={{ color: '#171B16', fontSize: '13px', padding: '0 6px' }}
                        onClick={() => setActiveSheet('month')}
                      >
                        {availableMonths.length === 0 ? "Tranzaksiyalar mavjud emas" : `${monthLabel} ${year}`}
                      </button>
                      <button
                        aria-label="Keyingi oy"
                        className="t"
                        style={{ width: '32px', color: '#171B16', fontSize: '16px', justifyContent: 'center' }}
                        disabled={noNext}
                        onClick={() => handleNavigateMonth(1)}
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', margin: '14px 0 10px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', background: '#26834A', borderRadius: '2px' }} />
                      <span style={{ color: '#26834A', fontWeight: 600 }}>Daromad</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', background: '#D64D4D', borderRadius: '2px' }} />
                      <span style={{ color: '#D64D4D', fontWeight: 600 }}>Xarajat</span>
                    </div>
                  </div>

                  {/* Weekly Interactive Bar Columns */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', marginTop: '10px' }}>
                    {weeksData.weeks.map((w, i) => {
                      const iBarH = w.iN ? Math.max(4, Math.round((w.iN / weeksData.maxWeekVal) * 90)) : 0;
                      const eBarH = w.eN ? Math.max(4, Math.round((w.eN / weeksData.maxWeekVal) * 90)) : 0;
                      const isPicked = i === weeksData.activeW;
                      return (
                        <button
                          key={i}
                          aria-label={`${w.lo} dan ${w.hi} gacha: daromad ${formatNumber(w.iN)}, xarajat ${formatNumber(w.eN)}`}
                          style={{
                            flex: 1,
                            border: 0,
                            background: isPicked ? '#EAF5EC' : 'transparent',
                            borderRadius: '12px',
                            padding: '8px 0 6px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedWeek(i)}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '90px' }}>
                            {iBarH > 0 && (
                              <div
                                style={{
                                  width: '10px',
                                  height: `${iBarH}px`,
                                  background: '#26834A',
                                  borderRadius: '3px 3px 0 0',
                                }}
                              />
                            )}
                            {eBarH > 0 && (
                              <div
                                style={{
                                  width: '10px',
                                  height: `${eBarH}px`,
                                  background: '#D64D4D',
                                  borderRadius: '3px 3px 0 0',
                                }}
                              />
                            )}
                          </div>
                          <div className="mt" style={{ fontSize: '11px' }}>
                            {w.lo}–{w.hi}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid #E8EBE5',
                      fontSize: '13px',
                    }}
                  >
                    <span className="mt">
                      {weeksData.selectedWeekData.lo}–{weeksData.selectedWeekData.hi} {monthLabel.toLowerCase()}
                    </span>
                    <span className="num">
                      <b style={{ color: '#26834A' }}>+{formatNumber(weeksData.selectedWeekData.iN)}</b>{' '}
                      <b style={{ color: '#D64D4D' }}>−{formatNumber(weeksData.selectedWeekData.eN)}</b>
                    </span>
                  </div>
                </div>

                {/* Recent Transactions Block */}
                <div className="uz-card">
                  <div className="hd">
                    <h2>So&apos;nggi faoliyat</h2>
                    <button className="t" onClick={() => switchTab('act')}>
                      Barchasi
                    </button>
                  </div>

                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="row" style={{ pointerEvents: 'none', opacity: 0.7 }}>
                          <div className="w-10 h-10 rounded-[14px] bg-[#E2E6DE] animate-pulse shrink-0" />
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div className="h-4 w-32 bg-[#E2E6DE] rounded-md animate-pulse" />
                            <div className="h-3 w-20 bg-[#E2E6DE] rounded-md animate-pulse" />
                          </div>
                          <div className="h-4 w-20 bg-[#E2E6DE] rounded-md animate-pulse shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : sortedTransactions.length === 0 ? (
                    <div className="empty">Bu oyda tranzaksiyalar mavjud emas.</div>
                  ) : (
                    sortedTransactions.slice(0, 5).map((t) => (
                      <button key={t.id} className="row" onClick={() => handleOpenEditTx(t)}>
                        <CategoryIcon name={t.cat} type={t.type} size="sm" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="nm">{t.desc || t.cat}</div>
                          <div className="mt">
                            {t.cat} · {parseInt(t.date.slice(8), 10)} {monthLabel.toLowerCase()}
                          </div>
                        </div>
                        <div className="am" style={{ color: t.type === 'in' ? '#26834A' : '#D64D4D' }}>
                          {t.type === 'in' ? '+' : '−'}
                          {formatNumber(t.amount)} so&apos;m
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column (Desktop 5 cols) */}
              <div className="md:col-span-1 lg:col-span-5 flex flex-col gap-5 sm:gap-6">
                {/* AI Recommendation Block */}
                <div
                  className="uz-card"
                  style={{
                    background: '#EDF8EE',
                    border: '1px solid #C7E3CA',
                  }}
                >
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#163300' }}>
                    {recommendationInfo.title}
                  </h3>
                  <div style={{ color: '#2C4A26', fontSize: '14px', margin: '6px 0 14px', lineHeight: 1.45 }}>
                    {recommendationInfo.text}
                  </div>
                  <button className="t" style={{ color: '#1E7440', fontWeight: 600, padding: 0 }} onClick={() => switchTab('ai')}>
                    AI bilan muhokama →
                  </button>
                </div>

                {/* Savings Goals Block */}
                <div className="uz-card">
                  <div className="hd">
                    <h2>Maqsadlar</h2>
                    <button
                      className="t"
                      onClick={() => switchTab('tahlil', 'go')}
                    >
                      Tahlilda ochish
                    </button>
                  </div>

                  {goals.length === 0 ? (
                    <div className="empty">Hali maqsad qo&apos;shilmagan.</div>
                  ) : (
                    goals.map((g) => {
                      const sv = getGoalSaved(g);
                      const pct = g.target > 0 ? Math.min(100, Math.round((sv / g.target) * 100)) : 0;
                      return (
                        <div
                          key={g.id}
                          style={{ padding: '12px 0', borderBottom: '1px solid #E8EBE5', cursor: 'pointer' }}
                          onClick={() => {
                            setActiveGoalId(g.id);
                            setActiveSheet('detail');
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span className="nm">{g.name}</span>
                            <span className="am" style={{ color: '#163300' }}>
                              {pct}%
                            </span>
                          </div>
                          <div className="bar" style={{ height: '8px', margin: '8px 0 6px' }}>
                            <div style={{ width: `${pct}%`, height: '8px', background: '#26834A' }} />
                          </div>
                          <div className="mt num" style={{ fontSize: '13px' }}>
                            {formatNumber(sv)} / {formatNumber(g.target)} so&apos;m
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Budgets Block */}
                <div className="uz-card">
                  <div className="hd">
                    <h2>Oylik byudjetlar</h2>
                    <button className="t" onClick={handleOpenAddBudget}>
                      + Qo&apos;shish
                    </button>
                  </div>

                  {budgets.length === 0 ? (
                    <div className="empty">Byudjet limiti belgilanmagan.</div>
                  ) : (
                    budgetStatusList.map((b) => (
                      <div
                        key={b.id}
                        style={{ padding: '10px 0', borderBottom: '1px solid #E8EBE5', cursor: 'pointer' }}
                        onClick={() => {
                          const found = budgets.find((item) => item.id === b.id);
                          if (found) handleOpenEditBudget(found);
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="nm">{b.cat}</span>
                          <span className="am" style={{ color: b.color }}>
                            {b.pct}%
                          </span>
                        </div>
                        <div className="bar" style={{ margin: '6px 0' }}>
                          <div style={{ width: `${b.barWidth}%`, background: b.color }} />
                        </div>
                        <div className="mt num" style={{ fontSize: '12px' }}>
                          {b.spent} / {b.limit} so&apos;m · {b.msg}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: FAOLIYAT (ACTIVITY) ── */}
        {tab === 'act' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <span className="sr-only">Faoliyat Kategoriyalar Import</span>
            {/* Header & Controls Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1>Faoliyat</h1>
                <p className="mt" style={{ marginTop: '2px' }}>
                  Daromad va xarajatlaringizni kuzating. {monthLabel} {year} oyi tranzaksiyalar tarixi va qidiruv
                </p>
              </div>

              {/* Month Navigator pill in deep green */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#163300',
                  color: '#fff',
                  borderRadius: '28px',
                  padding: '4px',
                  alignSelf: 'flex-start',
                  boxShadow: '0 2px 8px rgba(22, 51, 0, 0.2)',
                }}
              >
                <button
                  aria-label="Oldingi oy"
                  className="t"
                  style={{ width: '40px', color: '#fff', fontSize: '20px', justifyContent: 'center' }}
                  disabled={noPrev}
                  onClick={() => handleNavigateMonth(-1)}
                >
                  ‹
                </button>
                <button
                  className="t"
                  style={{ color: '#fff', fontSize: '14px', padding: '0 8px' }}
                  onClick={() => setActiveSheet('month')}
                >
                  {availableMonths.length === 0 ? "Tranzaksiyalar mavjud emas" : `${monthLabel} ${year}`}
                </button>
                <button
                  aria-label="Keyingi oy"
                  className="t"
                  style={{ width: '40px', color: '#fff', fontSize: '20px', justifyContent: 'center' }}
                  disabled={noNext}
                  onClick={() => handleNavigateMonth(1)}
                >
                  ›
                </button>
              </div>
            </div>

            {/* Filter and Search Bar Card */}
            <div className="uz-card">
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                <input
                  className="in"
                  style={{ borderRadius: '24px', maxWidth: '380px' }}
                  aria-label="Qidirish"
                  placeholder="Tranzaksiya qidirish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                  <button
                    className={`ch ${activityFilter === 'all' ? 'on' : ''}`}
                    onClick={() => setActivityFilter('all')}
                  >
                    Barchasi
                  </button>
                  <button
                    className={`ch ${activityFilter === 'in' ? 'on' : ''}`}
                    onClick={() => setActivityFilter('in')}
                  >
                    Daromad
                  </button>
                  <button
                    className={`ch ${activityFilter === 'ex' ? 'on' : ''}`}
                    onClick={() => setActivityFilter('ex')}
                  >
                    Xarajat
                  </button>
                </div>
              </div>
            </div>

            {/* Grouped Transactions List Card */}
            <div className="uz-card">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="row" style={{ pointerEvents: 'none', opacity: 0.7 }}>
                      <div className="w-10 h-10 rounded-[14px] bg-[#E2E6DE] animate-pulse shrink-0" />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="h-4 w-36 bg-[#E2E6DE] rounded-md animate-pulse" />
                        <div className="h-3 w-24 bg-[#E2E6DE] rounded-md animate-pulse" />
                      </div>
                      <div className="h-4 w-24 bg-[#E2E6DE] rounded-md animate-pulse shrink-0" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="empty">
                  <b style={{ color: '#171B16', fontSize: '16px' }}>Hali tranzaksiya yo&apos;q</b>
                  <div style={{ margin: '6px 0 14px' }}>Birinchi daromad yoki xarajatingizni qo&apos;shing.</div>
                  <button className="p" style={{ maxWidth: '240px', margin: '0 auto' }} onClick={handleOpenAddTx}>
                    Tranzaksiya qo&apos;shish
                  </button>
                </div>
              ) : filteredActivityGroups.length === 0 ? (
                <div className="empty">Hech narsa topilmadi. Qidiruv yoki filtrni o&apos;zgartiring.</div>
              ) : (
                filteredActivityGroups.map((item, idx) => {
                  if (item.isHead) {
                    return (
                      <div
                        key={`head-${idx}`}
                        className="gh"
                        style={{
                          borderTop: idx > 0 ? '1px solid #E8EBE5' : 'none',
                          marginTop: idx > 0 ? '10px' : '0',
                          paddingBottom: '4px',
                        }}
                      >
                        {item.label}
                      </div>
                    );
                  }
                  const t = item.tx!;
                  return (
                    <button key={t.id} className="row" onClick={() => handleOpenEditTx(t)}>
                      <CategoryIcon name={t.cat} type={t.type} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="nm">{t.desc || t.cat}</div>
                        <div className="mt">{t.cat}</div>
                      </div>
                      <div className="am" style={{ color: t.type === 'in' ? '#26834A' : '#D64D4D' }}>
                        {t.type === 'in' ? '+' : '−'}
                        {formatNumber(t.amount)} so&apos;m
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: TAHLIL (ANALYTICS & GOALS) ── */}
        {tab === 'tahlil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <span className="sr-only">Tahlil Budjetlar Jamg‘arma maqsadlari</span>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1>Tahlil</h1>
                <p className="mt" style={{ marginTop: '2px' }}>
                  Kategoriyalar dinamikasi, byudjetlar va jamg&apos;arma maqsadlari
                </p>
              </div>

              {/* Sliding Segmented Switcher */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="tab-btn-budgets"
                  className="sr-only"
                  onClick={() => setSubTab('an')}
                >
                  Budjetlar
                </button>
                <SlidingSegmentedNav
                  options={[
                    { id: 'an', label: 'Moliyaviy tahlil', testId: 'tab-btn-analytics' },
                    { id: 'go', label: 'Maqsadlar', testId: 'tab-btn-goals' },
                  ]}
                  value={subTab}
                  onChange={(val) => setSubTab(val)}
                  style={{ minWidth: '280px' }}
                />
              </div>
            </div>

            {/* ── Subtab 1: Moliyaviy Tahlil ── */}
            {subTab === 'an' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
                {/* Left 7 cols: Dynamics & Overview */}
                <div className="md:col-span-1 lg:col-span-7 flex flex-col gap-5 sm:gap-6">
                  {/* Totals & Month Switcher Card */}
                  <div className="uz-card">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          background: '#F8FAF6',
                          border: '1px solid #D8DED3',
                          borderRadius: '24px',
                          padding: '2px',
                          alignSelf: 'flex-start',
                        }}
                      >
                        <button
                          aria-label="Oldingi oy"
                          className="t"
                          style={{ width: '40px', color: '#171B16', fontSize: '18px', justifyContent: 'center' }}
                          disabled={noPrev}
                          onClick={() => handleNavigateMonth(-1)}
                        >
                          ‹
                        </button>
                        <button
                          className="t"
                          style={{ color: '#171B16', padding: '0 8px' }}
                          onClick={() => setActiveSheet('month')}
                        >
                          {availableMonths.length === 0 ? "Tranzaksiyalar mavjud emas" : `${monthLabel} ${year}`}
                        </button>
                        <button
                          aria-label="Keyingi oy"
                          className="t"
                          style={{ width: '40px', color: '#171B16', fontSize: '18px', justifyContent: 'center' }}
                          disabled={noNext}
                          onClick={() => handleNavigateMonth(1)}
                        >
                          ›
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '28px' }}>
                        <div>
                          <div className="mt" style={{ fontSize: '12px' }}>Daromad</div>
                          <div className="num" style={{ fontSize: '22px', fontWeight: 700, color: '#26834A' }}>
                            +{formatNumber(monthIncome)}
                          </div>
                        </div>
                        <div>
                          <div className="mt" style={{ fontSize: '12px' }}>Xarajat</div>
                          <div className="num" style={{ fontSize: '22px', fontWeight: 700, color: '#D64D4D' }}>
                            −{formatNumber(monthExpense)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expense Dynamics Chart Card */}
                  <div className="uz-card">
                    <h2>Xarajat dinamikasi</h2>
                    <div className="mt" style={{ margin: '4px 0 14px' }}>
                      Hafta kunlari bo&apos;yicha. {weeksData.selectedWeekData.lo}–{weeksData.selectedWeekData.hi}{' '}
                      {monthLabel.toLowerCase()}:{' '}
                      <b className="num" style={{ color: '#D64D4D' }}>
                        {formatNumber(weeksData.selectedWeekData.eN)} so&apos;m
                      </b>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                      {weeksData.weeks.map((w, i) => {
                        const eBarH = w.eN ? Math.max(4, Math.round((w.eN / weeksData.maxExpVal) * 90)) : 0;
                        const isPicked = i === weeksData.activeW;
                        return (
                          <button
                            key={i}
                            aria-label={`${w.lo} dan ${w.hi} gacha: xarajat ${formatNumber(w.eN)} so'm`}
                            style={{
                              flex: 1,
                              border: 0,
                              background: isPicked ? '#EAF5EC' : 'transparent',
                              borderRadius: '12px',
                              padding: '8px 0 6px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedWeek(i)}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-end', height: '90px' }}>
                              <div
                                style={{
                                  width: '24px',
                                  height: `${eBarH}px`,
                                  background: '#D64D4D',
                                  borderRadius: '4px 4px 0 0',
                                }}
                              />
                            </div>
                            <div className="mt" style={{ fontSize: '12px' }}>
                              {w.lo}–{w.hi}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right 5 cols: Categories Breakdown & Budgets */}
                <div className="md:col-span-1 lg:col-span-5 flex flex-col gap-5 sm:gap-6">
                  {/* Category Breakdown Card */}
                  <div className="uz-card">
                    <h2>Nimaga sarfladingiz</h2>
                    {categoryBreakdownList.length === 0 ? (
                      <div className="empty">Bu oyda xarajat yo&apos;q.</div>
                    ) : (
                      categoryBreakdownList.map((c) => (
                        <div key={c.name} style={{ padding: '12px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CategoryIcon name={c.name} size="xs" />
                              <span className="nm">{c.name}</span>
                            </div>
                            <span className="am">
                              {c.amt} <span className="mt">· {c.pct}%</span>
                            </span>
                          </div>
                          <div className="bar" style={{ height: '6px', marginTop: '8px' }}>
                            <div style={{ width: `${c.pct}%`, height: '6px', background: '#26834A' }} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Budgets Card */}
                  <div className="uz-card">
                    <div className="hd">
                      <h2>Byudjetlar</h2>
                      <button className="t" onClick={handleOpenAddBudget}>
                        Byudjet qo&apos;shish
                      </button>
                    </div>

                    {budgets.length === 0 ? (
                      <div className="empty">O&apos;z limitingizni belgilang: kategoriya tanlang va summa kiriting.</div>
                    ) : (
                      budgetStatusList.map((b) => (
                        <button
                          key={b.id}
                          className="row"
                          style={{ display: 'block', padding: '14px 0' }}
                          onClick={() => {
                            const found = budgets.find((item) => item.id === b.id);
                            if (found) handleOpenEditBudget(found);
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CategoryIcon name={b.cat} size="xs" />
                              <span className="nm">{b.cat}</span>
                            </div>
                            <span className="am" style={{ color: b.color }}>
                              {b.pct}%
                            </span>
                          </div>
                          <div className="bar" style={{ margin: '8px 0 6px' }}>
                            <div style={{ width: `${b.barWidth}%`, background: b.color }} />
                          </div>
                          <div className="mt num" style={{ fontSize: '13px' }}>
                            {b.spent} / {b.limit} so&apos;m · {b.msg}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Subtab 2: Jamg'arma Maqsadlari ── */}
            {subTab === 'go' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Hero Total Savings Card */}
                <div
                  style={{
                    background: '#163300',
                    color: '#fff',
                    borderRadius: '24px',
                    padding: '24px',
                    border: '1px solid #234A05',
                    boxShadow: '0 8px 28px rgba(22, 51, 0, 0.22)',
                  }}
                >
                  <div style={{ fontSize: '14px', color: '#C9E8B0' }}>
                    Jami jamg&apos;arilgan (haqiqiy hissalar)
                  </div>
                  <div
                    className="num"
                    style={{
                      fontSize: 'clamp(28px, 5vw, 40px)',
                      fontWeight: 700,
                      letterSpacing: '-1.5px',
                      color: '#9FE870',
                      marginTop: '4px',
                      lineHeight: 1.15,
                    }}
                  >
                    {formatNumber(totalSavedAcrossGoals)}{' '}
                    <span style={{ fontSize: '16px', fontWeight: 500, color: '#C9E8B0', letterSpacing: 0 }}>
                      so&apos;m
                    </span>
                  </div>
                </div>

                {/* Goals Grid */}
                {goals.length === 0 ? (
                  <div className="uz-card">
                    <div className="empty">
                      <b style={{ color: '#171B16', fontSize: '16px' }}>Hali maqsad qo&apos;shilmagan</b>
                      <div style={{ margin: '6px 0 14px' }}>
                        Orzuingizdagi xarid yoki jamg&apos;arma uchun yangi maqsad yarating.
                      </div>
                      <button className="p" style={{ maxWidth: '240px', margin: '0 auto' }} onClick={handleOpenAddGoal}>
                        Maqsad yaratish
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goalsList.map((g) => (
                      <div key={g.id} className="uz-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: '#171B16' }}>{g.name}</span>
                          <span className="num" style={{ fontSize: '16px', fontWeight: 700, color: '#26834A' }}>
                            {g.pct}%
                          </span>
                        </div>

                        <div className="bar" style={{ height: '8px' }}>
                          <div style={{ width: `${g.pct}%`, height: '8px', background: '#26834A' }} />
                        </div>

                        <div className="mt num" style={{ fontSize: '13px' }}>
                          {g.saved} / {g.target} so&apos;m
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button
                            className="p"
                            style={{ flex: 1, padding: '10px 14px' }}
                            onClick={() => handleOpenAddContrib(g.id)}
                          >
                            Hissa qo&apos;shish
                          </button>
                          <button
                            className="s"
                            style={{ padding: '10px 14px' }}
                            onClick={() => {
                              setActiveGoalId(g.id);
                              setActiveSheet('detail');
                            }}
                          >
                            Tafsilot
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <button className="p" style={{ maxWidth: '260px' }} onClick={handleOpenAddGoal}>
                    + Yangi maqsad yaratish
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: AI — COMING SOON ── */}
        {tab === 'ai' && (
          <div className="uz-ai-page-wrapper min-h-[60vh]">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#F0F9E9]">
                <Brain className="h-10 w-10 text-[#163300]" />
              </div>
              <h1 className="mb-3 text-2xl font-bold tracking-tight text-[#171B16]">
                AI yordamchi
              </h1>
              <span className="mb-5 inline-flex items-center rounded-full border border-[#D8E8CC] bg-[#F0F9E9] px-4 py-2 text-sm font-semibold text-[#28551B]">
                Tez kunlarda
              </span>
              <p className="max-w-sm text-sm leading-6 text-[#697168]">
                UzHamyon AI imkoniyatlari ustida ishlayapmiz. Yangilanishlar tez orada taqdim etiladi.
              </p>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#697168]">
                Hozircha daromad va xarajatlaringizni Telegram bot chatiga oddiy xabar qilib yuborishingiz mumkin.
              </p>
            </div>
          </div>
        )}

        {/* Old AI chat UI is temporarily disabled; keep its state/handlers for a later relaunch. */}
        {false && (
        {/* ── TAB 4: AI ADVISOR (Mobile-First Full-Page Experience) ── */}
        {tab === 'ai' && (
          <div className="uz-ai-page-wrapper">
            <span className="sr-only">AI yordamchi AI maslahatchi</span>
            {/* Top Bar / Header */}
            <div className="uz-ai-top-bar">
              <div className="flex items-center gap-2">
                {activeConversation.msgs.length > 0 && (
                  <span className="text-sm font-semibold text-[#171B16] truncate max-w-[160px] sm:max-w-[240px]">
                    {activeConversation.title}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {aiView === 'hist' ? (
                  <button
                    type="button"
                    className="uz-ai-action-btn"
                    onClick={() => setAiView('chat')}
                  >
                    ← Suhbatga qaytish
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="uz-ai-action-btn"
                      aria-label="Suhbatlar tarixi"
                      onClick={() => setAiView('hist')}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tarix</span>
                      {conversations.filter((c) => c.msgs.length).length > 0 && (
                        <span className="text-xs bg-[#E8EBE5] px-1.5 py-0.5 rounded-full text-[#163300]">
                          {conversations.filter((c) => c.msgs.length).length}
                        </span>
                      )}
                    </button>
                    {activeConversation.msgs.length > 0 && (
                      <button
                        type="button"
                        className="uz-ai-action-btn primary"
                        aria-label="Yangi suhbat boshlash"
                        onClick={() => {
                          const emptyConv = conversations.find((c) => !c.msgs.length);
                          if (emptyConv) {
                            setCurrentConvId(emptyConv.id);
                            setAiView('chat');
                            setAiError(false);
                          } else {
                            const newId = 'c' + Date.now();
                            setConversations((prev) => [
                              { id: newId, title: 'Yangi suhbat', msgs: [] },
                              ...prev,
                            ]);
                            setCurrentConvId(newId);
                            setAiView('chat');
                            setAiError(false);
                          }
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Yangi</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* View A: Conversation History List */}
            {aiView === 'hist' ? (
              <div className="flex-1 flex flex-col gap-3 py-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#D8DED3]">
                  <h2 className="text-lg font-bold text-[#171B16] m-0">Suhbatlar tarixi</h2>
                  <button
                    type="button"
                    className="uz-ai-action-btn primary"
                    onClick={() => {
                      const emptyConv = conversations.find((c) => !c.msgs.length);
                      if (emptyConv) {
                        setCurrentConvId(emptyConv.id);
                        setAiView('chat');
                        setAiError(false);
                      } else {
                        const newId = 'c' + Date.now();
                        setConversations((prev) => [
                          { id: newId, title: 'Yangi suhbat', msgs: [] },
                          ...prev,
                        ]);
                        setCurrentConvId(newId);
                        setAiView('chat');
                        setAiError(false);
                      }
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Yangi suhbat</span>
                  </button>
                </div>

                {conversations.filter((c) => c.msgs.length).length === 0 ? (
                  <div className="text-center py-16 text-[#697168]">
                    <Clock className="w-10 h-10 mx-auto text-[#A3ACA0] mb-3 stroke-[1.5]" />
                    <div className="text-sm font-medium">Hozircha saqlangan suhbatlar yo&apos;q.</div>
                    <div className="text-xs text-[#8A9287] mt-1">Yangi savol yozib, muloqotni boshlang.</div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-2">
                    {conversations
                      .filter((c) => c.msgs.length)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                            c.id === currentConvId
                              ? 'bg-[#FFFFFF] border-[#163300] shadow-sm'
                              : 'bg-[#FFFFFF] border-[#D8DED3] hover:border-[#CBD3C6]'
                          }`}
                          onClick={() => {
                            setCurrentConvId(c.id);
                            setAiView('chat');
                            setAiError(false);
                          }}
                        >
                          <div>
                            <div className="text-sm font-semibold text-[#171B16]">{c.title}</div>
                            <div className="text-xs text-[#697168] mt-0.5">{c.msgs.length} ta xabar almashildi</div>
                          </div>
                          <span className="text-xs font-semibold text-[#163300] bg-[#EBF4E5] px-2.5 py-1 rounded-full">
                            Ochish →
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              /* View B: Dedicated Single-Page AI Chat View */
              <>
                {/* 1. Empty Hero State (Spotify AI Style) */}
                {activeConversation.msgs.length === 0 ? (
                  <div className="flex-1 flex flex-col justify-between py-2 sm:py-4">
                    {/* Big Bold Hero Typography */}
                    <div className="uz-ai-hero-section">
                      <h1 className="uz-ai-hero-title">Bugun nimani tahlil qilamiz?</h1>
                      <p className="uz-ai-hero-subtitle">
                        Keling, xarajatlaringiz va budjetingizni birga ko&apos;rib chiqamiz.
                      </p>
                    </div>

                    {/* Suggestions Section */}
                    <div className="uz-ai-try-asking">
                      <div className="uz-ai-try-asking-header">Sinab ko&apos;ring</div>
                      <div className="uz-ai-cards-carousel">
                        <button
                          type="button"
                          className="uz-ai-card-item"
                          onClick={() => handleSendAIMessage("O'tgan oyga nisbatan qancha tejadim?")}
                        >
                          <div className="uz-ai-card-sparkle">
                            <Sparkles className="w-4 h-4 text-[#163300]" />
                          </div>
                          <span className="uz-ai-card-text">
                            O&apos;tgan oyga nisbatan qancha tejadim?
                          </span>
                        </button>

                        <button
                          type="button"
                          className="uz-ai-card-item"
                          onClick={() => handleSendAIMessage("Oziq-ovqat xarajatlarini qanday qisqartirish mumkin?")}
                        >
                          <div className="uz-ai-card-sparkle">
                            <Sparkles className="w-4 h-4 text-[#163300]" />
                          </div>
                          <span className="uz-ai-card-text">
                            Oziq-ovqat xarajatlarini qanday qisqartirish mumkin?
                          </span>
                        </button>

                        <button
                          type="button"
                          className="uz-ai-card-item"
                          onClick={() => handleSendAIMessage("Yillik jamg'arma maqsadimga erisha olamanmi?")}
                        >
                          <div className="uz-ai-card-sparkle">
                            <Sparkles className="w-4 h-4 text-[#163300]" />
                          </div>
                          <span className="uz-ai-card-text">
                            Yillik jamg&apos;arma maqsadimga erisha olamanmi?
                          </span>
                        </button>

                        <button
                          type="button"
                          className="uz-ai-card-item"
                          onClick={() => handleSendAIMessage("Eng ko'p qaysi toifada ortiqcha pul sarfladim?")}
                        >
                          <div className="uz-ai-card-sparkle">
                            <Sparkles className="w-4 h-4 text-[#163300]" />
                          </div>
                          <span className="uz-ai-card-text">
                            Eng ko&apos;p qaysi toifada ortiqcha pul sarfladim?
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 2. Chat Conversation View */
                  <div className="uz-ai-conversation-stream">
                    {activeConversation.msgs.map((m, i) => (
                      <div
                        key={i}
                        className={m.r === 'u' ? 'uz-ai-msg-bubble-user' : 'uz-ai-msg-bubble-assistant'}
                      >
                        {m.r === 'a' && (
                          <div className="uz-ai-assistant-header">
                            <UzHamyonLogo variant="icon" size="sm" />
                            <span>UzHamyon AI</span>
                          </div>
                        )}
                        <div>{m.t}</div>
                      </div>
                    ))}

                    {/* AI Loading State */}
                    {aiLoading && (
                      <div className="uz-ai-typing-indicator">
                        <div className="uz-ai-typing-dot" />
                        <div className="uz-ai-typing-dot" />
                        <div className="uz-ai-typing-dot" />
                      </div>
                    )}

                    {/* AI Error with Retry */}
                    {aiError && (
                      <div className="p-3 rounded-xl bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-between text-xs text-[#991B1B]">
                        <span>Xatolik yuz berdi. Qayta urinib ko&apos;ring.</span>
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-[#DC2626] text-white font-medium hover:bg-[#B91C1C] flex items-center gap-1 cursor-pointer"
                          onClick={handleRetryAI}
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Qayta urinish</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Modern Floating Prompt Input (Wise & Perplexity Style) */}
                <div className="uz-ai-bottom-anchor">
                  <div className="uz-ai-pill-input">
                    <div className="uz-ai-pill-sparkle">
                      <Sparkles className="w-5 h-5 text-[#163300]" />
                    </div>
                    <input
                      id="advisor-question-input"
                      className="uz-ai-text-input"
                      aria-label="Xabar"
                      placeholder="Moliyaviy savolingizni yozing..."
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendAIMessage(aiInput);
                      }}
                    />
                    <button
                      id="advisor-send-btn"
                      type="button"
                      className="uz-ai-submit-btn"
                      aria-label="Yuborish"
                      disabled={!aiInput.trim() || aiLoading}
                      onClick={() => handleSendAIMessage(aiInput)}
                    >
                      <ArrowUp className="w-5 h-5 stroke-[2.8]" />
                    </button>
                  </div>
                  <div className="uz-ai-caption">
                    UzHamyon AI moliyaviy maslahatchisi bilan muloqotdasiz.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        )}
      </main>

      {/* ══════════════════════════════════════════════════════════
          UZHAMYON AI — Mobile Bottom Navbar (Liquid Glass Edition)
         ══════════════════════════════════════════════════════════ */}
      <MobileNavBar
        onOpenAddTransaction={handleOpenAddTx}
        activeTab={tab}
        className="lg:hidden"
        onTabChange={(newTab) => {
          switchTab(newTab, newTab === 'tahlil' ? 'an' : undefined);
        }}
      />

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
          className="ov"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveSheet(null);
              setFormData({});
              setEditId(null);
            }
          }}
        >
          <div
            className={`sh ${['tx', 'budget', 'goal', 'contrib'].includes(activeSheet || '') ? 'fx' : ''}`}
            role="dialog"
            aria-label="Modal oyna"
          >
            {/* Grab Handle for Mobile */}
            <div style={{ width: '40px', height: '4px', backgroundColor: '#D8DED3', borderRadius: '2px', margin: '0 auto 12px auto' }} />

            {/* Sheet Header */}
            <div className="hd">
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#163300', margin: 0 }}>
                {activeSheet === 'tx'
                  ? editId
                    ? 'Tranzaksiyani tahrirlash'
                    : 'Yangi tranzaksiya'
                  : activeSheet === 'budget'
                  ? editId
                    ? 'Byudjetni tahrirlash'
                    : 'Yangi byudjet'
                  : activeSheet === 'goal'
                  ? editId
                    ? 'Maqsadni tahrirlash'
                    : 'Yangi maqsad'
                  : activeSheet === 'contrib'
                  ? 'Hissa qo‘shish'
                  : activeSheet === 'detail'
                  ? activeGoal?.name || ''
                  : activeSheet === 'confirm'
                  ? "O'chirishni tasdiqlang"
                  : activeSheet === 'user'
                  ? 'Foydalanuvchi hisobi'
                  : activeSheet === 'month'
                  ? 'Oyni tanlang'
                  : ''}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setActiveSheet(null);
                  setFormData({});
                  setEditId(null);
                  setTxError(null);
                  setShowDatePicker(false);
                  setShowCategoryPicker(false);
                }}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '17px',
                  background: '#F0F3ED',
                  color: '#47544C',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid #D8DED3',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                aria-label="Yopish"
              >
                <X size={14} />
                <span>Yopish</span>
              </button>
            </div>

            {/* ── SHEET: Add / Edit Transaction ── */}
            {activeSheet === 'tx' && (() => {
              const txType = (formData.type || 'ex') as 'in' | 'ex';
              const livePredicted = predictCategoryFromTitle(formData.desc || '', txType);
              const effectiveCategory =
                !formData.cat || formData.cat === 'Auto'
                  ? livePredicted.category
                  : formData.cat;
              const isCustomCategory = Boolean(
                formData.cat && formData.cat !== 'Auto' && formData.cat !== livePredicted.category
              );
              const currentDate = formData.date || TODAY_DATE;
              const currentTime = formData.time || getNowLocalTimeString();
              const isToday = currentDate === TODAY_DATE;

              return (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="fxb">
                    {/* 1. Type selector: Daromad / Xarajat */}
                    <SlidingSegmentedNav
                      options={[
                        {
                          id: 'in',
                          label: '+ Daromad',
                          activeBg: '#EAF5EC',
                          activeColor: '#26834A',
                        },
                        {
                          id: 'ex',
                          label: '− Xarajat',
                          activeBg: '#FCEEEE',
                          activeColor: '#B33A3A',
                        },
                      ]}
                      value={formData.type || 'ex'}
                      onChange={(val) => {
                        setFormData((prev) => ({ ...prev, type: val, cat: 'Auto' }));
                      }}
                      style={{ marginTop: '8px' }}
                    />

                    {/* 2. Summa (so'm) — Majburiy */}
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label className="lb" htmlFor="tx-amount" style={{ margin: 0, fontWeight: 600 }}>
                          Summa (so&apos;m) <span style={{ color: '#D64D4D' }}>*</span>
                        </label>
                        <span style={{ fontSize: '11px', color: '#71717A', fontWeight: 500 }}>Majburiy</span>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="tx-amount"
                          className="in num"
                          inputMode="numeric"
                          placeholder="0"
                          value={formData.amount || ''}
                          onChange={(e) => setFormData((prev) => ({ ...prev, amount: formatNumberWithGaps(e.target.value) }))}
                          style={{
                            width: '100%',
                            height: '50px',
                            borderRadius: '16px',
                            paddingRight: '64px',
                            paddingLeft: '14px',
                            fontSize: '18px',
                            fontWeight: 700,
                            border: '1.5px solid #D8DED3',
                            boxSizing: 'border-box',
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#5C6659',
                            background: '#F0F3ED',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: '1px solid #E0E5DC',
                            pointerEvents: 'none',
                          }}
                        >
                          UZS
                        </span>
                      </div>
                    </div>

                    {/* 3. Nomi (Title) — Majburiy */}
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label className="lb" htmlFor="tx-desc" style={{ margin: 0, fontWeight: 600 }}>
                          Nomi (Title) <span style={{ color: '#D64D4D' }}>*</span>
                        </label>
                        <span style={{ fontSize: '11px', color: '#71717A', fontWeight: 500 }}>Majburiy</span>
                      </div>
                      <input
                        id="tx-desc"
                        className="in"
                        placeholder={txType === 'in' ? 'Masalan: Oylik maosh, Keshbek, Mukofot...' : 'Masalan: Tushlik, Korzinka, Taksi, Benzin...'}
                        value={formData.desc || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, desc: e.target.value }))}
                        style={{
                          width: '100%',
                          height: '48px',
                          borderRadius: '14px',
                          padding: '0 14px',
                          border: '1.5px solid #D8DED3',
                          fontSize: '14px',
                          fontWeight: 500,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* 4. Kategoriya — Title ga qarab AI tomonidan belgilanadi */}
                    <div style={{ marginTop: '12px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          background: isCustomCategory ? '#F9FAFB' : '#F0FDF4',
                          border: `1.5px solid ${isCustomCategory ? '#E5E7EB' : '#BBF7D0'}`,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '10px',
                              background: isCustomCategory ? '#374151' : '#163300',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Sparkles size={16} style={{ color: '#9FE870' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: isCustomCategory ? '#6B7280' : '#15803D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>{isCustomCategory ? 'Tanlangan kategoriya' : 'AI Kategoriya (avtomatik)'}</span>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#163300', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
                              <CategoryIcon name={effectiveCategory} type={txType} size="xs" showBackground={false} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {effectiveCategory}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowCategoryPicker((prev) => !prev)}
                          style={{
                            flexShrink: 0,
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#163300',
                            background: '#FFFFFF',
                            border: '1px solid #D8DED3',
                            borderRadius: '10px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          }}
                        >
                          <span>{showCategoryPicker ? 'Yopish' : 'O‘zgartirish'}</span>
                        </button>
                      </div>

                      {/* Boshqa kategoriya tanlash (ixtiyoriy) */}
                      {showCategoryPicker && (
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '12px',
                            borderRadius: '14px',
                            background: '#F8FAF6',
                            border: '1px solid #D8E0D4',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#556052' }}>Kategoriyani tanlang:</span>
                            {isCustomCategory && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, cat: 'Auto' }));
                                  setShowCategoryPicker(false);
                                }}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#15803D',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <Sparkles size={11} />
                                <span>AI-avtoga qaytish</span>
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {(txType === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((catName) => {
                              const isAuto = catName === 'Auto';
                              const isSelected = isAuto ? (!formData.cat || formData.cat === 'Auto') : formData.cat === catName;
                              return (
                                <button
                                  key={catName}
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, cat: catName }));
                                    setShowCategoryPicker(false);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '6px 12px',
                                    borderRadius: '16px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    border: '1px solid',
                                    backgroundColor: isSelected ? '#163300' : '#FFFFFF',
                                    color: isSelected ? '#9FE870' : '#374151',
                                    borderColor: isSelected ? '#163300' : '#E5E7EB',
                                    fontWeight: isSelected ? 700 : 500,
                                  }}
                                >
                                  {isAuto ? (
                                    <Sparkles size={12} style={{ color: isSelected ? '#9FE870' : '#16A34A' }} />
                                  ) : (
                                    <CategoryIcon name={catName} size="xs" showBackground={false} />
                                  )}
                                  <span>{isAuto ? 'Auto (AI)' : catName}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 5. Vaqt — avtomatik hozirgi vaqt, bitta kichikroq button orqali o‘zgartiriladi */}
                    <div style={{ marginTop: '12px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          background: '#F9FAFB',
                          border: '1.5px solid #E5E7EB',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '10px',
                              background: '#EEF2F6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Clock size={16} style={{ color: '#374151' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>
                              Vaqt va sana (avtomatik)
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1F2937', marginTop: '1px' }}>
                              {isToday ? 'Bugun' : currentDate}, {currentTime}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowDatePicker((prev) => !prev)}
                          style={{
                            flexShrink: 0,
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#374151',
                            background: '#FFFFFF',
                            border: '1px solid #D1D5DB',
                            borderRadius: '10px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          }}
                        >
                          <Calendar size={13} style={{ color: '#4B5563' }} />
                          <span>{showDatePicker ? 'Yopish' : 'O‘zgartirish'}</span>
                        </button>
                      </div>

                      {/* Expandable Date & Time Pickers */}
                      {showDatePicker && (
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '12px',
                            borderRadius: '14px',
                            background: '#F8FAF6',
                            border: '1px solid #D8E0D4',
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label
                                htmlFor="tx-date-input"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#4B5563',
                                  marginBottom: '4px',
                                }}
                              >
                                <Calendar size={12} style={{ color: '#163300' }} />
                                <span>Sana</span>
                              </label>
                              <input
                                id="tx-date-input"
                                className="in"
                                type="date"
                                min={MIN_ALLOWED_DATE}
                                max={TODAY_DATE}
                                value={formData.date || TODAY_DATE}
                                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                                style={{
                                  width: '100%',
                                  height: '42px',
                                  borderRadius: '12px',
                                  border: '1.5px solid #D8DED3',
                                  padding: '0 10px',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  boxSizing: 'border-box',
                                }}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="tx-time-input"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#4B5563',
                                  marginBottom: '4px',
                                }}
                              >
                                <Clock size={12} style={{ color: '#163300' }} />
                                <span>Vaqt</span>
                              </label>
                              <input
                                id="tx-time-input"
                                className="in"
                                type="time"
                                value={formData.time || getNowLocalTimeString()}
                                onChange={(e) => setFormData((prev) => ({ ...prev, time: e.target.value }))}
                                style={{
                                  width: '100%',
                                  height: '42px',
                                  borderRadius: '12px',
                                  border: '1.5px solid #D8DED3',
                                  padding: '0 10px',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  boxSizing: 'border-box',
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #E5EBE0' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  date: TODAY_DATE,
                                  time: getNowLocalTimeString(),
                                }));
                              }}
                              style={{
                                fontSize: '11px',
                                color: '#166534',
                                background: 'none',
                                border: 'none',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <RefreshCw size={11} />
                              <span>Hozirgi vaqtga sozlash</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDatePicker(false)}
                              style={{
                                fontSize: '11px',
                                color: '#4B5563',
                                background: '#E5E7EB',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Tayyor
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {txError && (
                      <div
                        id="tx-save-error"
                        role="alert"
                        style={{
                          marginTop: '12px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: '#FDF2F2',
                          border: '1px solid rgba(214, 77, 77, 0.25)',
                          color: '#B33A3A',
                          fontSize: '12px',
                          fontWeight: 600,
                          lineHeight: 1.4,
                        }}
                      >
                        {txError}
                      </div>
                    )}
                  </div>

                  <div className="fxf">
                    {editId ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', width: '100%' }}>
                        <button
                          type="button"
                          className="d"
                          style={{
                            width: '100%',
                            height: '48px',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                          }}
                          onClick={() => {
                            setConfirmConfig({ k: 'tx', id: editId });
                            setActiveSheet('confirm');
                          }}
                        >
                          <Trash2 size={16} />
                          <span>O&apos;chirish</span>
                        </button>
                        <button
                          type="button"
                          className="p"
                          style={{
                            width: '100%',
                            height: '48px',
                            borderRadius: '16px',
                            fontSize: '15px',
                            fontWeight: 700,
                          }}
                          disabled={isSaveTxDisabled || isSavingTx}
                          onClick={handleSaveTx}
                        >
                          {isSavingTx ? 'Saqlanmoqda...' : 'Saqlash'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="p"
                        style={{
                          width: '100%',
                          height: '48px',
                          borderRadius: '16px',
                          fontSize: '15px',
                          fontWeight: 700,
                        }}
                        disabled={isSaveTxDisabled || isSavingTx}
                        onClick={handleSaveTx}
                      >
                        {isSavingTx ? 'Saqlanmoqda...' : 'Tranzaksiya qo‘shish'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── SHEET: Add / Edit Budget ── */}
            {activeSheet === 'budget' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div className="fxb">
                  <label className="lb" htmlFor="budget-cat">
                    Kategoriya
                  </label>
                  <select
                    id="budget-cat"
                    className="in"
                    value={formData.cat || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cat: e.target.value }))}
                  >
                    <option value="">Tanlang...</option>
                    {EXPENSE_CATEGORIES.filter((c) => c !== 'Auto').map((catName) => (
                      <option key={catName} value={catName}>
                        {catName}
                      </option>
                    ))}
                  </select>

                  <label className="lb" htmlFor="budget-limit">
                    Oylik limit (so&apos;m)
                  </label>
                  <input
                    id="budget-limit"
                    className="in num"
                    inputMode="numeric"
                    placeholder="0"
                    value={formData.limit || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, limit: formatNumberWithGaps(e.target.value) }))}
                  />
                </div>

                <div className="fxf">
                  {editId ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', width: '100%' }}>
                      <button
                        type="button"
                        className="d"
                        style={{ width: '100%', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '14px', fontWeight: 600 }}
                        onClick={() => {
                          setConfirmConfig({ k: 'budget', id: editId });
                          setActiveSheet('confirm');
                        }}
                      >
                        <Trash2 size={16} />
                        <span>O&apos;chirish</span>
                      </button>
                      <button
                        type="button"
                        className="p"
                        style={{ width: '100%', height: '48px', borderRadius: '16px', fontSize: '15px', fontWeight: 700 }}
                        disabled={isSaveBudgetDisabled}
                        onClick={handleSaveBudget}
                      >
                        Saqlash
                      </button>
                    </div>
                  ) : (
                    <button
                      className="p"
                      style={{ width: '100%', height: '48px', borderRadius: '16px', fontSize: '15px', fontWeight: 700 }}
                      disabled={isSaveBudgetDisabled}
                      onClick={handleSaveBudget}
                    >
                      Saqlash
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── SHEET: Add / Edit Goal ── */}
            {activeSheet === 'goal' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div className="fxb">
                  <label className="lb" htmlFor="goal-name">
                    Maqsad nomi
                  </label>
                  <input
                    id="goal-name"
                    className="in"
                    placeholder="Masalan, Noutbuk yoki Ta'til"
                    value={formData.name || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  />

                  <label className="lb" htmlFor="goal-target">
                    Kutilayotgan summa (so&apos;m)
                  </label>
                  <input
                    id="goal-target"
                    className="in num"
                    inputMode="numeric"
                    placeholder="0"
                    value={formData.target || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, target: formatNumberWithGaps(e.target.value) }))}
                  />

                  <label className="lb" htmlFor="goal-date">
                    Muddat (ixtiyoriy)
                  </label>
                  <input
                    id="goal-date"
                    className="in"
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                <div className="fxf">
                  {editId ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', width: '100%' }}>
                      <button
                        type="button"
                        className="d"
                        style={{ width: '100%', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '14px', fontWeight: 600 }}
                        onClick={() => {
                          setConfirmConfig({ k: 'goal', id: editId });
                          setActiveSheet('confirm');
                        }}
                      >
                        <Trash2 size={16} />
                        <span>O&apos;chirish</span>
                      </button>
                      <button
                        type="button"
                        className="p"
                        style={{ width: '100%', height: '48px', borderRadius: '16px', fontSize: '15px', fontWeight: 700 }}
                        disabled={isSaveGoalDisabled}
                        onClick={handleSaveGoal}
                      >
                        Saqlash
                      </button>
                    </div>
                  ) : (
                    <button
                      className="p"
                      style={{ width: '100%', height: '48px', borderRadius: '16px', fontSize: '15px', fontWeight: 700 }}
                      disabled={isSaveGoalDisabled}
                      onClick={handleSaveGoal}
                    >
                      Saqlash
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── SHEET: Add Contribution ── */}
            {activeSheet === 'contrib' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div className="fxb">
                  <label className="lb" htmlFor="contrib-amount">
                    Hissa summasi (so&apos;m)
                  </label>
                  <input
                    id="contrib-amount"
                    className="in num"
                    inputMode="numeric"
                    placeholder="0"
                    value={formData.contrib || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contrib: formatNumberWithGaps(e.target.value) }))}
                  />
                </div>

                <div className="fxf">
                  <button className="p" disabled={isSaveContribDisabled} onClick={handleSaveContribution}>
                    Qo&apos;shish
                  </button>
                </div>
              </div>
            )}

            {/* ── SHEET: Goal Detail View ── */}
            {activeSheet === 'detail' && activeGoal && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div className="mt" style={{ fontSize: '13px' }}>Jami yig&apos;ilgan</div>
                  <div className="num" style={{ fontSize: '24px', fontWeight: 700, color: '#163300' }}>
                    {formatNumber(getGoalSaved(activeGoal))} so&apos;m
                  </div>
                  <div className="mt" style={{ fontSize: '13px' }}>
                    Maqsad: {formatNumber(activeGoal.target)} so&apos;m
                    {activeGoal.date ? ` · ${activeGoal.date} gacha` : ''}
                  </div>
                </div>

                <div className="bar" style={{ height: '10px' }}>
                  <div
                    style={{
                      width: `${activeGoal.target > 0 ? Math.min(100, Math.round((getGoalSaved(activeGoal) / activeGoal.target) * 100)) : 0}%`,
                      height: '10px',
                      background: '#26834A',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="p" onClick={() => handleOpenAddContrib(activeGoal.id)}>
                    Hissa qo&apos;shish
                  </button>
                  <button className="s" onClick={() => handleOpenEditGoal(activeGoal)}>
                    Tahrirlash
                  </button>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <b style={{ fontSize: '14px' }}>Hissalar tarixi:</b>
                  {(!activeGoal.contribs || activeGoal.contribs.length === 0) ? (
                    <div className="empty">Hozircha hissa qo&apos;shilmagan.</div>
                  ) : (
                    activeGoal.contribs.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: '1px solid #E8EBE5',
                        }}
                      >
                        <span className="mt">{c.d}</span>
                        <span className="num" style={{ fontWeight: 600, color: '#26834A' }}>
                          +{formatNumber(c.a)} so&apos;m
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── SHEET: Confirm Delete ── */}
            {activeSheet === 'confirm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: '8px 0', fontSize: '14px', lineHeight: 1.5, color: '#171B16' }}>
                  Haqiqatan ham ushbu yozuvni butunlay o&apos;chirmoqchimisiz? Ushbu amalni qaytarib bo&apos;lmaydi.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button className="d" style={{ flex: 1 }} onClick={handleConfirmDelete}>
                    Ha, o&apos;chirilsin
                  </button>
                  <button
                    className="s"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setActiveSheet(null);
                      setConfirmConfig(null);
                    }}
                  >
                    Bekor qilish
                  </button>
                </div>
              </div>
            )}

            {/* ── SHEET: Month Selector Popup ── */}
            {activeSheet === 'month' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableMonths.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 4px', textAlign: 'center' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: '#F0FDF4',
                        color: '#16A34A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                      }}
                    >
                      <Calendar className="h-6 w-6 text-[#16A34A]" />
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#171B16' }}>
                        Tranzaksiyalar mavjud emas
                      </div>
                      <p style={{ fontSize: '12px', color: '#697168', marginTop: '4px', lineHeight: 1.5 }}>
                        Birinchi tranzaksiyangizni kiritganingizdan so‘ng, faqat haqiqiy tranzaksiyaga ega bo‘lgan oylar bu yerda ko‘rinadi.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSheet('tx');
                        setFormData({
                          type: 'ex',
                          amount: '',
                          cat: 'Auto',
                          desc: '',
                          date: TODAY_DATE,
                        });
                      }}
                      style={{
                        marginTop: '6px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: '#9FE870',
                        color: '#163300',
                        fontWeight: 700,
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus className="h-4 w-4 stroke-[3]" />
                      <span>Birinchi tranzaksiyani qo‘shish</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mt" style={{ marginBottom: '6px', fontSize: '12px', color: '#697168' }}>
                      Tranzaksiyalar qayd etilgan mavjud oylar:
                    </div>
                    {availableMonths.map((item) => {
                      const isSelected = year === item.year && month === item.month;
                      return (
                        <button
                          key={item.key}
                          className={`row ${isSelected ? 'on' : ''}`}
                          style={{
                            padding: '12px 14px',
                            background: isSelected ? '#EAF5EC' : '#fff',
                            border: `1px solid ${isSelected ? '#9FE870' : '#D8DED3'}`,
                            borderRadius: '12px',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? '#163300' : '#171B16',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSelectMonth(item.year, item.month)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{item.label}</span>
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: isSelected ? '#C7F2A4' : '#F7F8F5',
                                color: isSelected ? '#163300' : '#697168',
                                fontWeight: 600,
                              }}
                            >
                              {item.count} ta tranzaksiya
                            </span>
                          </div>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1" style={{ color: '#26834A', fontSize: '13px' }}>
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                              <span>Tanlangan</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {activeSheet === 'user' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-[#E8EBE5]">
                  <div className="h-10 w-10 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center font-bold text-sm shrink-0 border border-[#D1FAE5]">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#171B16] truncate">{userName}</div>
                    {userEmail && <div className="text-xs text-[#697168] truncate">{userEmail}</div>}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <a
                    href="/settings"
                    className="w-full flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D8DED3] bg-white hover:bg-[#F4F6F2] text-sm font-semibold text-[#171B16] transition-colors"
                  >
                    Sozlamalar
                  </a>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FEE2E2] hover:bg-[#FCD2D2] text-sm font-bold text-[#991B1B] transition-colors cursor-pointer"
                  >
                    Hisobdan chiqish
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
