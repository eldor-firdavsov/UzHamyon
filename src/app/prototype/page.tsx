'use client';

import React, { useState, useMemo } from 'react';
import { DesktopHeader } from '@/prototype/components/DesktopHeader';
import { PrototypeHeader } from '@/prototype/components/PrototypeHeader';
import { MonthSelector } from '@/prototype/components/MonthSelector';
import { FinancialOverviewBlock } from '@/prototype/components/FinancialOverviewBlock';
import { FinancialChartBlock } from '@/prototype/components/FinancialChartBlock';
import { MonthlyCashFlowBlock } from '@/prototype/components/MonthlyCashFlowBlock';
import { RecentTransactionsBlock } from '@/prototype/components/RecentTransactionsBlock';
import { AIRecommendationBlock } from '@/prototype/components/AIRecommendationBlock';
import { SavingsGoalsBlock } from '@/prototype/components/SavingsGoalsBlock';
import { FloatingMobileNav, type PrototypeTab } from '@/prototype/components/FloatingMobileNav';
import { AddTransactionModal } from '@/prototype/components/AddTransactionModal';
import { GoalDetailModal } from '@/prototype/components/GoalDetailModal';
import { PlaceholderScreen } from '@/prototype/components/PlaceholderScreen';
import { 
  DEMO_CONFIG, 
  INITIAL_DEMO_TRANSACTIONS, 
  DEMO_SAVINGS_GOALS, 
  type DemoTransaction, 
  type DemoSavingsGoal 
} from '@/prototype/demoData';
import { 
  getTransactionsInCalendarMonth, 
  getDaysInCalendarMonth,
  parseLocalDate,
  UZBEK_MONTH_NAMES
} from '@/prototype/dateUtils';
import { CheckCircle2 } from 'lucide-react';

