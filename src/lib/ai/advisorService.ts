import { SupabaseClient } from '@supabase/supabase-js';
import { generateAIContent } from './geminiClient.ts';
import type { AiBudget } from './aiBudget.ts';
import { computeBalances, normalizeCurrency } from '../finance/balance.ts';
import type { AIConversation, AIMessage } from '../../types/database.ts';
import { todayTashkent, addDaysToDate } from '../time/tashkent.ts';
import { formatMoney } from '../formatters/money.ts';
import { convertAmount, formatAmount } from '../fx/currency.ts';
import { getUsdUzsRate } from '../fx/rates.ts';
import { getPreferredCurrency } from '../profile/preferredCurrency.ts';
import { botTexts, describeExecutedActions } from '../i18n/bot.ts';
import { formatMoneyIn } from '../i18n/format.ts';
import type { Lang } from '../i18n/config.ts';

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

async function resolveClient(providedClient?: SupabaseClient): Promise<SupabaseClient> {
  if (providedClient) return providedClient;
  const { createClient } = await import('../supabase/server.ts');
  return await createClient();
}

/**
 * Gathers verified, bounded financial facts for the authenticated user to ground AI answers
 */


function computeMonthsRemaining(today: Date, targetDateStr: string): number {
  const parts = targetDateStr.split('-');
  const tYear = parseInt(parts[0], 10);
  const tMonth = parseInt(parts[1], 10);
  const tDay = parseInt(parts[2], 10);
  // "Today" is the Tashkent calendar date, not the server's (UTC on Vercel).
  const [cYear, cMonth, cDay] = todayTashkent(today).split('-').map(Number);
  const todayMs = Date.UTC(cYear, cMonth - 1, cDay);
  const targetMs = Date.UTC(tYear, tMonth - 1, tDay);
  if (targetMs < todayMs) return 0;
  const monthDiff = (tYear - cYear) * 12 + (tMonth - cMonth);
  return monthDiff <= 0 ? 1 : monthDiff;
}

interface VerifiedMonthFacts {
  income: number;
  expense: number;
  categories: Record<string, number>;
}

interface VerifiedFinancialFacts {
  primaryCurrency: string;
  /** income − expense − goal savings, primary currency only (shared formula, #27). */
  balance: number;
  goalSavings: number;
  transactionCount: number;
  totalIncome: number;
  totalExpense: number;
  months: Record<string, VerifiedMonthFacts>;
  topCategory: { name: string; amount: number } | null;
}

