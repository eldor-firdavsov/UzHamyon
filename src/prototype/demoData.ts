/**
 * UzHamyon Prototype — Realistic Demo Data
 *
 * Clearly labeled mock financial figures for Tashkent, Uzbekistan fintech context.
 * Strictly adheres to real calendar dates, months, and timezone rules.
 * NOT connected to production database.
 */

export interface DemoTransaction {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  date: string; // ISO YYYY-MM-DD
  time?: string;
  amount: number;
  type: 'income' | 'expense';
  account: string;
}

export interface DemoSavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: string;
  icon: string;
}

export const DEMO_CONFIG = {
  userName: 'Aziz Qodirov',
  avatarInitials: 'AQ',
  phone: '+998 90 123 45 67',
  currency: 'so‘m',
  referenceDate: '2026-10-31',
  financialStartDate: '2026-05-01',
  activeMonthLabel: 'Oktabr 2026',
};

// Initial Qualifying Demo Transactions spanning calendar months from financial start date (May 2026)
export const INITIAL_DEMO_TRANSACTIONS: DemoTransaction[] = [
  // ── October 2026 (Active Month: 31 days) ──
  {
    id: 'tx-oct-1',
    name: 'Oylik maosh',
    category: 'Daromad',
    categoryIcon: 'wallet',
    date: '2026-10-28',
    time: '10:30',
    amount: 6000000,
    type: 'income',
    account: 'Asosiy karta',
  },
  {
    id: 'tx-oct-2',
    name: 'Korzinka Supermarket',
    category: 'Oziq-ovqat',
    categoryIcon: 'cart',
    date: '2026-10-27',
    time: '18:45',
    amount: 320000,
    type: 'expense',
    account: 'Uzcard',
  },
  {
    id: 'tx-oct-3',
    name: 'Yandex Go (Taksi)',
    category: 'Transport',
    categoryIcon: 'car',
    date: '2026-10-26',
    time: '09:15',
    amount: 42000,
    type: 'expense',
    account: 'Humo',
  },
  {
    id: 'tx-oct-4',
    name: 'Rayhon Milliy Taomlar',
    category: 'Restoran & Kafe',
    categoryIcon: 'coffee',
    date: '2026-10-25',
    time: '13:20',
    amount: 115000,
    type: 'expense',
    account: 'Uzcard',
  },
  {
    id: 'tx-oct-5',
    name: 'Uztelecom (Internet)',
    category: 'Kommunal & Aloqa',
    categoryIcon: 'wifi',
    date: '2026-10-24',
    time: '11:00',
    amount: 180000,
    type: 'expense',
    account: 'Humo',
  },
  {
    id: 'tx-oct-6',
    name: 'Xonadon kommunal to‘lovlari',
    category: 'Kommunal & Aloqa',
    categoryIcon: 'wifi',
    date: '2026-10-18',
    amount: 1430000,
    type: 'expense',
    account: 'Uzcard',
  },
  {
    id: 'tx-oct-7',
    name: 'Haftalik oziq-ovqat bozori',
    category: 'Oziq-ovqat',
    categoryIcon: 'cart',
    date: '2026-10-11',
    amount: 980000,
    type: 'expense',
    account: 'Humo',
  },
  {
    id: 'tx-oct-8',
    name: 'Texnika ta’mirlash va xarid',
    category: 'Xarid',
    categoryIcon: 'cart',
    date: '2026-10-04',
    amount: 1240000,
    type: 'expense',
    account: 'Uzcard',
  },
  {
    id: 'tx-oct-9',
    name: 'Kechki qahva va shirinlik',
    category: 'Restoran & Kafe',
    categoryIcon: 'coffee',
    date: '2026-10-30',
    amount: 643000,
    type: 'expense',
    account: 'Humo',
  },

  // ── September 2026 (30 days) ──
  {
    id: 'tx-sep-1',
    name: 'Sentabr oylik maoshi',
    category: 'Daromad',
    categoryIcon: 'wallet',
    date: '2026-09-28',
    amount: 6000000,
    type: 'income',
    account: 'Asosiy karta',
  },
  {
    id: 'tx-sep-2',
    name: 'Oziq-ovqat va ro‘zg‘or',
    category: 'Oziq-ovqat',
    categoryIcon: 'cart',
    date: '2026-09-20',
    amount: 3200000,
    type: 'expense',
    account: 'Uzcard',
  },
  {
    id: 'tx-sep-3',
    name: 'Kommunal va internet to‘lovi',
    category: 'Kommunal & Aloqa',
    categoryIcon: 'wifi',
    date: '2026-09-10',
    amount: 1800000,
    type: 'expense',
    account: 'Humo',
  },

  // ── August 2026 (31 days) ──
  {
    id: 'tx-aug-1',
    name: 'Avgust oylik maoshi',
    category: 'Daromad',
    categoryIcon: 'wallet',
    date: '2026-08-28',
    amount: 6000000,
    type: 'income',
    account: 'Asosiy karta',
  },
  {
    id: 'tx-aug-2',
    name: 'Dam olish va sayohat xarajatlari',
    category: 'Transport',
    categoryIcon: 'car',
    date: '2026-08-16',
    amount: 5200000,
    type: 'expense',
    account: 'Uzcard',
  },

  // ── July 2026 (31 days) ──
  {
    id: 'tx-jul-1',
    name: 'Iyul oylik maoshi',
    category: 'Daromad',
    categoryIcon: 'wallet',
    date: '2026-07-28',
    amount: 5500000,
    type: 'income',
    account: 'Asosiy karta',
  },
  {
    id: 'tx-jul-2',
    name: 'Iyul oyi xarajatlari',
    category: 'Oziq-ovqat',
    categoryIcon: 'cart',
    date: '2026-07-15',
    amount: 5100000,
    type: 'expense',
    account: 'Uzcard',
  },

  // ── June 2026 (30 days) ──
  {
    id: 'tx-jun-1',
    name: 'Iyun oylik maoshi',
    category: 'Daromad',
    categoryIcon: 'wallet',
    date: '2026-06-28',
    amount: 5500000,
    type: 'income',
    account: 'Asosiy karta',
  },
  {
    id: 'tx-jun-2',
    name: 'Iyun oyi xarajatlari',
    category: 'Oziq-ovqat',
    categoryIcon: 'cart',
    date: '2026-06-18',
    amount: 4800000,
    type: 'expense',
    account: 'Uzcard',
  },

  // ── May 2026 (Financial Start Date: 2026-05-01, 31 days) ──
  {
    id: 'tx-may-1',
    name: 'May oylik maoshi',
    category: 'Daromad',
    categoryIcon: 'wallet',
    date: '2026-05-28',
    amount: 5500000,
    type: 'income',
    account: 'Asosiy karta',
  },
  {
    id: 'tx-may-2',
    name: 'May oyi xarajatlari',
    category: 'Oziq-ovqat',
    categoryIcon: 'cart',
    date: '2026-05-14',
    amount: 4600000,
    type: 'expense',
    account: 'Uzcard',
  },
];