export default function PrototypeDashboardPage() {
  const [activeTab, setActiveTab] = useState<PrototypeTab>('dashboard');
  const [transactions, setTransactions] = useState<DemoTransaction[]>(INITIAL_DEMO_TRANSACTIONS);
  const [goals, setGoals] = useState<DemoSavingsGoal[]>(DEMO_SAVINGS_GOALS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<DemoSavingsGoal | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── User-Controlled Month Selection State (Default: October 2026) ──
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(10);

  const selectedMonthLabel = `${UZBEK_MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  const daysInSelectedMonth = getDaysInCalendarMonth(selectedYear, selectedMonth);
  const selectedMonthReferenceDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInSelectedMonth).padStart(2, '0')}`;

  // Filter transactions strictly belonging to the currently selected calendar month
  const selectedMonthTransactions = useMemo(() => {
    return getTransactionsInCalendarMonth(transactions, selectedYear, selectedMonth);
  }, [transactions, selectedYear, selectedMonth]);

  // Exact calendar-accurate metrics dynamically calculated from transactions
  const { totalLifetimeIncome, allTimeExpenses, currentMonthIncome, currentMonthExpenses } = useMemo(() => {
    let lifetimeIncome = 0;
    let lifetimeExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    transactions.forEach((tx) => {
      const p = parseLocalDate(tx.date);
      if (tx.type === 'income') {
        lifetimeIncome += tx.amount;
        if (p.year === selectedYear && p.month === selectedMonth) {
          monthIncome += tx.amount;
        }
      } else {
        lifetimeExpense += tx.amount;
        if (p.year === selectedYear && p.month === selectedMonth) {
          monthExpense += tx.amount;
        }
      }
    });

    return {
      totalLifetimeIncome: lifetimeIncome,
      allTimeExpenses: lifetimeExpense,
      currentMonthIncome: monthIncome,
      currentMonthExpenses: monthExpense,
    };
  }, [transactions, selectedYear, selectedMonth]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleAddTransaction = (newTx: DemoTransaction) => {
    setTransactions((prev) => [newTx, ...prev]);
    showToast(`Tranzaksiya muvaffaqiyatli saqlandi: ${newTx.name}`);
  };

  const handleContributeGoal = (goalId: string, amount: number) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id === goalId) {
          return {
            ...g,
            currentAmount: g.currentAmount + amount,
          };
        }
        return g;
      })
    );
    showToast(`Jamg‘arma to‘ldirildi (+${amount.toLocaleString('uz-UZ')} so‘m)`);
  };

  return (
    <div className="min-h-screen bg-[#F7F8F5] text-[#171B16] flex flex-col antialiased">
      {/* ── Desktop Header (Cleaned up: Essential navigation, ONE Add action, Profile) ── */}
      <DesktopHeader
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        userName={DEMO_CONFIG.userName}
      />

      {/* ── Mobile Top Header (Cleaned up: greeting, avatar, no dead buttons) ── */}
      <div className="lg:hidden">
        <PrototypeHeader userName="Aziz" />
      </div>

      {/* ── Main Content Area ── */}
      <main className="flex-1 w-full">
        {activeTab === 'dashboard' ? (
          <div>
            {/* ── MOBILE / TABLET VIEW (< 1024px): Single-Column Streamlined Stack ── */}
            <div className="lg:hidden max-w-lg mx-auto px-4 py-4 space-y-4 pb-28">
              {/* Mobile Month Navigator Control */}
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#171B16] tracking-tight">
                    Moliyaviy holat
                  </h1>
                </div>

                <MonthSelector
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onSelectMonth={(year, month) => {
                    setSelectedYear(year);
                    setSelectedMonth(month);
                  }}
                  financialStartDate={DEMO_CONFIG.financialStartDate}
                  maxDate={DEMO_CONFIG.referenceDate}
                />
              </div>

              {/* BLOCK 1: Financial Overview (Hero Card + Paired Metric Cards) */}
              <FinancialOverviewBlock
                totalLifetimeIncome={totalLifetimeIncome}
                periodIncome={currentMonthIncome}
                periodExpenses={currentMonthExpenses}
                activeMonthLabel={selectedMonthLabel}
              />

              {/* BLOCK 2: Financial Chart (Income Green #26834A, Expense Red #D64D4D) */}
              <FinancialChartBlock
                transactions={transactions}
                referenceDate={selectedMonthReferenceDate}
                financialStartDate={DEMO_CONFIG.financialStartDate}
              />

              {/* BLOCK 3: Monthly Cash Flow */}
              <MonthlyCashFlowBlock
                monthlyIncome={currentMonthIncome}
                monthlyExpenses={currentMonthExpenses}
                allTimeIncome={totalLifetimeIncome}
                allTimeExpenses={allTimeExpenses}
                activeMonthLabel={selectedMonthLabel}
              />

              {/* BLOCK 4: Compact Recent Transactions for Selected Month */}
              <RecentTransactionsBlock
                transactions={selectedMonthTransactions.slice(0, 6)}
                onViewAll={() => setActiveTab('faoliyat')}
                onSelectTransaction={(tx) => showToast(`${tx.name}: ${tx.amount.toLocaleString('uz-UZ')} so‘m`)}
                selectedMonthLabel={selectedMonthLabel}
              />

              {/* BLOCK 5: AI Recommendation */}
              <AIRecommendationBlock onAskAI={() => setActiveTab('ai')} />

              {/* BLOCK 6: Savings Goals Summary */}
              <SavingsGoalsBlock
                goals={goals}
                onViewAllGoals={() => setActiveTab('tahlil')}
                onSelectGoal={(g) => setSelectedGoal(g)}
              />
            </div>

            {/* ── DESKTOP VIEW (>= 1024px): Balanced Spacious Multi-Column Grid ── */}
            <div className="hidden lg:block max-w-7xl mx-auto px-6 xl:px-8 py-8 space-y-6">
              {/* Desktop Header Row: Title & Month Navigation (No duplicate buttons) */}
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-bold text-[#171B16] tracking-tight">
                    Moliyaviy holat
                  </h1>
                  <p className="text-sm text-[#697168] mt-0.5">
                    Shaxsiy mablag‘lar, oylik pul oqimi va jamg‘armalar tahlili
                  </p>
                </div>

                {/* User-Controlled Month Navigation with Arrows & Picker */}
                <div>
                  <MonthSelector
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    onSelectMonth={(year, month) => {
                      setSelectedYear(year);
                      setSelectedMonth(month);
                    }}
                    financialStartDate={DEMO_CONFIG.financialStartDate}
                    maxDate={DEMO_CONFIG.referenceDate}
                  />
                </div>
              </div>

              {/* Top Section: Financial Overview (Hero Card 7 cols + Paired Metric Cards 5 cols) */}
              <FinancialOverviewBlock
                totalLifetimeIncome={totalLifetimeIncome}
                periodIncome={currentMonthIncome}
                periodExpenses={currentMonthExpenses}
                activeMonthLabel={selectedMonthLabel}
              />

              {/* Two-Column Grid: Dominant Chart on Left, Supporting Context on Right */}
              <div className="grid grid-cols-12 gap-6 items-start">
                {/* Left / Primary Column (Chart + Cash Flow Breakdown) */}
                <div className="col-span-7 xl:col-span-8 space-y-6">
                  {/* BLOCK 2: Financial Chart (Income Green #26834A, Expense Red #D64D4D) */}
                  <FinancialChartBlock
                    transactions={transactions}
                    referenceDate={selectedMonthReferenceDate}
                    financialStartDate={DEMO_CONFIG.financialStartDate}
                  />

                  {/* BLOCK 3: Monthly Cash Flow */}
                  <MonthlyCashFlowBlock
                    monthlyIncome={currentMonthIncome}
                    monthlyExpenses={currentMonthExpenses}
                    allTimeIncome={totalLifetimeIncome}
                    allTimeExpenses={allTimeExpenses}
                    activeMonthLabel={selectedMonthLabel}
                  />
                </div>

                {/* Right / Supporting Column (Transactions + AI + Goals) */}
                <div className="col-span-5 xl:col-span-4 space-y-6">
                  {/* BLOCK 4: Compact Recent Transactions for Selected Month */}
                  <RecentTransactionsBlock
                    transactions={selectedMonthTransactions.slice(0, 6)}
                    onViewAll={() => setActiveTab('faoliyat')}
                    onSelectTransaction={(tx) => showToast(`${tx.name}: ${tx.amount.toLocaleString('uz-UZ')} so‘m`)}
                    selectedMonthLabel={selectedMonthLabel}
                  />

                  {/* BLOCK 5: AI Recommendation */}
                  <AIRecommendationBlock onAskAI={() => setActiveTab('ai')} />

                  {/* BLOCK 6: Savings Goals Summary */}
                  <SavingsGoalsBlock
                    goals={goals}
                    onViewAllGoals={() => setActiveTab('tahlil')}
                    onSelectGoal={(g) => setSelectedGoal(g)}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Placeholder screen for secondary tabs during design validation */
          <div className="max-w-4xl mx-auto px-4 py-8">
            <PlaceholderScreen
              tab={activeTab}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          </div>
        )}
      </main>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#163300] text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-full shadow-lg flex items-center gap-2.5 border border-[#9FE870]/30 transition-all animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-[#9FE870] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Floating Mobile Bottom Navigation (Visible ONLY on mobile/tablet < 1024px) ── */}
      <FloatingMobileNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* ── Interactive Add Transaction Sheet / Modal ── */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTransaction={handleAddTransaction}
      />

      {/* ── Interactive Savings Goal Detail Sheet / Modal ── */}
      <GoalDetailModal
        goal={selectedGoal}
        onClose={() => setSelectedGoal(null)}
        onContribute={handleContributeGoal}
      />
    </div>
  );
}