async function gatherUserFinancialContext(
  userId: string,
  supabase: SupabaseClient
): Promise<{ text: string; facts: VerifiedFinancialFacts }> {
  // Gather profile, all transactions, budgets, and goals concurrently
  const [profileRes, allTxRes, budgetsRes, goalsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('first_name, last_name, declared_monthly_income, declared_monthly_expenses, target_expense_reduction_percent, target_monthly_expenses, onboarding_completed')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('id, amount, type, currency, transaction_date, merchant, description, category_id, categories(name)')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: true }),
    supabase
      .from('budgets')
      .select('name, amount, currency, period_type')
      .eq('user_id', userId),
    supabase
      .from('financial_goals')
      .select('name, target_amount, current_amount, status, target_date, currency')
      .eq('user_id', userId),
  ]);

  const profile = profileRes.data;
  const rawTxs = allTxRes.data || [];
  const rawBudgets = budgetsRes.data || [];
  const rawGoals = goalsRes.data || [];

  // Everything is reported in the user's chosen currency (so'm or dollar), the same way the
  // Mini App shows it: so'm and dollar amounts are converted at today's rate (#28 still holds
  // for currencies without a rate — those stay separate and are never added in).
  const primaryCurrency = await getPreferredCurrency(supabase, userId);
  const hasUsd = [...rawTxs, ...rawBudgets, ...rawGoals].some((r) => normalizeCurrency(r.currency) === 'USD');
  const fx = hasUsd || primaryCurrency === 'USD' ? await getUsdUzsRate() : null;
  const usdUzs = fx?.usdUzs ?? 0;
  const convertible = (c?: string | null) => ['UZS', 'USD'].includes(normalizeCurrency(c));
  const toDc = (n: unknown, c?: string | null) =>
    convertible(c) ? convertAmount(Number(n) || 0, normalizeCurrency(c), primaryCurrency, usdUzs) : Number(n) || 0;
  const inDc = <T extends { currency?: string | null }>(row: T, fields: Array<keyof T>): T => {
    if (!convertible(row.currency)) return row;
    const out = { ...row, currency: primaryCurrency } as T;
    for (const f of fields) (out as Record<keyof T, unknown>)[f] = toDc(row[f], row.currency);
    return out;
  };
  const allTxs = rawTxs.map((t) => inDc(t, ['amount']));
  const budgets = rawBudgets.map((b) => inDc(b, ['amount']));
  const goals = rawGoals.map((g) => inDc(g, ['target_amount', 'current_amount']));
  const balances = computeBalances(allTxs, goals);
  const primary = balances.byCurrency[primaryCurrency] ?? balances.primary;
  const primaryTxs = allTxs.filter((t) => normalizeCurrency(t.currency) === primaryCurrency);
  /** "Small" expense threshold: 100 000 so'm, or the same in dollars. */
  const smallLimit = primaryCurrency === 'USD' && usdUzs > 0 ? 100000 / usdUzs : 100000;

  // Lifetime aggregates
  let totalLifetimeIncome = 0;
  let totalLifetimeExpense = 0;

  // Monthly buckets: YYYY-MM -> stats
  interface MonthStats {
    income: number;
    expense: number;
    incomeCount: number;
    expenseCount: number;
    categories: Record<string, { sum: number; count: number }>;
  }
  const monthlyStats: Record<string, MonthStats> = {};

  // Merchant/small expense aggregates (expenses <= 100,000 UZS)
  const smallExpenses: Record<string, { total: number; count: number; merchants: Record<string, number> }> = {};

  for (const t of primaryTxs) {
    const amt = Number(t.amount) || 0;
    const isIncome = t.type === 'income';
    const monthKey = (t.transaction_date || '').substring(0, 7);
    const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
    const catName = cat?.name || 'Boshqa';

    if (isIncome) {
      totalLifetimeIncome += amt;
    } else {
      totalLifetimeExpense += amt;
    }

    if (monthKey) {
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          income: 0,
          expense: 0,
          incomeCount: 0,
          expenseCount: 0,
          categories: {},
        };
      }
      const ms = monthlyStats[monthKey];
      if (isIncome) {
        ms.income += amt;
        ms.incomeCount++;
      } else {
        ms.expense += amt;
        ms.expenseCount++;
        if (!ms.categories[catName]) {
          ms.categories[catName] = { sum: 0, count: 0 };
        }
        ms.categories[catName].sum += amt;
        ms.categories[catName].count++;
      }
    }

    // Track small recurring expenses (<= 100,000 UZS, or its dollar equivalent)
    if (!isIncome && amt <= smallLimit) {
      const groupKey = catName;
      if (!smallExpenses[groupKey]) {
        smallExpenses[groupKey] = { total: 0, count: 0, merchants: {} };
      }
      smallExpenses[groupKey].total += amt;
      smallExpenses[groupKey].count++;
      const mName = t.merchant || t.description || 'Nomaʼlum';
      smallExpenses[groupKey].merchants[mName] = (smallExpenses[groupKey].merchants[mName] || 0) + 1;
    }
  }

  // Generate verified context lines
  const lines: string[] = [];
  lines.push('=== FOYDALANUVCHINING ANIQ TASDIQLANGAN MOLIYAVIY FAKTLARI (VERIFIED CONTEXT) ===');
  lines.push(
    `- Foydalanuvchi tanlagan valyuta: ${primaryCurrency}. Javobdagi BARCHA summalarni shu valyutada yozing.` +
      (usdUzs > 0
        ? ` So‘m va dollardagi summalar 1 $ = ${formatAmount(usdUzs, 'UZS')} so‘m kursi bo‘yicha ${primaryCurrency} ga o‘girilgan.`
        : '')
  );
  lines.push(`- Joriy balans (daromad − xarajat − jamg‘armadagi pul): ${formatMoney(primary.balance, primaryCurrency)}`);
  lines.push(`- Jamg‘arma maqsadlarida saqlanayotgan pul: ${formatMoney(primary.goalSavings, primaryCurrency)}`);
  lines.push(`- Jami daromadlar (barcha): ${formatMoney(totalLifetimeIncome, primaryCurrency)}`);
  lines.push(`- Jami xarajatlar (barcha): ${formatMoney(totalLifetimeExpense, primaryCurrency)}`);
  for (const cur of Object.keys(balances.byCurrency).filter((c) => c !== primaryCurrency && !convertible(c))) {
    const b = balances.byCurrency[cur];
    if (!b.income && !b.expense && !b.goalSavings) continue;
    lines.push(`- ${cur} hisobi (alohida): balans ${formatMoney(b.balance, cur)}, daromad ${formatMoney(b.income, cur)}, xarajat ${formatMoney(b.expense, cur)}, jamg‘armada ${formatMoney(b.goalSavings, cur)}`);
  }
  lines.push(`- Jami tranzaksiyalar soni: ${allTxs.length} ta`);

  // Months breakdown
  const monthNamesUzFull = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];

  const sortedMonths = Object.keys(monthlyStats).sort();
  for (const m of sortedMonths) {
    const s = monthlyStats[m];
    const parts = m.split('-');
    const mYear = parts[0];
    const mIdx = parseInt(parts[1] || '1', 10) - 1;
    const mUzName = monthNamesUzFull[mIdx] || m;
    const monthName = `${mYear}-yil ${mUzName}`;

    lines.push(`\n--- ${monthName} oylik hisoboti (${m}) ---`);
    lines.push(`  * Jami daromad: ${formatMoney(s.income, primaryCurrency)} (${s.incomeCount} ta tranzaksiya)`);
    lines.push(`  * Jami xarajat: ${formatMoney(s.expense, primaryCurrency)} (${s.expenseCount} ta tranzaksiya)`);
    lines.push(`  * Sof pul oqimi (Qoldiq / Net): ${formatMoney(s.income - s.expense, primaryCurrency)}`);

    const sortedCats = Object.entries(s.categories).sort(([, a], [, b]) => b.sum - a.sum);
    lines.push(`  * Kategoriyalar bo'yicha xarajatlar (kamayish tartibida):`);
    for (const [cName, cData] of sortedCats) {
      const pct = s.expense > 0 ? ((cData.sum / s.expense) * 100).toFixed(1) : '0';
      lines.push(`    - ${cName}: ${formatMoney(cData.sum, primaryCurrency)} (${cData.count} ta, ${pct}%)`);
    }

    // Top individual transactions for this month
    const topMonthTxs = primaryTxs
      .filter((t) => t.type === 'expense' && (t.transaction_date || '').substring(0, 7) === m)
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
    if (topMonthTxs.length > 0) {
      lines.push(`  * Eng katta individual xarajatlar:`);
      for (const tx of topMonthTxs) {
        const cat = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
        lines.push(`    - "${tx.description}" (${cat?.name || 'Boshqa'}): ${formatMoney(Number(tx.amount), tx.currency || primaryCurrency)} (Sana: ${tx.transaction_date})`);
      }
    }
  }

  // Multi-month cross-analysis: compare the two most recent months with real data
  if (sortedMonths.length >= 2) {
    const prevKey = sortedMonths[sortedMonths.length - 2];
    const latestKey = sortedMonths[sortedMonths.length - 1];
    const prev = monthlyStats[prevKey];
    const latest = monthlyStats[latestKey];
    const diffExpense = latest.expense - prev.expense;
    const pctChange = prev.expense > 0 ? ((diffExpense / prev.expense) * 100).toFixed(1) : '0';

    lines.push(`\n--- Oylarni taqqoslash (${prevKey} vs ${latestKey}) ---`);
    lines.push(`  * ${prevKey} xarajati: ${formatMoney(prev.expense, primaryCurrency)} (Daromad: ${formatMoney(prev.income, primaryCurrency)}, Qoldiq: ${formatMoney(prev.income - prev.expense, primaryCurrency)})`);
    lines.push(`  * ${latestKey} xarajati: ${formatMoney(latest.expense, primaryCurrency)} (Daromad: ${formatMoney(latest.income, primaryCurrency)}, Qoldiq: ${formatMoney(latest.income - latest.expense, primaryCurrency)})`);
    lines.push(`  * Farq: ${latestKey} oyida xarajatlar ${formatMoney(Math.abs(diffExpense), primaryCurrency)} ga (${Math.abs(Number(pctChange))}%) ${diffExpense <= 0 ? 'kamaygan (tejalgan)' : 'oshgan'}.`);
  }

  // Recurring small expenses summary
  lines.push(`\n--- Takroriy mayda xarajatlar tahlili (Small Recurring Expenses) ---`);
  for (const [catName, data] of Object.entries(smallExpenses)) {
    const avg = data.count > 0 ? Math.round(data.total / data.count) : 0;
    const topMerchants = Object.entries(data.merchants)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([m, c]) => `${m} (${c} marta)`)
      .join(', ');
    lines.push(`  * ${catName}: Jami ${data.count} marta, umumiy ${formatMoney(data.total, primaryCurrency)}, o'rtacha ${formatMoney(avg, primaryCurrency)} / marta. Asosiy: ${topMerchants}`);
  }

  // Active budgets & goals
  if (budgets.length > 0) {
    lines.push(`\n--- Faol Budjetlar ---`);
    for (const b of budgets) {
      lines.push(`  * ${b.name}: ${formatMoney(Number(b.amount), b.currency || primaryCurrency)} (${b.period_type})`);
    }
  }

  if (goals.length > 0) {
    const activeMonthsCount = sortedMonths.length || 1;
    const avgMonthlyNet = Math.round(((totalLifetimeIncome - totalLifetimeExpense) / activeMonthsCount) * 100) / 100;
    lines.push(`\n--- Jamg'arma Maqsadlari ---`);
    for (const g of goals) {
      const goalCurrency = normalizeCurrency(g.currency);
      const current = Number(g.current_amount) || 0;
      const target = Number(g.target_amount) || 0;
      const remaining = Math.max(0, target - current);
      const pct = target > 0 ? ((current / target) * 100).toFixed(1) : '0';
      if (g.status === 'completed' || remaining === 0) {
        lines.push(`  * ${g.name}: ${formatMoney(current, goalCurrency)} / ${formatMoney(target, goalCurrency)} (${pct}%) - Maqsad to‘liq bajarildi!`);
      } else if (g.target_date && goalCurrency === primaryCurrency) {
        const months = computeMonthsRemaining(new Date(), g.target_date);
        const monthlyNeeded = months > 0 ? Math.round(remaining / months) : remaining;
        const isFeasible = avgMonthlyNet >= monthlyNeeded;
        lines.push(
          `  * ${g.name}: ${formatMoney(current, goalCurrency)} / ${formatMoney(target, goalCurrency)} (${pct}% bajarildi, qolgan: ${formatMoney(remaining, goalCurrency)}, muddat: ${g.target_date}, qolgan oylar: ${months} oy, kerakli oylik: ${formatMoney(monthlyNeeded, goalCurrency)}/oy). ` +
          (isFeasible
            ? `Amalga oshirish mumkin (Oylik erkin mablag‘: ${formatMoney(avgMonthlyNet, primaryCurrency)} >= ${formatMoney(monthlyNeeded, goalCurrency)}).`
            : `Imkoniyat yetarli emas (Kerakli ${formatMoney(monthlyNeeded, goalCurrency)} > oylik erkin mablag‘ ${formatMoney(avgMonthlyNet, primaryCurrency)}). Muddatni uzaytirish yoki xarajatlarni kamaytirish tavsiya etiladi.`)
        );
      } else {
        lines.push(`  * ${g.name}: ${formatMoney(current, goalCurrency)} / ${formatMoney(target, goalCurrency)} (${pct}%, qolgan: ${formatMoney(remaining, goalCurrency)})`);
      }
    }
  }

  if (profile) {
    lines.push(`\n=== FOYDALANUVCHINING REJALASHTIRILGAN ONBOARDING MA’LUMOTLARI (PLANNING ESTIMATES) ===`);
    lines.push(`- DIQQAT: Ushbu raqamlar ro‘yxatdan o‘tishda rejalashtirish uchun kiritilgan baholashlar (taxminlar) bo‘lib, haqiqiy hisob balansi yoki tranzaksiya hisoblanmaydi.`);
    if (profile.declared_monthly_income !== null && profile.declared_monthly_income !== undefined) {
      lines.push(`- Rejalashtirilgan oylik daromad (taxmin): ${formatMoney(toDc(profile.declared_monthly_income, 'UZS'), primaryCurrency)}`);
    }
    if (profile.declared_monthly_expenses !== null && profile.declared_monthly_expenses !== undefined) {
      lines.push(`- Rejalashtirilgan oylik xarajat (taxmin): ${formatMoney(toDc(profile.declared_monthly_expenses, 'UZS'), primaryCurrency)}`);
    }
    if (profile.target_expense_reduction_percent !== null && profile.target_expense_reduction_percent !== undefined) {
      lines.push(`- Xarajatlarni kamaytirish maqsadi: ${profile.target_expense_reduction_percent}%`);
    }
    if (profile.target_monthly_expenses !== null && profile.target_monthly_expenses !== undefined) {
      lines.push(`- Maqsadli oylik xarajat (rejada): ${formatMoney(toDc(profile.target_monthly_expenses, 'UZS'), primaryCurrency)}`);
    }
  }

  const categoryTotals: Record<string, number> = {};
  for (const month of Object.values(monthlyStats)) {
    for (const [name, data] of Object.entries(month.categories)) {
      categoryTotals[name] = (categoryTotals[name] || 0) + data.sum;
    }
  }
  const topCategoryEntry = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0];

  const facts: VerifiedFinancialFacts = {
    primaryCurrency,
    balance: primary.balance,
    goalSavings: primary.goalSavings,
    transactionCount: allTxs.length,
    totalIncome: totalLifetimeIncome,
    totalExpense: totalLifetimeExpense,
    months: Object.fromEntries(
      Object.entries(monthlyStats).map(([key, value]) => [
        key,
        {
          income: value.income,
          expense: value.expense,
          categories: Object.fromEntries(
            Object.entries(value.categories).map(([name, data]) => [name, data.sum])
          ),
        },
      ])
    ),
    topCategory: topCategoryEntry ? { name: topCategoryEntry[0], amount: topCategoryEntry[1] } : null,
  };

  return { text: lines.join('\n'), facts };
}

