'use client';

import React, { useState, useMemo } from 'react';
import { DesktopHeader } from '@/prototype/components/DesktopHeader';
import { PrototypeHeader } from '@/prototype/components/PrototypeHeader';
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
import { getTransactionsInCalendarMonth, parseLocalDate } from '@/prototype/dateUtils';
import { CheckCircle2, Calendar, Plus } from 'lucide-react';

export default function PrototypeDashboardPage() {
  const [activeTab, setActiveTab] = useState<PrototypeTab>('dashboard');
  const [transactions, setTransactions] = useState<DemoTransaction[]>(INITIAL_DEMO_TRANSACTIONS);
  const [goals, setGoals] = useState<DemoSavingsGoal[]>(DEMO_SAVINGS_GOALS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<DemoSavingsGoal | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reference calendar date: 2026-10-31
  const refDate = parseLocalDate(DEMO_CONFIG.referenceDate);

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
        if (p.year === refDate.year && p.month === refDate.month) {
          monthIncome += tx.amount;
        }
      } else {
        lifetimeExpense += tx.amount;
        if (p.year === refDate.year && p.month === refDate.month) {
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
  }, [transactions, refDate.year, refDate.month]);

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
      {/* ── Desktop Header (Visible on lg: >= 1024px, completely preserved) ── */}
      <DesktopHeader
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onNotificationClick={() => showToast('Hozircha yangi xabarnomalar yo‘q')}
        userName={DEMO_CONFIG.userName}
      />

      {/* ── Mobile Top Header (Visible on < lg, completely preserved) ── */}
      <div className="lg:hidden">
        <PrototypeHeader 
          userName="Aziz" 
          onNotificationClick={() => showToast('Hozircha yangi xabarnomalar yo‘q')} 
        />
      </div>

      {/* ── Main Content Area ── */}
      <main className="flex-1 w-full">
        {activeTab === 'dashboard' ? (
          <div>
            {/* ── MOBILE / TABLET VIEW (< 1024px): Single-Column Streamlined Stack ── */}
            <div className="lg:hidden max-w-lg mx-auto px-4 py-4 space-y-4 pb-28">
              {/* BLOCK 1: Financial Overview (Hero Card + Paired Metric Cards) */}
              <FinancialOverviewBlock
                totalLifetimeIncome={totalLifetimeIncome}
                periodIncome={currentMonthIncome}
                periodExpenses={currentMonthExpenses}
                activeMonthLabel={DEMO_CONFIG.activeMonthLabel}
              />

              {/* BLOCK 2: Financial Chart (Income Green #26834A, Expense Red #D64D4D) */}
              <FinancialChartBlock
                transactions={transactions}
                referenceDate={DEMO_CONFIG.referenceDate}
                financialStartDate={DEMO_CONFIG.financialStartDate}
              />

              {/* BLOCK 3: Monthly Cash Flow */}
              <MonthlyCashFlowBlock
                monthlyIncome={currentMonthIncome}
                monthlyExpenses={currentMonthExpenses}
                allTimeIncome={totalLifetimeIncome}
                allTimeExpenses={allTimeExpenses}
                activeMonthLabel={DEMO_CONFIG.activeMonthLabel}
              />

              {/* BLOCK 4: Recent Transactions (5 Latest with Strict Semantics) */}
              <RecentTransactionsBlock
                transactions={transactions.slice(0, 5)}
                onViewAll={() => setActiveTab('faoliyat')}
                onSelectTransaction={(tx) => showToast(`${tx.name}: ${tx.amount.toLocaleString('uz-UZ')} so‘m`)}
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
              {/* Desktop Header Row: Title & Controls */}
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-bold text-[#171B16] tracking-tight">
                    Moliyaviy holat
                  </h1>
                  <p className="text-sm text-[#697168] mt-0.5">
                    Shaxsiy mablag‘lar, oylik pul oqimi va jamg‘armalar tahlili
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E8EBE5] text-sm font-semibold text-[#171B16] shadow-xs">
                    <Calendar className="w-4 h-4 text-[#26834A]" />
                    <span>{DEMO_CONFIG.activeMonthLabel}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl bg-[#163300] hover:bg-[#234A05] text-white text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4 text-[#9FE870] stroke-[2.5]" />
                    <span>Amal qo‘shish</span>
                  </button>
                </div>
              </div>

              {/* Top Section: Financial Overview (Hero Card 7 cols + Paired Metric Cards 5 cols) */}
              <FinancialOverviewBlock
                totalLifetimeIncome={totalLifetimeIncome}
                periodIncome={currentMonthIncome}
                periodExpenses={currentMonthExpenses}
                activeMonthLabel={DEMO_CONFIG.activeMonthLabel}
              />

              {/* Two-Column Grid: Dominant Chart on Left, Supporting Context on Right */}
              <div className="grid grid-cols-12 gap-6 items-start">
                {/* Left / Primary Column (Chart + Cash Flow Breakdown) */}
                <div className="col-span-7 xl:col-span-8 space-y-6">
                  {/* BLOCK 2: Financial Chart (Dominant Visual Element with Green/Red) */}
                  <FinancialChartBlock
                    transactions={transactions}
                    referenceDate={DEMO_CONFIG.referenceDate}
                    financialStartDate={DEMO_CONFIG.financialStartDate}
                  />

                  {/* BLOCK 3: Monthly Cash Flow (Supporting Breakdown) */}
                  <MonthlyCashFlowBlock
                    monthlyIncome={currentMonthIncome}
                    monthlyExpenses={currentMonthExpenses}
                    allTimeIncome={totalLifetimeIncome}
                    allTimeExpenses={allTimeExpenses}
                    activeMonthLabel={DEMO_CONFIG.activeMonthLabel}
                  />
                </div>

                {/* Right / Supporting Column (Transactions + AI + Goals) */}
                <div className="col-span-5 xl:col-span-4 space-y-6">
                  {/* BLOCK 4: Recent Transactions */}
                  <RecentTransactionsBlock
                    transactions={transactions.slice(0, 5)}
                    onViewAll={() => setActiveTab('faoliyat')}
                    onSelectTransaction={(tx) => showToast(`${tx.name}: ${tx.amount.toLocaleString('uz-UZ')} so‘m`)}
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
