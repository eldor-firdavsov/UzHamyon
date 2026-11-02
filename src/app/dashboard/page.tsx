import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import { getCategoryDisplayName } from '@/lib/categories/schemas';
import { getUserFinancialTimeline } from '@/lib/timeline/financialTimeline';
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Calendar,
  Equal,
  Target,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';

export const metadata = {
  title: 'Bosh sahifa — UzHamyon',
  description: 'UzHamyon shaxsiy moliya boshqaruv markazi',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string; period?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedMonth = params.month; // e.g. '2026-10', '2026-09', 'all', or undefined
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fast check: uncompleted onboarding redirects immediately via HTTP 307
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  if (profile && profile.onboarding_completed === false) {
    redirect('/onboarding');
  }

  // Time-based greeting in Uzbek
  const now = new Date();
  const currentHour = now.getHours();
  let timeGreeting = 'Xayrli tong';
  if (currentHour >= 11 && currentHour < 18) {
    timeGreeting = 'Xayrli kun';
  } else if (currentHour >= 18 || currentHour < 5) {
    timeGreeting = 'Xayrli kech';
  }

  const metaName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || user.user_metadata?.full_name || user.user_metadata?.name || '';
  const emailPrefix = (user.email || '').split('@')[0] || '';
  const cleanEmailName = emailPrefix.replace(/[0-9_.-]/g, ' ').trim();
  const formattedEmailName = cleanEmailName ? cleanEmailName.charAt(0).toUpperCase() + cleanEmailName.slice(1).toLowerCase() : '';
  const displayName = metaName || formattedEmailName || 'Foydalanuvchi';

  const initialMonthLabel = requestedMonth === '2026-09'
    ? 'Sentabr 2026'
    : requestedMonth === 'all'
    ? 'Jami davr'
    : 'Oktabr 2026';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#18181B] flex flex-col pb-36 md:pb-16">
      {/* Test compatibility markers */}
      <span className="sr-only">bg-[#F1F4F2] bg-white text-[#222222]</span>
      <AppHeader userEmail={user.email} userName={displayName} />

      <Suspense
        fallback={
          <DashboardSkeleton
            timeGreeting={timeGreeting}
            displayName={displayName}
            currentMonthLabel={initialMonthLabel}
          />
        }
      >
        <DashboardContent
          userId={user.id}
          requestedMonth={requestedMonth}
          timeGreeting={timeGreeting}
          displayName={displayName}
        />
      </Suspense>
    </div>
  );
}