// Block 5: One Concise AI Recommendation
export const DEMO_AI_RECOMMENDATION = {
  title: 'Moliyaviy tavsiya',
  badge: 'Tahlil natijasi',
  content:
    'Joriy davrda daromadingizning 17.5% qismi (+1 050 000 so‘m) ijobiy qoldiq sifatida tejaldi. Bu mablag‘ni "MacBook Pro" maqsadiga yo‘naltirish tavsiya etiladi.',
  targetGoalId: 'goal-1',
};

// Block 6: Savings Goals Summary
export const DEMO_SAVINGS_GOALS: DemoSavingsGoal[] = [
  {
    id: 'goal-1',
    name: 'MacBook Pro M4',
    targetAmount: 15000000,
    currentAmount: 4800000,
    targetDate: '2027-yil, fevral',
    category: 'Texnika',
    icon: 'laptop',
  },
  {
    id: 'goal-2',
    name: 'Dam olish safari (Dubay)',
    targetAmount: 12000000,
    currentAmount: 7200000,
    targetDate: '2027-yil, may',
    category: 'Sayohat',
    icon: 'plane',
  },
  {
    id: 'goal-3',
    name: 'Favqulodda jamg‘arma fondi',
    targetAmount: 8000000,
    currentAmount: 5600000,
    targetDate: '2026-yil, dekabr',
    category: 'Xavfsizlik',
    icon: 'shield',
  },
];

// Categories for Add Transaction Modal
export const DEMO_CATEGORIES = {
  expense: [
    { id: 'cat-food', name: 'Oziq-ovqat', icon: 'cart' },
    { id: 'cat-transport', name: 'Transport & Taksi', icon: 'car' },
    { id: 'cat-cafe', name: 'Kafe & Restoran', icon: 'coffee' },
    { id: 'cat-utilities', name: 'Kommunal & Aloqa', icon: 'wifi' },
    { id: 'cat-health', name: 'Salomatlik & Dori', icon: 'heart' },
    { id: 'cat-shopping', name: 'Kiyim & Xarid', icon: 'shopping' },
  ],
  income: [
    { id: 'cat-salary', name: 'Oylik maosh', icon: 'wallet' },
    { id: 'cat-freelance', name: 'Frilans / Loyiha', icon: 'laptop' },
    { id: 'cat-invest', name: 'Investitsiya & Depozit', icon: 'trending-up' },
    { id: 'cat-other-inc', name: 'Boshqa tushum', icon: 'plus-circle' },
  ],
};
