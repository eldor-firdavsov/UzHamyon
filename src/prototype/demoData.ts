/**
 * UzHamyon Prototype — Realistic Demo Data
 *
 * Clearly labeled mock financial figures for Tashkent, Uzbekistan fintech context.
 * NOT connected to production database.
 */

export interface DemoTransaction {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  date: string;
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

export interface DemoChartPoint {
  label: string;
  income: number;
  expense: number;
}

export const DEMO_USER = {
  name: 'Anvar Qodirov',
  avatarInitials: 'AQ',
  phone: '+998 90 123 45 67',
  currency: 'UZS',
  activeMonthLabel: 'Oktabr 2026',
};

// Block 1 & 3: Financial Figures
export const DEMO_OVERVIEW = {
  totalLifetimeIncome: 12000000,   // Jami daromad (lifetime)
  selectedPeriodIncome: 6000000,   // Tanlangan davr daromadi (Oktabr)
  selectedPeriodExpenses: 4950000, // Tanlangan davr xarajatlari (Oktabr)
  allTimeExpenses: 9800000,        // Barcha davr xarajatlari
  netCashFlow: 1050000,            // Sof foyda / tejab qolingan
  savingsRatePercent: 17.5,
  activeMonthLabel: 'Oktabr 2026',
};

// Block 2: Financial Chart Demo Points
export const DEMO_CHART_PERIODS: Record<string, { label: string; points: DemoChartPoint[] }> = {
  '1m': {
    label: 'Joriy oy',
    points: [
      { label: '1-7 okt', income: 6000000, expense: 1240000 },
      { label: '8-14 okt', income: 0, expense: 980000 },
      { label: '15-21 okt', income: 0, expense: 1430000 },
      { label: '22-28 okt', income: 0, expense: 850000 },
      { label: '29-31 okt', income: 0, expense: 450000 },
    ],
  },
  '3m': {
    label: '3 oy',
    points: [
      { label: 'Avgust', income: 6000000, expense: 5200000 },
      { label: 'Sentabr', income: 6000000, expense: 5000000 },
      { label: 'Oktabr', income: 6000000, expense: 4950000 },
    ],
  },
  'all': {
    label: 'Jami davr',
    points: [
      { label: 'Iyun', income: 5500000, expense: 4800000 },
      { label: 'Iyul', income: 5500000, expense: 5100000 },
      { label: 'Avgust', income: 6000000, expense: 5200000 },
      { label: 'Sentabr', income: 6000000, expense: 5000000 },
      { label: 'Oktabr', income: 6000000, expense: 4950000 },
    ],
  },
};

// Block 4: Recent Transactions
export const INITIAL_DEMO_TRANSACTIONS: DemoTransaction[] = [
  {
    id: 'tx-1',
    name: 'Oylik maosh',
    category: 'Daromad',
    categoryIcon: 'wallet',
    date: '28-oktabr, 2026',
    time: '10:30',
    amount: 6000000,
    type: 'income',
    account: 'Asosiy karta',
  },
  {
    id: 'tx-2',
    name: 'Korzinka Supermarket',
    category: 'Oziq-ovqat',
    categoryIcon: 'cart',
    date: '27-oktabr, 2026',
    time: '18:45',
    amount: 320000,
    type: 'expense',
    account: 'Uzcard',
  },
  {
    id: 'tx-3',
    name: 'Yandex Go (Taksi)',
    category: 'Transport',
    categoryIcon: 'car',
    date: '26-oktabr, 2026',
    time: '09:15',
    amount: 42000,
    type: 'expense',
    account: 'Humo',
  },
  {
    id: 'tx-4',
    name: 'Rayhon Milliy Taomlar',
    category: 'Restoran & Kafe',
    categoryIcon: 'coffee',
    date: '25-oktabr, 2026',
    time: '13:20',
    amount: 115000,
    type: 'expense',
    account: 'Uzcard',
  },
  {
    id: 'tx-5',
    name: 'Uztelecom (Internet)',
    category: 'Kommunal & Aloqa',
    categoryIcon: 'wifi',
    date: '24-oktabr, 2026',
    time: '11:00',
    amount: 180000,
    type: 'expense',
    account: 'Humo',
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