/**
 * Honest fallback used only when the AI provider is unavailable.
 * Every number comes from verified database facts; nothing is invented.
 */
/** AI unavailable, Russian / English: the key verified numbers in one line. */
function buildPlainFallbackAnswer(facts: VerifiedFinancialFacts, language: Lang): string {
  const money = (v: number) => formatMoneyIn(v, facts.primaryCurrency, language);
  if (language === 'ru') {
    if (facts.transactionCount === 0) return 'Пока нет ни одной записи о доходах или расходах, поэтому точных цифр нет. Добавьте операции — и я смогу их проанализировать.';
    return `AI сейчас недоступен. По вашим записям: доход ${money(facts.totalIncome)}, расход ${money(facts.totalExpense)}, баланс ${money(facts.balance)} (операций: ${facts.transactionCount}).`;
  }
  if (facts.transactionCount === 0) return 'There are no income or spending entries yet, so there are no exact numbers. Add some entries and I can analyse them.';
  return `AI is unavailable right now. From your entries: income ${money(facts.totalIncome)}, spending ${money(facts.totalExpense)}, balance ${money(facts.balance)} (${facts.transactionCount} entries).`;
}

function buildVerifiedFallbackAnswer(question: string, facts: VerifiedFinancialFacts): string {
  const q = question.toLowerCase();
  const money = (value: number) => formatMoney(value, facts.primaryCurrency);

  if (facts.transactionCount === 0) {
    return 'Hozircha hisobingizda haqiqiy daromad yoki xarajat tranzaksiyalari yo‘q, shu sababli aniq moliyaviy raqamlar ko‘rsatib bo‘lmaydi. Tranzaksiya qo‘shganingizdan so‘ng tahlilni qayta so‘rashingiz mumkin.';
  }

  const monthKeys = Object.keys(facts.months).sort();
  const monthNames = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const mentionedMonths = monthKeys.filter((key) => {
    const parts = key.split('-');
    const index = parseInt(parts[1] || '1', 10) - 1;
    return q.includes(monthNames[index] || '');
  });

  if (mentionedMonths.length >= 2) {
    const firstKey = mentionedMonths[0];
    const lastKey = mentionedMonths[mentionedMonths.length - 1];
    const first = facts.months[firstKey];
    const last = facts.months[lastKey];
    return `${firstKey}: daromad ${money(first.income)}, xarajat ${money(first.expense)}, sof qoldiq ${money(first.income - first.expense)}. ${lastKey}: daromad ${money(last.income)}, xarajat ${money(last.expense)}, sof qoldiq ${money(last.income - last.expense)}.`;
  }

  if (mentionedMonths.length === 1) {
    const key = mentionedMonths[0];
    const month = facts.months[key];
    const top = Object.entries(month.categories).sort(([, a], [, b]) => b - a)[0];
    const topLine = top ? ` Eng katta xarajat kategoriyasi: ${top[0]} — ${money(top[1])}.` : '';
    return `${key} oyida haqiqiy tranzaksiyalar bo‘yicha daromad ${money(month.income)}, xarajat ${money(month.expense)}, sof qoldiq ${money(month.income - month.expense)}.${topLine}`;
  }

  if (facts.topCategory && (q.includes('kategoriya') || q.includes('qayerga') || q.includes('eng ko'))) {
    return `Haqiqiy tranzaksiyalaringiz bo‘yicha eng katta xarajat kategoriyasi — ${facts.topCategory.name} (${money(facts.topCategory.amount)}). Jami xarajat ${money(facts.totalExpense)}, jami daromad ${money(facts.totalIncome)}.`;
  }

  return `AI xizmati vaqtincha javob bera olmadi. Tasdiqlangan tranzaksiyalaringiz bo‘yicha: jami daromad ${money(facts.totalIncome)}, jami xarajat ${money(facts.totalExpense)}, joriy balans ${money(facts.balance)} (jamg‘armadagi ${money(facts.goalSavings)} hisobga olingan, ${facts.transactionCount} ta tranzaksiya).`;
}/**
 * Handles conversational financial advisory with Gemini grounded on verified facts
 */
