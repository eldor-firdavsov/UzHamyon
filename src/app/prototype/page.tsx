'use client';

import React, { useState } from 'react';
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
  DEMO_OVERVIEW, 
  INITIAL_DEMO_TRANSACTIONS, 
  DEMO_SAVINGS_GOALS, 
  type DemoTransaction, 
  type DemoSavingsGoal 
} from '@/prototype/demoData';
import { CheckCircle2, Calendar, Plus } from 'lucide-react';

export default function PrototypeDashboardPage() {
  const [activeTab, setActiveTab] = useState<PrototypeTab>('dashboard');
  const [transactions, setTransactions] = useState<DemoTransaction[]>(INITIAL_DEMO_TRANSACTIONS);
  const [goals, setGoals] = useState<DemoSavingsGoal[]>(DEMO_SAVINGS_GOALS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<DemoSavingsGoal | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Financial figures calculated dynamically from initial demo + added transactions
  const totalLifetimeIncome = DEMO_OVERVIEW.totalLifetimeIncome;
  
  // Calculate expenses and income added during this session
  const addedExpenses = transactions
    .slice(0, transactions.length - INITIAL_DEMO_TRANSACTIONS.length)
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const addedIncome = transactions
    .slice(0, transactions.length - INITIAL_DEMO_TRANSACTIONS.length)
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const periodIncome = DEMO_OVERVIEW.selectedPeriodIncome + addedIncome;
  const periodExpenses = DEMO_OVERVIEW.selectedPeriodExpenses + addedExpenses;
  const allTimeExpenses = DEMO_OVERVIEW.allTimeExpenses + addedExpenses;

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
      {/* ── Desktop Header (Visible on lg: >= 1024px) ── */}
      <DesktopHeader
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onNotificationClick={() => showToast('Hozircha yangi xabarnomalar yo‘q')}
        userName="Aziz Qodirov"
      />

      {/* ── Mobile Top Header (Visible on < lg) ── */}
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
              {/* BLOCK 1: Financial Overview */}
              <FinancialOverviewBlock
                totalLifetimeIncome={totalLifetimeIncome}
                periodIncome={periodIncome}
                periodExpenses={periodExpenses}
                activeMonthLabel={DEMO_OVERVIEW.activeMonthLabel}
              />

              {/* BLOCK 2: Financial Chart */}
              <FinancialChartBlock />

              {/* BLOCK 3: Monthly Cash Flow */}
              <MonthlyCashFlowBlock
                monthlyIncome={periodIncome}
                monthlyExpenses={periodExpenses}
                allTimeIncome={totalLifetimeIncome}
                allTimeExpenses={allTimeExpenses}
                activeMonthLabel={DEMO_OVERVIEW.activeMonthLabel}
              />

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

            {/* ── DESKTOP VIEW (>= 1024px): Balanced Spacious Multi-Column Grid ── */}
            <div className="hidden lg:block max-w-7xl mx-auto px-6 xl:px-8 py-8 space-y-6">
              {/* Desktop Header Row: Title & Controls */}
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h1 className="text-2xl font-bold text-[#171B16] tracking-tight">
                    Moliyaviy holat
                  </h1>
                  <p className="text-xs text-[#697168] mt-0.5">
                    Shaxsiy mablag‘lar, oylik pul oqimi va jamg‘armalar tahlili
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E8EBE5] text-xs font-semibold text-[#171B16] shadow-xs">
                    <Calendar className="w-3.5 h-3.5 text-[#26834A]" />
                    <span>{DEMO_OVERVIEW.activeMonthLabel}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#163300] hover:bg-[#234A05] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#9FE870] stroke-[2.5]" />
                    <span>Amal qo‘shish</span>
                  </button>
                </div>
              </div>

              {/* Top Section: Financial Overview (Clean, unified header) */}
              <FinancialOverviewBlock
                totalLifetimeIncome={totalLifetimeIncome}
                periodIncome={periodIncome}
                periodExpenses={periodExpenses}
                activeMonthLabel={DEMO_OVERVIEW.activeMonthLabel}
              />

              {/* Two-Column Grid: Dominant Chart on Left, Supporting Context on Right */}
              <div className="grid grid-cols-12 gap-6 items-start">
                {/* Left / Primary Column (Chart + Cash Flow Breakdown) */}
                <div className="col-span-7 xl:col-span-8 space-y-6">
                  {/* BLOCK 2: Financial Chart (Dominant Visual Element) */}
                  <FinancialChartBlock />

                  {/* BLOCK 3: Monthly Cash Flow (Supporting Breakdown) */}
                  <MonthlyCashFlowBlock
                    monthlyIncome={periodIncome}
                    monthlyExpenses={periodExpenses}
                    allTimeIncome={totalLifetimeIncome}
                    allTimeExpenses={allTimeExpenses}
                    activeMonthLabel={DEMO_OVERVIEW.activeMonthLabel}
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
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#163300] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-[#9FE870]/30 transition-all animate-in fade-in slide-in-from-top-2 duration-200"
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