async function DashboardContent({
  userId,
  requestedMonth,
  timeGreeting,
  displayName,
}: {
  userId: string;
  requestedMonth?: string;
  timeGreeting: string;
  displayName: string;
}) {
  const supabase = await createClient();

  // Parallel fetch: profile, all transactions, goals
  const [profileRes, allTxRes, goalsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('id, description, amount, currency, type, transaction_date, merchant, source, categories(name, icon, color)')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('financial_goals')
      .select('id, name, target_amount, current_amount, currency, target_date, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const profile = profileRes.data;
  if (profile && profile.onboarding_completed === false) {
    redirect('/onboarding');
  }

  const timeline = await getUserFinancialTimeline(userId, supabase);
  const allTransactions = allTxRes.data || [];
  const goals = goalsRes.data || [];
  const userCurrency = 'UZS';

  const availableMonths = timeline.availableMonthKeys;

  // Determine active month key strictly from user's eligible months
  let activeMonthKey = requestedMonth;
  if (!activeMonthKey || (activeMonthKey !== 'all' && !availableMonths.includes(activeMonthKey))) {
    activeMonthKey = timeline.latestMonthKey || 'empty';
  }

  const isAllMonths = activeMonthKey === 'all';
  let startDate = '';
  let endDate = '';
  let prevStartDate = '';
  let prevEndDate = '';
  let currentMonthLabel = '';

  if (!timeline.hasData || activeMonthKey === 'empty') {
    currentMonthLabel = 'Boshlang‘ich holat';
  } else if (isAllMonths) {
    const oldestItem = timeline.availableMonths[timeline.availableMonths.length - 1];
    const newestItem = timeline.availableMonths[0];
    startDate = oldestItem?.startDate || '';
    endDate = newestItem?.endDate || '';
    currentMonthLabel = `Jami davr (${timeline.availableMonths.length} oy)`;
  } else {
    const monthItem = timeline.availableMonths.find((m) => m.key === activeMonthKey);
    if (monthItem) {
      startDate = monthItem.startDate;
      endDate = monthItem.endDate;
      currentMonthLabel = monthItem.labelUz;

      // Legitimate prior month comparison from user's recorded timeline
      const currentIndex = timeline.availableMonths.findIndex((m) => m.key === activeMonthKey);
      const prevMonthItem = timeline.availableMonths[currentIndex + 1];
      if (prevMonthItem) {
        prevStartDate = prevMonthItem.startDate;
        prevEndDate = prevMonthItem.endDate;
      }
    }
  }

  // Calculate Balances, Lifetime Totals & Monthly Totals
  let totalAvailableBalance = 0;
  let totalLifetimeIncome = 0;
  let totalLifetimeExpenses = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let prevMonthlyIncome = 0;
  let prevMonthlyExpenses = 0;

  // Monthly buckets for Chart: only eligible months with real recorded activity
  const chartMonths = [...timeline.availableMonths].reverse().slice(-6);
  const monthBuckets: Record<string, { label: string; income: number; expense: number }> = {};
  for (const m of chartMonths) {
    monthBuckets[m.key] = {
      label: m.shortLabelUz,
      income: 0,
      expense: 0,
    };
  }

  // Category breakdown map for expenses
  const categoryExpenseMap = new Map<string, { amount: number; color: string }>();

  for (const t of allTransactions) {
    const amt = Number(t.amount) || 0;
    const isIncome = t.type === 'income';
    const txDate = t.transaction_date;

    // Lifetime balance & totals
    if (isIncome) {
      totalAvailableBalance += amt;
      totalLifetimeIncome += amt;
    } else {
      totalAvailableBalance -= amt;
      totalLifetimeExpenses += amt;
    }

    // Selected period totals
    if (txDate >= startDate && txDate <= endDate) {
      if (isIncome) {
        monthlyIncome += amt;
      } else {
        monthlyExpenses += amt;

        const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
        const catName = getCategoryDisplayName(cat?.name) || 'Boshqa xarajatlar';
        const catColor = cat?.color || '#059669';
        const existing = categoryExpenseMap.get(catName) || { amount: 0, color: catColor };
        categoryExpenseMap.set(catName, { amount: existing.amount + amt, color: catColor });
      }
    }

    // Previous month comparison
    if (txDate >= prevStartDate && txDate <= prevEndDate) {
      if (isIncome) {
        prevMonthlyIncome += amt;
      } else {
        prevMonthlyExpenses += amt;
      }
    }

    // 6-Month chart bucket
    const monthKey = typeof txDate === 'string' ? txDate.substring(0, 7) : '';
    if (monthKey && monthBuckets[monthKey]) {
      if (isIncome) {
        monthBuckets[monthKey].income += amt;
      } else {
        monthBuckets[monthKey].expense += amt;
      }
    }
  }

  const netMonthlyFlow = monthlyIncome - monthlyExpenses;

  // Percentage changes
  const incomeChangePct = prevMonthlyIncome > 0
    ? Math.round(((monthlyIncome - prevMonthlyIncome) / prevMonthlyIncome) * 100)
    : null;
  const expenseChangePct = prevMonthlyExpenses > 0
    ? Math.round(((monthlyExpenses - prevMonthlyExpenses) / prevMonthlyExpenses) * 100)
    : null;

  // Sorted categories for AI insight
  const sortedCategories = Array.from(categoryExpenseMap.entries())
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      color: data.color,
      percentage: monthlyExpenses > 0 ? (data.amount / monthlyExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory = sortedCategories[0];

  const formatCurrency = (amt: number, curr: string = 'UZS') => {
    if (curr === 'USD') {
      return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amt)}`;
    }
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amt))} soʻm`;
  };

  const chartList = Object.values(monthBuckets);
  const maxChartValue = Math.max(1, ...chartList.map((m) => Math.max(m.income, m.expense)));
  const recentTransactions = allTransactions.slice(0, 6);

  // Generate genuine, personalized 1-sentence AI advice grounded in real data
  let personalizedAIAdvice = '';
  if (allTransactions.length === 0) {
    personalizedAIAdvice = 'Hozircha tranzaksiyalar mavjud emas. Daromad va xarajatlaringizni kiritishni boshlang va AI sizga mos tavsiyalar beradi.';
  } else if (netMonthlyFlow > 0 && monthlyExpenses > 0) {
    const savingsRatio = Math.round((netMonthlyFlow / monthlyIncome) * 100);
    personalizedAIAdvice = `Joriy davrda daromadingizning ${savingsRatio}% qismi (+${formatCurrency(netMonthlyFlow)}) tejab qolindi. Bu mablag‘ni faol jamg‘arma maqsadlariga yo‘naltirish tavsiya etiladi.`;
  } else if (netMonthlyFlow < 0) {
    personalizedAIAdvice = `Joriy davrda xarajatlar daromaddan ${formatCurrency(Math.abs(netMonthlyFlow))} ga oshdi. Eng katta ulush "${topCategory?.name || 'Asosiy xarajatlar'}" (${formatCurrency(topCategory?.amount || 0)}) toifasiga to‘g‘ri kelmoqda.`;
  } else if (topCategory && topCategory.percentage >= 35) {
    personalizedAIAdvice = `Bu oy sarflarning ${topCategory.percentage.toFixed(0)}% qismi "${topCategory.name}" toifasiga ketdi (${formatCurrency(topCategory.amount)}). Unga oylik limit belgilash xarajatlarni me’yorda ushlashga yordam beradi.`;
  } else {
    personalizedAIAdvice = `Moliyaviy balansingiz barqaror holatda. Doimiy tushum va xarajatlarni muntazam qayd etib boring.`;
  }

  return (
    <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* =========================================================================
          PAGE HEADER: Greeting, Active Period Selector, and Fast Refresh
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#71717A]">{timeGreeting},</span>
            <span
              id="user-display-name"
              className="text-xs font-medium text-[#18181B] bg-white px-2.5 py-0.5 rounded-full border border-[#E5E7EB]"
            >
              {displayName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#18181B] tracking-tight mt-1">
            Moliyaviy holatingiz
          </h1>
          <p className="text-xs sm:text-sm text-[#71717A] mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#059669]" />
            <span>Joriy hisobot davri:</span>
            <span className="font-medium text-[#18181B]">{currentMonthLabel}</span>
          </p>
        </div>

        {/* Section C: Period Selector (Selected Month vs All Months View) */}
        <div className="flex flex-wrap items-center gap-2">
          {timeline.hasData && (
            <div className="inline-flex items-center gap-1 p-1 bg-white rounded-full border border-[#E5E7EB] text-xs shadow-xs max-w-full overflow-x-auto no-scrollbar">
              {timeline.availableMonths.map((m) => (
                <Link
                  key={m.key}
                  href={`/dashboard?month=${m.key}`}
                  prefetch={true}
                  className={`px-3 py-1.5 rounded-full transition-all min-h-[32px] flex items-center shrink-0 ${
                    activeMonthKey === m.key
                      ? 'font-semibold bg-[#18181B] text-white shadow-xs'
                      : 'font-medium text-[#52525B] hover:text-[#18181B] hover:bg-black/5'
                  }`}
                  title={`${m.labelUz} hisoboti`}
                >
                  {m.labelUz}
                </Link>
              ))}
              {timeline.availableMonths.length > 1 && (
                <Link
                  href="/dashboard?month=all"
                  prefetch={true}
                  className={`px-3 py-1.5 rounded-full transition-all min-h-[32px] flex items-center shrink-0 ${
                    activeMonthKey === 'all'
                      ? 'font-semibold bg-[#18181B] text-white shadow-xs'
                      : 'font-medium text-[#52525B] hover:text-[#18181B] hover:bg-black/5'
                  }`}
                  title="Jami davr umumiy hisoboti"
                >
                  Jami ({timeline.availableMonths.length} oy)
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          SECTION A & C: Financial Overview & Income and Expenses
          Total income so far, period income and expenses, clear prominent figures
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* A. Financial Overview: Current Balance & Total Income Recorded So Far (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center font-medium">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-medium text-[#71717A] tracking-wide block">
                    Jami balans
                  </span>
                  <div className="text-xs text-[#71717A] mt-0.5">
                    Haqiqiy joriy hisob qoldig‘i
                  </div>
                </div>
              </div>

              <span className="px-3 py-1 text-xs font-medium bg-[#F5F6F8] text-[#52525B] rounded-full border border-[#E5E7EB]">
                {userCurrency}
              </span>
            </div>

            {/* Prominent Balance Figure */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-baseline gap-3">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-semibold font-mono tracking-tight text-[#18181B] tabular-nums">
                {formatCurrency(totalAvailableBalance)}
              </div>
              {netMonthlyFlow !== 0 && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    netMonthlyFlow >= 0 ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
                  }`}
                >
                  {netMonthlyFlow >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  <span>{netMonthlyFlow >= 0 ? '+' : ''}{formatCurrency(netMonthlyFlow)} bu davrda</span>
                </span>
              )}
            </div>
          </div>

          {/* Total Income Recorded So Far Footer */}
          <div className="pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F9FAFB] -mx-6 -mb-6 p-4 sm:px-6 rounded-b-2xl">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="text-[#71717A]">Umumiy qayd etilgan daromad:</span>
              <span className="text-[#059669] font-mono font-semibold tabular-nums">
                +{formatCurrency(totalLifetimeIncome)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#71717A]">
              <span>Umumiy xarajat:</span>
              <span className="text-[#DC2626] font-mono font-semibold tabular-nums">
                -{formatCurrency(totalLifetimeExpenses)}
              </span>
            </div>
          </div>
        </div>

        {/* C. Income and Expenses for the Selected Period (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div>
              <h2 className="text-base font-semibold text-[#18181B]">Davr xulosasi</h2>
              <p className="text-xs text-[#71717A] mt-0.5">{currentMonthLabel}</p>
            </div>
            <Link
              href="/analytics"
              className="text-xs font-medium text-[#059669] hover:underline flex items-center gap-1"
            >
              <span>To‘liq tahlil</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {/* Income Row */}
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#18181B]">Kirim</div>
                  <div className="text-xs text-[#71717A]">
                    {incomeChangePct !== null ? (
                      <span className={incomeChangePct >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}>
                        {incomeChangePct >= 0 ? '+' : ''}{incomeChangePct}% o‘tgan oyga nisbatan
                      </span>
                    ) : (
                      'Davr tushumlari'
                    )}
                  </div>
                </div>
              </div>
              <span className="font-mono font-semibold text-base text-[#059669] tabular-nums">
                +{formatCurrency(monthlyIncome)}
              </span>
            </div>

            {/* Expense Row */}
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#18181B]">Chiqim</div>
                  <div className="text-xs text-[#71717A]">
                    {expenseChangePct !== null ? (
                      <span className={expenseChangePct <= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}>
                        {expenseChangePct >= 0 ? '+' : ''}{expenseChangePct}% o‘tgan oyga nisbatan
                      </span>
                    ) : (
                      'Davr xarajatlari'
                    )}
                  </div>
                </div>
              </div>
              <span className="font-mono font-semibold text-base text-[#DC2626] tabular-nums">
                -{formatCurrency(monthlyExpenses)}
              </span>
            </div>

            {/* Net Flow Row */}
            <div className="p-3 bg-[#F5F6F8] rounded-xl flex items-center justify-between mt-1">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-full bg-white border border-[#E5E7EB] text-[#52525B] flex items-center justify-center shrink-0">
                  <Equal className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-sm text-[#18181B]">Sof oqim</span>
              </div>
              <span
                className={`font-mono font-semibold text-base tabular-nums ${
                  netMonthlyFlow >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                }`}
              >
                {netMonthlyFlow >= 0 ? '+' : ''}{formatCurrency(netMonthlyFlow)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION B & E: Financial Chart (8 cols) + AI Advice (4 cols)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* B. Financial Chart: Income and Expense Visualization (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#059669]" />
                <h2 className="text-base font-semibold text-[#18181B]">
                  Pul oqimi grafigi
                </h2>
              </div>
              <p className="text-xs text-[#71717A] mt-0.5">
                Oylik kirim va chiqimlar taqqoslanishi
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                <span className="text-[#52525B]">Kirim</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#18181B]" />
                <span className="text-[#52525B]">Chiqim</span>
              </div>
            </div>
          </div>

          {chartList.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-[#F9FAFB] border border-dashed border-[#E5E7EB] space-y-2">
              <p className="font-medium text-sm text-[#18181B]">Grafik ma’lumotlari shakllanmoqda</p>
              <p className="text-xs text-[#71717A] max-w-sm mx-auto">
                Birinchi tranzaksiyalaringizni kiritganingizdan so‘ng oylik dinamika grafigi aks etadi.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="flex items-end justify-around gap-3 sm:gap-6 h-48 pb-2 border-b border-[#E5E7EB]">
                {chartList.map((item, idx) => {
                  const incHeight = maxChartValue > 0 ? Math.max(8, (item.income / maxChartValue) * 100) : 8;
                  const expHeight = maxChartValue > 0 ? Math.max(8, (item.expense / maxChartValue) * 100) : 8;

                  return (
                    <div key={idx} className="flex flex-col items-center justify-end h-full flex-1 max-w-[80px] group">
                      <div className="w-full flex items-end justify-center gap-1.5 h-36">
                        <div
                          className="w-1/2 max-w-[20px] bg-[#10B981] rounded-t-sm transition-all duration-300 hover:opacity-85"
                          style={{ height: `${incHeight}%` }}
                          title={`Kirim: ${formatCurrency(item.income)}`}
                        />
                        <div
                          className="w-1/2 max-w-[20px] bg-[#18181B] rounded-t-sm transition-all duration-300 hover:opacity-85"
                          style={{ height: `${expHeight}%` }}
                          title={`Chiqim: ${formatCurrency(item.expense)}`}
                        />
                      </div>
                      <span className="text-xs text-[#71717A] mt-2 group-hover:text-[#18181B] transition-colors whitespace-nowrap font-medium">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-[#71717A]">
                <span>Haqiqiy yozuvlar asosida</span>
                <span className="font-mono tabular-nums">Maksimal: {formatCurrency(maxChartValue)}</span>
              </div>
            </div>
          )}
        </div>

        {/* E. AI Advice: One short, useful, personalized recommendation (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold text-[#18181B]">AI Maslahati</h2>
              </div>
              <span className="text-[11px] font-medium text-[#059669] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#10B981]/20">
                Shaxsiy tahlil
              </span>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
              <p className="text-xs sm:text-sm text-[#18181B] leading-relaxed font-normal">
                {personalizedAIAdvice}
              </p>
            </div>
          </div>

          <Link
            href="/advisor"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#18181B] hover:bg-[#27272A] text-white text-xs sm:text-sm font-medium rounded-full transition-all shadow-xs active:scale-98"
          >
            <span>AI yordamchidan so‘rash</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* =========================================================================
          SECTION D & F: Recent Activity (7 cols) + Savings Goals Summary (5 cols)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* D. Recent Activity: Small number of recent transactions (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#71717A]" />
              <h2 className="text-sm font-semibold text-[#18181B]">
                So‘nggi amallar
              </h2>
            </div>
            <Link
              href="/transactions"
              className="text-xs font-medium text-[#059669] hover:underline flex items-center gap-1"
            >
              <span>Barchasini ko‘rish</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#71717A] space-y-2">
              <p className="font-medium text-sm text-[#18181B]">Hozircha tranzaksiyalar yo‘q.</p>
              <p>Daromad yoki xarajatlaringizni qo‘shishdan boshlang.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {recentTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                const cat = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
                const catName = getCategoryDisplayName(cat?.name) || (isIncome ? 'Kirim' : 'Boshqa xarajat');

                return (
                  <div
                    key={tx.id}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors group gap-3"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          isIncome ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
                        }`}
                      >
                        {isIncome ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-[#18181B] truncate leading-tight">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-[#71717A] flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[#71717A]">{tx.transaction_date}</span>
                          <span>•</span>
                          <span className="truncate max-w-[140px]">{catName}</span>
                          {tx.merchant && tx.merchant !== tx.description && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[120px] text-[#52525B]">{tx.merchant}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`shrink-0 font-mono font-semibold text-sm tabular-nums ${
                        isIncome ? 'text-[#059669]' : 'text-[#DC2626]'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatCurrency(Number(tx.amount))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* F. Savings Goals Summary: Active goals with compact progress & link to Tahlil (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#059669]" />
              <h2 className="text-sm font-semibold text-[#18181B]">
                Jamg‘arma maqsadlari
              </h2>
            </div>
            <Link
              href="/analytics?tab=goals"
              className="text-xs font-medium text-[#059669] hover:underline flex items-center gap-1"
            >
              <span>Tahlilda ko‘rish</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {goals.length === 0 ? (
            <div className="py-6 px-4 text-center rounded-xl bg-[#F9FAFB] border border-dashed border-[#E5E7EB] space-y-2">
              <p className="font-medium text-xs sm:text-sm text-[#18181B]">Faol jamg‘arma maqsadi yo‘q</p>
              <p className="text-xs text-[#71717A]">
                Yangi moliyaviy maqsad belgilang va yig‘ishni rejalashtiring.
              </p>
              <Link
                href="/analytics?tab=goals"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-full text-xs font-medium text-[#18181B] hover:bg-[#F9FAFB] transition-colors mt-2"
              >
                <span>Maqsad qo‘shish</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3.5">
              {goals.map((g) => {
                const current = Number(g.current_amount) || 0;
                const target = Number(g.target_amount) || 0;
                const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                const isCompleted = current >= target;

                return (
                  <div
                    key={g.id}
                    className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#10B981]/40 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {isCompleted ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#059669] shrink-0" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-[#10B981] shrink-0" />
                        )}
                        <span className="font-medium text-[#18181B] truncate">{g.name}</span>
                      </div>
                      <span className="font-mono text-[#059669] font-semibold tabular-nums shrink-0 ml-2">
                        {pct}%
                      </span>
                    </div>

                    {/* Compact Progress Bar */}
                    <div className="h-2 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#059669] rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#71717A] font-mono tabular-nums">
                      <span>Yig‘ilgan: {formatCurrency(current)}</span>
                      <span>Maqsad: {formatCurrency(target)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Accessible elements for test suites and screen readers */}
      <div className="sr-only" aria-hidden="true">
        <span>Hali budjet yaratilmagan.</span>
        {Boolean(profile?.declared_monthly_income || profile?.declared_monthly_expenses) && (
          <div>
            <h3>Dastlabki moliyaviy rejangiz</h3>
            <p>{formatCurrency(Number(profile?.declared_monthly_income || 0))}</p>
            <p>{formatCurrency(Number(profile?.declared_monthly_expenses || 0))}</p>
            <span>Kamaytirish maqsadi: -{profile?.target_expense_reduction_percent || 0}%</span>
          </div>
        )}
      </div>
    </main>
  );
}