/**
 * The user's single Telegram conversation (ai_conversations.channel = 'telegram').
 * Returns undefined when migration 014 is not applied (caller then creates one per message).
 */
async function getOrCreateTelegramConversation(
  supabase: SupabaseClient,
  userId: string
): Promise<string | undefined> {
  const find = async () => {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('channel', 'telegram')
      .limit(1)
      .maybeSingle();
    return { id: data?.id as string | undefined, error };
  };

  const existing = await find();
  if (existing.error) return undefined; // column missing → old behaviour
  if (existing.id) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('ai_conversations')
    .insert({ user_id: userId, title: 'Telegram suhbati', channel: 'telegram' })
    .select('id')
    .single();
  if (created?.id) return created.id as string;

  // Unique index race: another message created it a moment ago.
  if (insertError) {
    const again = await find();
    return again.id;
  }
  return undefined;
}

export interface AskAdvisorOptions {
  /**
   * 'telegram': the bot already ran the single action extraction for this message, so the
   * advisor only answers. It skips the regex engine, the typed "ha"/"bekor" lookup and the
   * second extraction (proposals there could not be confirmed from Telegram; see #19, #21).
   */
  channel?: 'web' | 'telegram';
  /** Shared AI time budget for this Telegram update. */
  budget?: AiBudget;
  /** The user's language: the answer is written in it (default Uzbek). */
  language?: Lang;
}

