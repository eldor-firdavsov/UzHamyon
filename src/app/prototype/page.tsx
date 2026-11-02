'use client';

import React, { useState } from 'react';
import { MobileFrame } from '@/prototype/components/MobileFrame';
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
import { CheckCircle2, Info } from 'lucide-react';

export default function PrototypeDashboardPage() {
  const [activeTab, setActiveTab] = useState<PrototypeTab>('dashboard');
  const [transactions, setTransactions] = useState<DemoTransaction[]>(INITIAL_DEMO_TRANSACTIONS);
  const [goals, setGoals] = useState<DemoSavingsGoal[]>(DEMO_SAVINGS_GOALS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<DemoSavingsGoal | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Financial figures calculated dynamically from initial demo + added transactions
  const totalLifetimeIncome = DEMO_OVERVIEW.totalLifetimeIncome;
  
  // Calculate expenses added during this session
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
    <MobileFrame>
      {/* ── Top Header Bar ── */}
      <PrototypeHeader 
        userName="Aziz" 
        onNotificationClick={() => showToast('Hozircha yangi xabarnomalar yo‘q')} 
      />

      {/* ── Main Scrollable Body ── */}
      <div className="flex-1 px-3.5 py-3 space-y-4 pb-28">
        {activeTab === 'dashboard' ? (
          <>
            {/* ── BLOCK 1: Financial Overview (Hero Lime + Period Stats) ── */}
            <FinancialOverviewBlock
              totalLifetimeIncome={totalLifetimeIncome}
              periodIncome={periodIncome}
              periodExpenses={periodExpenses}
              activeMonthLabel={DEMO_OVERVIEW.activeMonthLabel}
            />

            {/* ── BLOCK 2: Financial Chart (Income vs Expense Over Time) ── */}
            <FinancialChartBlock />

            {/* ── BLOCK 3: Monthly Cash Flow (Income, Expenses, Net Flow) ── */}
            <MonthlyCashFlowBlock
              monthlyIncome={periodIncome}
              monthlyExpenses={periodExpenses}
              allTimeIncome={totalLifetimeIncome}
              allTimeExpenses={allTimeExpenses}
              activeMonthLabel={DEMO_OVERVIEW.activeMonthLabel}
            />

            {/* ── BLOCK 4: Recent Transactions (5 Latest + Category & Tabular Numbers) ── */}
            <RecentTransactionsBlock
              transactions={transactions.slice(0, 5)}
              onViewAll={() => setActiveTab('faoliyat')}
              onSelectTransaction={(tx) => showToast(`${tx.name}: ${tx.amount.toLocaleString()} so‘m`)}
            />

            {/* ── BLOCK 5: AI Recommendation (One Concise, Actionable Insight) ── */}
            <AIRecommendationBlock onAskAI={() => setActiveTab('ai')} />

            {/* ── BLOCK 6: Savings Goals Summary (Active Goals & Progress) ── */}
            <SavingsGoalsBlock
              goals={goals}
              onViewAllGoals={() => setActiveTab('tahlil')}
              onSelectGoal={(g) => setSelectedGoal(g)}
            />
          </>
        ) : (
          /* Placeholder screen for secondary tabs during design validation */
          <PlaceholderScreen
            tab={activeTab}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}
      </div>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#163300] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-[#9FE870]/30 transition-all animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-[#9FE870] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Floating Mobile Bottom Navigation ── */}
      <FloatingMobileNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* ── Interactive Add Transaction Sheet ── */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTransaction={handleAddTransaction}
      />

      {/* ── Interactive Savings Goal Detail Sheet ── */}
      <GoalDetailModal
        goal={selectedGoal}
        onClose={() => setSelectedGoal(null)}
        onContribute={handleContributeGoal}
      />
    </MobileFrame>
  );
}
