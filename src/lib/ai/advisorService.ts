import { SupabaseClient } from '@supabase/supabase-js';
import { generateAIContent } from './aiClient.ts';
import type { AIConversation, AIMessage } from '../../types/database.ts';

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
function formatUzMoney(amount: number, currency: string = 'UZS'): string {
  if (currency === 'UZS') {
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount)).replace(/[\u00a0\u202f]/g, ' ')} soʻm`;
  }
  return `${amount >= 1000 ? amount.toLocaleString('en-US') : amount.toFixed(2)} ${currency}`;
}

function computeMonthsRemaining(today: Date, targetDateStr: string): number {
  const parts = targetDateStr.split('-');
  const tYear = parseInt(parts[0], 10);
  const tMonth = parseInt(parts[1], 10);
  const tDay = parseInt(parts[2], 10);
  const cYear = today.getFullYear();
  const cMonth = today.getMonth() + 1;
  const cDay = today.getDate();
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
      .select('name, target_amount, current_amount, status, target_date')
      .eq('user_id', userId),
  ]);

  const profile = profileRes.data;
  const allTxs = allTxRes.data || [];
  const budgets = budgetsRes.data || [];
  const goals = goalsRes.data || [];
  const primaryCurrency = allTxs[0]?.currency || 'UZS';

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

  for (const t of allTxs) {
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

    // Track small recurring expenses (<= 100,000 UZS)
    if (!isIncome && amt <= 100000) {
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
  lines.push(`- Asosiy hisob valyutasi: ${primaryCurrency}`);
  lines.push(`- Jami barcha vaqtlar balansi: ${formatUzMoney(totalLifetimeIncome - totalLifetimeExpense, primaryCurrency)}`);
  lines.push(`- Jami daromadlar (barcha): ${formatUzMoney(totalLifetimeIncome, primaryCurrency)}`);
  lines.push(`- Jami xarajatlar (barcha): ${formatUzMoney(totalLifetimeExpense, primaryCurrency)}`);
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
    lines.push(`  * Jami daromad: ${formatUzMoney(s.income, primaryCurrency)} (${s.incomeCount} ta tranzaksiya)`);
    lines.push(`  * Jami xarajat: ${formatUzMoney(s.expense, primaryCurrency)} (${s.expenseCount} ta tranzaksiya)`);
    lines.push(`  * Sof pul oqimi (Qoldiq / Net): ${formatUzMoney(s.income - s.expense, primaryCurrency)}`);

    const sortedCats = Object.entries(s.categories).sort(([, a], [, b]) => b.sum - a.sum);
    lines.push(`  * Kategoriyalar bo'yicha xarajatlar (kamayish tartibida):`);
    for (const [cName, cData] of sortedCats) {
      const pct = s.expense > 0 ? ((cData.sum / s.expense) * 100).toFixed(1) : '0';
      lines.push(`    - ${cName}: ${formatUzMoney(cData.sum, primaryCurrency)} (${cData.count} ta, ${pct}%)`);
    }

    // Top individual transactions for this month
    const topMonthTxs = allTxs
      .filter((t) => t.type === 'expense' && (t.transaction_date || '').substring(0, 7) === m)
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
    if (topMonthTxs.length > 0) {
      lines.push(`  * Eng katta individual xarajatlar:`);
      for (const tx of topMonthTxs) {
        const cat = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
        lines.push(`    - "${tx.description}" (${cat?.name || 'Boshqa'}): ${formatUzMoney(Number(tx.amount), tx.currency || primaryCurrency)} (Sana: ${tx.transaction_date})`);
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
    lines.push(`  * ${prevKey} xarajati: ${formatUzMoney(prev.expense, primaryCurrency)} (Daromad: ${formatUzMoney(prev.income, primaryCurrency)}, Qoldiq: ${formatUzMoney(prev.income - prev.expense, primaryCurrency)})`);
    lines.push(`  * ${latestKey} xarajati: ${formatUzMoney(latest.expense, primaryCurrency)} (Daromad: ${formatUzMoney(latest.income, primaryCurrency)}, Qoldiq: ${formatUzMoney(latest.income - latest.expense, primaryCurrency)})`);
    lines.push(`  * Farq: ${latestKey} oyida xarajatlar ${formatUzMoney(Math.abs(diffExpense), primaryCurrency)} ga (${Math.abs(Number(pctChange))}%) ${diffExpense <= 0 ? 'kamaygan (tejalgan)' : 'oshgan'}.`);
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
    lines.push(`  * ${catName}: Jami ${data.count} marta, umumiy ${formatUzMoney(data.total, primaryCurrency)}, o'rtacha ${formatUzMoney(avg, primaryCurrency)} / marta. Asosiy: ${topMerchants}`);
  }

  // Active budgets & goals
  if (budgets.length > 0) {
    lines.push(`\n--- Faol Budjetlar ---`);
    for (const b of budgets) {
      lines.push(`  * ${b.name}: ${formatUzMoney(Number(b.amount), b.currency || primaryCurrency)} (${b.period_type})`);
    }
  }

  if (goals.length > 0) {
    const activeMonthsCount = sortedMonths.length || 1;
    const avgMonthlyNet = Math.round((totalLifetimeIncome - totalLifetimeExpense) / activeMonthsCount);
    lines.push(`\n--- Jamg'arma Maqsadlari ---`);
    for (const g of goals) {
      const current = Number(g.current_amount) || 0;
      const target = Number(g.target_amount) || 0;
      const remaining = Math.max(0, target - current);
      const pct = target > 0 ? ((current / target) * 100).toFixed(1) : '0';
      if (g.status === 'completed' || remaining === 0) {
        lines.push(`  * ${g.name}: ${formatUzMoney(current, primaryCurrency)} / ${formatUzMoney(target, primaryCurrency)} (${pct}%) - Maqsad to‘liq bajarildi!`);
      } else if (g.target_date) {
        const months = computeMonthsRemaining(new Date(), g.target_date);
        const monthlyNeeded = months > 0 ? Math.round(remaining / months) : remaining;
        const isFeasible = avgMonthlyNet >= monthlyNeeded;
        lines.push(
          `  * ${g.name}: ${formatUzMoney(current, primaryCurrency)} / ${formatUzMoney(target, primaryCurrency)} (${pct}% bajarildi, qolgan: ${formatUzMoney(remaining, primaryCurrency)}, muddat: ${g.target_date}, qolgan oylar: ${months} oy, kerakli oylik: ${formatUzMoney(monthlyNeeded, primaryCurrency)}/oy). ` +
          (isFeasible
            ? `Amalga oshirish mumkin (Oylik erkin mablag‘: ${formatUzMoney(avgMonthlyNet, primaryCurrency)} >= ${formatUzMoney(monthlyNeeded, primaryCurrency)}).`
            : `Imkoniyat yetarli emas (Kerakli ${formatUzMoney(monthlyNeeded, primaryCurrency)} > oylik erkin mablag‘ ${formatUzMoney(avgMonthlyNet, primaryCurrency)}). Muddatni uzaytirish yoki xarajatlarni kamaytirish tavsiya etiladi.`)
        );
      } else {
        lines.push(`  * ${g.name}: ${formatUzMoney(current, primaryCurrency)} / ${formatUzMoney(target, primaryCurrency)} (${pct}%, qolgan: ${formatUzMoney(remaining, primaryCurrency)})`);
      }
    }
  }

  if (profile) {
    lines.push(`\n=== FOYDALANUVCHINING REJALASHTIRILGAN ONBOARDING MA’LUMOTLARI (PLANNING ESTIMATES) ===`);
    lines.push(`- DIQQAT: Ushbu raqamlar ro‘yxatdan o‘tishda rejalashtirish uchun kiritilgan baholashlar (taxminlar) bo‘lib, haqiqiy hisob balansi yoki tranzaksiya hisoblanmaydi.`);
    if (profile.declared_monthly_income !== null && profile.declared_monthly_income !== undefined) {
      lines.push(`- Rejalashtirilgan oylik daromad (taxmin): ${formatUzMoney(Number(profile.declared_monthly_income), 'UZS')}`);
    }
    if (profile.declared_monthly_expenses !== null && profile.declared_monthly_expenses !== undefined) {
      lines.push(`- Rejalashtirilgan oylik xarajat (taxmin): ${formatUzMoney(Number(profile.declared_monthly_expenses), 'UZS')}`);
    }
    if (profile.target_expense_reduction_percent !== null && profile.target_expense_reduction_percent !== undefined) {
      lines.push(`- Xarajatlarni kamaytirish maqsadi: ${profile.target_expense_reduction_percent}%`);
    }
    if (profile.target_monthly_expenses !== null && profile.target_monthly_expenses !== undefined) {
      lines.push(`- Maqsadli oylik xarajat (rejada): ${formatUzMoney(Number(profile.target_monthly_expenses), 'UZS')}`);
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
function buildVerifiedFallbackAnswer(question: string, facts: VerifiedFinancialFacts): string {
  const q = question.toLowerCase();
  const money = (value: number) => formatUzMoney(value, facts.primaryCurrency);

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

  return `AI xizmati vaqtincha javob bera olmadi. Tasdiqlangan tranzaksiyalaringiz bo‘yicha: jami daromad ${money(facts.totalIncome)}, jami xarajat ${money(facts.totalExpense)}, sof qoldiq ${money(facts.totalIncome - facts.totalExpense)} (${facts.transactionCount} ta tranzaksiya).`;
}/**
 * Handles conversational financial advisory with Gemini grounded on verified facts
 */
export async function askFinancialAdvisor(
  question: string,
  conversationId?: string,
  client?: SupabaseClient
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
    if (!convId) {
      const titleSummary = question.length > 40 ? question.slice(0, 37) + '...' : question;
      const { data: newConv, error: convErr } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: titleSummary,
        })
        .select()
        .single();

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
    await supabase.from('ai_messages').insert({
      conversation_id: convId,
      user_id: user.id,
      role: 'user',
      content: question.trim(),
    });

    // 3.1 Check deterministic financial action engine (5 core scenarios, clarifications, confirmations)
    const { processFinancialIntent } = await import('./financialActionEngine.ts');
    const intentResult = await processFinancialIntent(question, convId!, user.id, supabase);

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

2. JAVOB FORMATI (To'liq, mazmunli va ixcham):
   - 1-jumla: Savolga to'g'ridan-to'g'ri, lo'nda javob.
   - Keyingi 1–2 jumla: Kerakli hisob-kitob, solishtirish yoki izoh.
   - Oxirida: Zarur bo'lsa, bitta aniq amaliy tavsiya yoki bitta zarur savol.
   - Keraksiz kirish jumlalari ("Salom", "Albatta yordam beraman") va takroriy xulosalar yozmang.

3. FAKTIK ANIKLIK VA VALYUTA:
   - Barcha pul summalarini so'mda (masalan: 6 000 000 soʻm) ko'rsating.
   - Raqamlarni aslo o'ylab topmang, faqat berilgan kontekst faktlaridan oling. Agar ma'lumot yetishmasa yoki baza bo'sh bo'lsa, buni ochiq ayting.
   - ONBOARDING VA REJALASHTIRISH FAKTLARI:
     * Foydalanuvchining onboardingda ko‘rsatgan oylik daromadi yoki xarajati — bu REJA VA TAXMIN (PLANNING ESTIMATE).
     * Foydalanuvchi bu pullarni ishlab topgan yoki sarflagan deb ASLO da'vo qilmang.
     * Tranzaksiyalar soni 0 ta bo‘lsa, hisob mutlaqo toza (0 soʻm) ekanligini bildiring va foydalanuvchiga tranzaksiyalar qo‘shilgach aniqroq tahlillar taqdim etilishini tushuntiring.
     * Jamg‘arma maqsadlari yangi boshlangan bo‘lsa, to‘plangan mablag‘ 0 soʻm ekanligini ko‘rsating.
   - Amal muvaffaqiyatsiz bo'lsa yoki bajarilmagan bo'lsa, aslo bajarildi deb da'vo qilmang.

4. TILI: O'zbek tilida tabiiy, to'liq, ravon va grammatik to'g'ri jumlalar bilan yozing. Javobni aslo chala yoki tugallanmagan qoldirmang.`;

    const fullPrompt = `${verified.text}\n\nUSER QUESTION: ${question.trim()}`;

    const aiRes = await generateAIContent(fullPrompt, systemInstruction);

    // If the AI provider is unavailable, answer only from verified database facts
    const finalAnswer =
      !aiRes.isFallback && aiRes.text.trim()
        ? aiRes.text
        : buildVerifiedFallbackAnswer(question, verified.facts);

    // 5. Save Assistant response to ai_messages
    const evidence = {
      grounded_context: verified.text,
      model_used: aiRes.isFallback ? 'verified-facts-fallback' : aiRes.model,
      is_fallback: aiRes.isFallback,
    };

    const { data: assistantMsg, error: msgErr } = await supabase
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

    if (msgErr) {
      return { data: null, error: msgErr.message, status: 500 };
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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, categories(name)')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('transaction_date', thirtyDaysAgo);

    let currentSpending = 0;
    for (const t of txs || []) {
      const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
      const name = cat?.name || 'Uncategorized';
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
    const msg = err instanceof Error ? err.message : 'Error simulating scenario';
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
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
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
    const msg = err instanceof Error ? err.message : 'Error fetching conversations';
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
      return { data: null, error: 'Unauthorized: Authentication required', status: 401 };
    }

    const { data: conv, error: convErr } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (convErr || !conv) {
      return { data: null, error: 'Conversation not found', status: 404 };
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
    const msg = err instanceof Error ? err.message : 'Error fetching messages';
    return { data: null, error: msg, status: 500 };
  }
}