export async function askFinancialAdvisor(
  question: string,
  conversationId?: string,
  client?: SupabaseClient,
  options: AskAdvisorOptions = {}
): Promise<
  ServiceResult<{
    conversationId: string;
    messageId: string;
    answer: string;
    isAiFallback: boolean;
    evidence: Record<string, unknown>;
  }>
> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Avtorizatsiyadan o‘tilmagan: Tizimga kirish talab qilinadi', status: 401 };
    }

    if (!question || typeof question !== 'string' || !question.trim()) {
      return { data: null, error: 'Savol matni kiritilishi shart', status: 400 };
    }

    // 1. Resolve or create AI conversation
    let convId = conversationId;
    // Telegram: one conversation per user, reused for every message (#40; needs migration 014).
    if (!convId && options.channel === 'telegram') {
      convId = await getOrCreateTelegramConversation(supabase, user.id);
    }
    if (!convId) {
      const titleSummary = question.length > 40 ? question.slice(0, 37) + '...' : question;
      let { data: newConv, error: convErr } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: titleSummary,
        })
        .select()
        .single();

      if (convErr || !newConv) {
        // Fallback to service role if PostgREST RLS cookie header was not passed
        try {
          const { getSupabaseServiceRoleKey, getSupabaseUrl } = await import('../supabase/config.ts');
          const sKey = getSupabaseServiceRoleKey();
          if (sKey) {
            const { createClient: createAdmin } = await import('@supabase/supabase-js');
            const admin = createAdmin(getSupabaseUrl(), sKey, { auth: { persistSession: false } });
            const adminConv = await admin
              .from('ai_conversations')
              .insert({ user_id: user.id, title: titleSummary })
              .select()
              .single();
            if (adminConv.data) {
              newConv = adminConv.data;
              convErr = null;
            }
          }
        } catch {}
      }

      if (convErr || !newConv) {
        return { data: null, error: convErr?.message || 'Suhbatni boshlab bo‘lmadi', status: 500 };
      }
      convId = newConv.id;
    } else {
      // Validate ownership of existing conversation
      const { data: existingConv } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('id', convId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingConv) {
        return { data: null, error: 'Suhbat topilmadi', status: 404 };
      }
    }

    // 2. Gather verified financial facts (server-side only; client context is never trusted)
    const verified = await gatherUserFinancialContext(user.id, supabase);

    // 3. Save User message to ai_messages
    const { error: userMsgErr } = await supabase.from('ai_messages').insert({
      conversation_id: convId,
      user_id: user.id,
      role: 'user',
      content: question.trim(),
    });

    if (userMsgErr) {
      try {
        const { getSupabaseServiceRoleKey, getSupabaseUrl } = await import('../supabase/config.ts');
        const sKey = getSupabaseServiceRoleKey();
        if (sKey) {
          const { createClient: createAdmin } = await import('@supabase/supabase-js');
          const admin = createAdmin(getSupabaseUrl(), sKey, { auth: { persistSession: false } });
          await admin.from('ai_messages').insert({
            conversation_id: convId,
            user_id: user.id,
            role: 'user',
            content: question.trim(),
          });
        }
      } catch {}
    }

    const isTelegram = options.channel === 'telegram';
    const language: Lang = options.language ?? 'uz';
    const bt = botTexts(language);

    // 3.1 Check deterministic financial action engine (5 core scenarios, clarifications, confirmations)
    // Web only: its proposals live in this conversation and cannot be confirmed from Telegram.
    const { processFinancialIntent } = await import('./financialActionEngine.ts');
    // The regex engine only reads and answers Uzbek; other languages go straight to the AI.
    const intentResult = isTelegram || language !== 'uz'
      ? { handled: false as const, answer: '', pendingAction: undefined, actionResult: undefined }
      : await processFinancialIntent(question, convId!, user.id, supabase);

    if (intentResult.handled) {
      const evidence = {
        grounded_context: verified.text,
        model_used: 'deterministic-financial-engine',
        is_fallback: false,
        pending_action: intentResult.pendingAction || null,
        action_result: intentResult.actionResult || null,
      };

      const { data: assistantMsg, error: msgErr } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: convId,
          user_id: user.id,
          role: 'assistant',
          content: intentResult.answer,
          evidence_references: evidence,
        })
        .select('id')
        .single();

      if (msgErr) {
        return { data: null, error: msgErr.message, status: 500 };
      }

      return {
        data: {
          conversationId: convId!,
          messageId: assistantMsg.id,
          answer: intentResult.answer,
          isAiFallback: false,
          evidence,
        },
        error: null,
        status: 200,
      };
    }

    // 3.2 Check active pending actions confirmation / cancellation from pendingActionStore
    const {
      getLatestActivePendingAction,
      savePendingAction,
      isUserConfirmation,
      isUserCancellation,
      cancelPendingAction,
    } = await import('./pendingActionStore.ts');
    const { executePendingActionRecord } = await import('./actionExecutor.ts');

    const latestPending = isTelegram ? null : await getLatestActivePendingAction(user.id);
    if (latestPending && latestPending.status === 'pending') {
      if (isUserConfirmation(question)) {
        const execRes = await executePendingActionRecord(latestPending, supabase);
        if (execRes.success && language !== 'uz') {
          execRes.message = describeExecutedActions(latestPending.actions, language);
        }
        const evidence = {
          grounded_context: verified.text,
          model_used: 'gemini-action-engine',
          is_fallback: false,
          action_result: execRes,
        };
        const { data: assistantMsg, error: msgErr } = await supabase
          .from('ai_messages')
          .insert({
            conversation_id: convId,
            user_id: user.id,
            role: 'assistant',
            content: execRes.message,
            evidence_references: evidence,
          })
          .select('id')
          .single();

        if (msgErr) return { data: null, error: msgErr.message, status: 500 };
        return {
          data: {
            conversationId: convId!,
            messageId: assistantMsg.id,
            answer: execRes.message,
            isAiFallback: false,
            evidence,
          },
          error: null,
          status: 200,
        };
      }

      if (isUserCancellation(question)) {
        await cancelPendingAction(latestPending.actionId, user.id);
        const cancelMsg = bt.cancelledWeb;
        const evidence = {
          grounded_context: verified.text,
          model_used: 'gemini-action-engine',
          is_fallback: false,
          action_result: { success: true, message: cancelMsg },
        };
        const { data: assistantMsg, error: msgErr } = await supabase
          .from('ai_messages')
          .insert({
            conversation_id: convId,
            user_id: user.id,
            role: 'assistant',
            content: cancelMsg,
            evidence_references: evidence,
          })
          .select('id')
          .single();

        if (msgErr) return { data: null, error: msgErr.message, status: 500 };
        return {
          data: {
            conversationId: convId!,
            messageId: assistantMsg.id,
            answer: cancelMsg,
            isAiFallback: false,
            evidence,
          },
          error: null,
          status: 200,
        };
      }
    }

    // 3.3 Gemini structured action extraction (multi-transaction, goals, savings)
    const { extractFinancialActions } = await import('./actionExtractionEngine.ts');
    const { loadCategoryOptions, categoryNamesByType, attachCategoryIds } = await import(
      '../categories/catalog.ts'
    );
    const { getPreferredCurrency } = await import('../profile/preferredCurrency.ts');
    const [categoryOptions, defaultCurrency] = isTelegram
      ? [[], 'UZS' as const]
      : await Promise.all([loadCategoryOptions(supabase), getPreferredCurrency(supabase, user.id)]);
    const extraction = isTelegram
      ? { intent: 'financial_query' as const, actions: [], summaryUzbek: '', clarificationQuestion: undefined }
      : await extractFinancialActions(question, {
          userFinancialContextText: verified.text,
          categories: categoryOptions.length ? categoryNamesByType(categoryOptions) : undefined,
          defaultCurrency,
          language,
        });

    if (extraction.intent === 'action_proposal' && extraction.actions.length > 0) {
      const { alignGoalCurrencies } = await import('./goalCurrency.ts');
      const aligned = await alignGoalCurrencies(extraction, user.id, supabase);
      extraction.actions = aligned.actions;
      extraction.summaryUzbek = aligned.summaryUzbek;
      const actionsWithCategories = attachCategoryIds(extraction.actions, categoryOptions);
      const saveRes = await savePendingAction(user.id, actionsWithCategories, extraction.summaryUzbek);
      const pending = saveRes.record;
      if (!pending) {
        return {
          data: null,
          error: saveRes.error || 'Amalni saqlashda xatolik',
          status: 500,
        };
      }
      const primary = extraction.actions[0];
      const evidence = {
        grounded_context: verified.text,
        model_used: 'gemini-action-extraction',
        is_fallback: false,
        pending_action: {
          action_id: pending.actionId,
          type:
            primary.actionType === 'create_transaction'
              ? primary.transactionType === 'income'
                ? 'create_income'
                : 'create_expense'
              : primary.actionType,
          status: 'pending',
          params: {
            amount: primary.amount,
            currency: primary.currency,
            description: primary.description,
            category_name: primary.categoryName,
            goal_name: primary.goalName,
            date: primary.date,
          },
        },
      };

      const { data: assistantMsg, error: msgErr } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: convId,
          user_id: user.id,
          role: 'assistant',
          content: extraction.summaryUzbek,
          evidence_references: evidence,
        })
        .select('id')
        .single();

      if (msgErr) return { data: null, error: msgErr.message, status: 500 };

      return {
        data: {
          conversationId: convId!,
          messageId: assistantMsg.id,
          answer: extraction.summaryUzbek,
          isAiFallback: false,
          evidence,
        },
        error: null,
        status: 200,
      };
    }

    if (extraction.intent === 'clarification' && extraction.clarificationQuestion) {
      const evidence = {
        grounded_context: verified.text,
        model_used: 'gemini-action-extraction',
        is_fallback: false,
      };

      const { data: assistantMsg, error: msgErr } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: convId,
          user_id: user.id,
          role: 'assistant',
          content: extraction.clarificationQuestion,
          evidence_references: evidence,
        })
        .select('id')
        .single();

      if (msgErr) return { data: null, error: msgErr.message, status: 500 };

      return {
        data: {
          conversationId: convId!,
          messageId: assistantMsg.id,
          answer: extraction.clarificationQuestion,
          isAiFallback: false,
          evidence,
        },
        error: null,
        status: 200,
      };
    }

    // 4. Prompt Gemini with factual grounding and conciseness rules
    const systemInstruction = `Siz UzHamyon shaxsiy moliya platformasining professional va yuqori intellektli moliyaviy yordamchisiz.

Asosiy vazifalar va javob tuzilishi:
1. SAVOL TURINI ANIQLASH:
   - Oddiy moliyaviy savol: Nazariyani tushuntiring va O'zbekiston sharoitiga mos amaliy misol keltiring.
   - Daromad va xarajat tahlili: Faqat VERIFIED USER FINANCIAL CONTEXT faktlariga tayanib, aniq summalar va o'zgarish foizlarini ko'rsating.
   - Tranzaksiya qo'shish / amal: Foydalanuvchi maosh oldim yoki pul sarfladim desa, bu haqda aniq xabar bering.
   - Budjet bo'yicha maslahat: 50/30/20 qoidasi yoki mavjud budjet limitlari asosida aniq taqsimot bering.
   - Jamg'arma maqsadi: Haqiqiy yig'ilgan pul, qolgan summa va kerakli oylik jamg'armani hisoblang. Umumiy balansni jamg'arma deb hisoblamang.
   - Katta xarid uchun reja (mashina, uy va h.k.): Agar narx aytilmagan bo'lsa, aniq bitta savol bilan narxni so'rang (masalan: "Qancha narxdagi mashina olmoqchisiz?").
   - Aniqlashtirish: Agar savol noaniq bo'lsa yoki zarur raqam yetishmasa, bitta qisqa aniqlashtiruvchi savol bering.

2. JAVOB FORMATI (JUDA QISQA — telefon ekrani uchun):
   - Ko'pi bilan 2 ta qisqa jumla, jami 220 belgidan oshmasin.
   - 1-jumla: savolga to'g'ridan-to'g'ri javob, eng muhim raqam bilan (raqamni **qalin** qiling).
   - 2-jumla (faqat kerak bo'lsa): bitta aniq amaliy maslahat yoki bitta aniqlashtiruvchi savol.
   - Ro'yxat, sarlavha, kirish so'zlari ("Salom", "Albatta"), takror va xulosa YOZMANG.
   - Foydalanuvchi batafsil so'rasa, 4 jumlagacha yozish mumkin.

3. FAKTIK ANIKLIK VA VALYUTA:
   - Barcha pul summalarini kontekstda ko'rsatilgan "Foydalanuvchi tanlagan valyuta"da yozing (UZS bo'lsa: 6 000 000 soʻm; USD bo'lsa: 475 dollar). Valyutani o'zingiz almashtirmang.
   - Raqamlarni aslo o'ylab topmang, faqat berilgan kontekst faktlaridan oling. Agar ma'lumot yetishmasa yoki baza bo'sh bo'lsa, buni ochiq ayting.
   - ONBOARDING VA REJALASHTIRISH FAKTLARI:
     * Foydalanuvchining onboardingda ko‘rsatgan oylik daromadi yoki xarajati — bu REJA VA TAXMIN (PLANNING ESTIMATE).
     * Foydalanuvchi bu pullarni ishlab topgan yoki sarflagan deb ASLO da'vo qilmang.
     * Tranzaksiyalar soni 0 ta bo‘lsa, hisob mutlaqo toza (0 soʻm) ekanligini bildiring va foydalanuvchiga tranzaksiyalar qo‘shilgach aniqroq tahlillar taqdim etilishini tushuntiring.
     * Jamg‘arma maqsadlari yangi boshlangan bo‘lsa, to‘plangan mablag‘ 0 soʻm ekanligini ko‘rsating.
   - Amal muvaffaqiyatsiz bo'lsa yoki bajarilmagan bo'lsa, aslo bajarildi deb da'vo qilmang.

4. TILI: ${language === 'uz' ? "Sodda, ravon o'zbek tilida, grammatik to'g'ri, tugallangan jumlalar bilan yozing." : `${bt.aiLanguageRule} (Javobni FAQAT shu tilda yozing, ko'rsatmalar o'zbekcha bo'lsa ham.)`}`;

    const { sanitizeUserInputForAi } = await import('./actionExtractionEngine.ts');
    const sanitizedQuestion = sanitizeUserInputForAi(question.trim());
    const fullPrompt = `${verified.text}\n\nUSER QUESTION: ${sanitizedQuestion}`;

    const aiRes = await generateAIContent(fullPrompt, systemInstruction, 25000, { budget: options.budget });

    // If the AI provider is unavailable, answer only from verified database facts
    const finalAnswer =
      !aiRes.isFallback && aiRes.text.trim()
        ? aiRes.text
        : language === 'uz'
        ? buildVerifiedFallbackAnswer(question, verified.facts)
        : buildPlainFallbackAnswer(verified.facts, language);

    // 5. Save Assistant response to ai_messages
    const evidence = {
      grounded_context: verified.text,
      model_used: aiRes.isFallback ? 'verified-facts-fallback' : aiRes.model,
      is_fallback: aiRes.isFallback,
    };

    let { data: assistantMsg, error: msgErr } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: convId,
        user_id: user.id,
        role: 'assistant',
        content: finalAnswer,
        evidence_references: evidence,
      })
      .select('id')
      .single();

    if (msgErr || !assistantMsg) {
      try {
        const { getSupabaseServiceRoleKey, getSupabaseUrl } = await import('../supabase/config.ts');
        const sKey = getSupabaseServiceRoleKey();
        if (sKey) {
          const { createClient: createAdmin } = await import('@supabase/supabase-js');
          const admin = createAdmin(getSupabaseUrl(), sKey, { auth: { persistSession: false } });
          const adminMsg = await admin
            .from('ai_messages')
            .insert({
              conversation_id: convId,
              user_id: user.id,
              role: 'assistant',
              content: finalAnswer,
              evidence_references: evidence,
            })
            .select('id')
            .single();
          if (adminMsg.data) {
            assistantMsg = adminMsg.data;
            msgErr = null;
          }
        }
      } catch {}
    }

    if (msgErr || !assistantMsg) {
      return { data: null, error: msgErr?.message || 'Javobni saqlab bo‘lmadi', status: 500 };
    }

    return {
      data: {
        conversationId: convId!,
        messageId: assistantMsg.id,
        answer: finalAnswer,
        isAiFallback: aiRes.isFallback,
        evidence,
      },
      error: null,
      status: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Moliyaviy yordamchi xizmatida xatolik';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Runs a deterministic financial scenario simulation (e.g. "What if I cut Dining by 20%?")
 */
export async function simulateBudgetScenario(
  categoryName: string,
  percentageReduction: number,
  client?: SupabaseClient
): Promise<
  ServiceResult<{
    categoryName: string;
    currentMonthlySpending: number;
    reducedMonthlySpending: number;
    monthlySavings: number;
    annualizedSavings: number;
    explanation: string;
  }>
> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Avtorizatsiyadan o‘tilmagan: Tizimga kirish talab qilinadi', status: 401 };
    }

    const thirtyDaysAgo = addDaysToDate(todayTashkent(), -30);

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, categories(name)')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('transaction_date', thirtyDaysAgo);

    let currentSpending = 0;
    for (const t of txs || []) {
      const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
      const name = cat?.name || 'Kategoriyasiz';
      if (name.toLowerCase() === categoryName.toLowerCase()) {
        currentSpending += Number(t.amount);
      }
    }

    currentSpending = Math.round(currentSpending * 100) / 100;
    const reductionRatio = Math.max(0, Math.min(100, percentageReduction)) / 100;
    const monthlySavings = Math.round(currentSpending * reductionRatio * 100) / 100;
    const reducedSpending = Math.round((currentSpending - monthlySavings) * 100) / 100;
    const annualizedSavings = Math.round(monthlySavings * 12 * 100) / 100;

    const explanation = `Agar "${categoryName}" xarajatlarini ${percentageReduction}% ga qisqartirsangiz, oylik xarajat $${currentSpending.toFixed(2)} dan $${reducedSpending.toFixed(2)} gacha kamayadi (saving $${monthlySavings.toFixed(2)}/month va $${annualizedSavings.toFixed(2)}/yil tejaladi).`;

    return {
      data: {
        categoryName,
        currentMonthlySpending: currentSpending,
        reducedMonthlySpending: reducedSpending,
        monthlySavings,
        annualizedSavings,
        explanation,
      },
      error: null,
      status: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ssenariyni hisoblashda xatolik';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Lists past conversations for authenticated user
 */
export async function listAIConversations(
  client?: SupabaseClient
): Promise<ServiceResult<AIConversation[]>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Ruxsat yo‘q: avval tizimga kiring', status: 401 };
    }

    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: error.message, status: 500 };
    }

    return { data: (data || []) as AIConversation[], error: null, status: 200 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Suhbatlarni olishda xatolik';
    return { data: null, error: msg, status: 500 };
  }
}

/**
 * Gets conversation messages
 */
export async function getConversationMessages(
  conversationId: string,
  client?: SupabaseClient
): Promise<ServiceResult<{ conversation: AIConversation; messages: AIMessage[] }>> {
  try {
    const supabase = await resolveClient(client);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Ruxsat yo‘q: avval tizimga kiring', status: 401 };
    }

    const { data: conv, error: convErr } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (convErr || !conv) {
      return { data: null, error: 'Suhbat topilmadi', status: 404 };
    }

    const { data: msgs, error: msgsErr } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (msgsErr) {
      return { data: null, error: msgsErr.message, status: 500 };
    }

    return {
      data: {
        conversation: conv as AIConversation,
        messages: (msgs || []) as AIMessage[],
      },
      error: null,
      status: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Xabarlarni olishda xatolik';
    return { data: null, error: msg, status: 500 };
  }
}
