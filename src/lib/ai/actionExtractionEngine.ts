/**
 * UzHamyon AI Action Extraction Engine
 *
 * Uses Google Gemini API with structured JSON output to parse natural language messages
 * into verified, strongly-typed financial actions (single/multiple transactions, goals, savings).
 */

import { generateGeminiJson } from './geminiClient.ts';
import { isValidCalendarDate, isValidTimeString } from '../transactions/dateTime.ts';
import { nowTashkent, yesterdayTashkent } from '../time/tashkent.ts';
import { defaultCategoryNames, pickAllowedName } from '../categories/catalog.ts';
import { AiBudget, isAiBudgetExceeded } from './aiBudget.ts';
import {
  MAX_ACTIONS_PER_MESSAGE,
  isAmountWithinLimit,
  TOO_MANY_ACTIONS_MESSAGE,
  AMOUNT_TOO_LARGE_MESSAGE,
} from './limits.ts';
import { formatMoney } from '../formatters/money.ts';
import { mentionedCurrency, type DisplayCurrency } from '../fx/currency.ts';

export type FinancialIntentType =
  | 'action_proposal'
  | 'financial_query'
  | 'clarification'
  | 'casual_chat';

export interface ExtractedActionItem {
  actionType: 'create_transaction' | 'create_goal' | 'update_goal' | 'contribute_goal';
  transactionType?: 'expense' | 'income';
  amount: number;
  currency: string;
  /**
   * false = the user did not name a currency, so `currency` is a default that may be
   * replaced by the user's display currency (applyDefaultCurrency).
   */
  currencyExplicit?: boolean;
  description: string;
  /** Category name as chosen by the AI (one of the allowed names), later the DB row name. */
  categoryName?: string;
  /** Resolved DB category id (set before the proposal is saved). */
  categoryId?: string;
  /** Uzbek name shown to the user. */
  categoryDisplayName?: string;
  date?: string;
  time?: string;
  /** transactions.source for rows created from this action (telegram_ai / telegram_voice). */
  source?: string;
  // Goal parameters
  goalName?: string;
  targetAmount?: number;
  targetDate?: string;
}

export interface ExtractionResult {
  intent: FinancialIntentType;
  actions: ExtractedActionItem[];
  clarificationQuestion?: string;
  summaryUzbek: string;
  rawExplanation?: string;
  /**
   * Set when the AI could not be used at all. Callers must NOT treat this as a real
   * "financial_query": the user's message was not understood.
   */
  error?: 'ai_unavailable' | 'budget_exceeded';
  /** Voice input only: what the user said, word for word (from Gemini). */
  transcript?: string;
}

export interface ExtractionOptions {
  /** Grounded user context appended to the prompt (web advisor). */
  userFinancialContextText?: string;
  /** Allowed category names per type (user's own + system, Uzbek names). */
  categories?: { expense: string[]; income: string[] };
  /** Shared AI time budget for this update. */
  budget?: AiBudget;
  /** Clock override for tests. */
  now?: Date;
  /**
   * The user's display currency: used for new transactions and goals when the message
   * names no currency. Omit when unknown yet (the bot applies it after sign-in).
   */
  defaultCurrency?: DisplayCurrency;
  /**
   * Voice input (Phase 2): the audio is sent inline to Gemini together with the SAME
   * system prompt; Gemini also returns a `transcript`. Then the same validation runs.
   */
  audio?: { mimeType: string; base64: string };
}

interface RawGeminiOutput {
  intent?: string;
  actions?: Array<{
    actionType?: string;
    transactionType?: string;
    amount?: number | string;
    currency?: string;
    description?: string;
    categoryName?: string;
    date?: string;
    time?: string;
    goalName?: string;
    targetAmount?: number | string;
    targetDate?: string;
  }>;
  clarificationQuestion?: string | null;
  summaryUzbek?: string;
  transcript?: string;
}



/**
 * Builds the system instruction for Gemini action extraction
 */
function buildExtractionSystemPrompt(
  todayDate: string,
  currentTime: string,
  yesterdayDate: string,
  categories: { expense: string[]; income: string[] }
): string {
  return `Siz UzHamyon moliyaviy platformasi uchun foydalanuvchi xabarlarini tahlil qiluvchi va strukturaviy amallarni ajratuvchi AI yordamchisiz.
Bugungi sana: ${todayDate}. Hozirgi vaqt: ${currentTime}.

Vazifangiz: Foydalanuvchi xabarini diqqat bilan o'qib, qat'iy JSON formatida quyidagi sxemaga mos javob qaytarish:
{
  "intent": "action_proposal" | "financial_query" | "clarification" | "casual_chat",
  "actions": [
    {
      "actionType": "create_transaction" | "create_goal" | "update_goal" | "contribute_goal",
      "transactionType": "expense" | "income",
      "amount": number,
      "currency": "UZS" | "USD" | null,
      "description": string,
      "categoryName": string | null,
      "date": "YYYY-MM-DD",
      "time": "HH:mm",
      "goalName": string,
      "targetAmount": number,
      "targetDate": "YYYY-MM-DD"
    }
  ],
  "clarificationQuestion": string | null,
  "summaryUzbek": string
}

QOIDALAR:
1. "action_proposal" qachon qo'yiladi:
   - Foydalanuvchi xarajat qilganini, daromad olganini, maqsad yaratishni, maqsadini o'zgartirishni yoki jamg'armaga pul qo'shganini aytganda.
   - Bitta xabarda bir nechta tranzaksiya bo'lsa (masalan: "Tushlik 45000 va taksi 15000"), "actions" massivida har biri uchun alohida element yarating!
   - 1 mln = 1 000 000, 50 ming / 50k = 50 000, 2.5 mln = 2 500 000.
   - "currency": foydalanuvchi aniq aytgan valyuta ("$", "dollar", "usd" -> "USD"; "so'm", "sum", "ming", "mln" -> "UZS"). Valyuta aytilmagan bo'lsa: null. Summani hech qachon boshqa valyutaga o'girmang.
   - "kecha" desa: kechagi sana (${yesterdayDate}), "bugun" desa: ${todayDate}. Vaqt zonasi: Asia/Tashkent.
   - "categoryName" FAQAT quyidagi ro'yxatdagi nomlardan biri bo'lsin (aynan shu yozilishda). Mos keladigani bo'lmasa: null.
     Xarajat kategoriyalari: ${categories.expense.length ? categories.expense.join(', ') : '(yo‘q)'}
     Daromad kategoriyalari: ${categories.income.length ? categories.income.join(', ') : '(yo‘q)'}

2. "create_goal" vs "update_goal" vs "contribute_goal":
   - "Yangi maqsad: Noutbuk uchun 10 mln" -> actionType: "create_goal", goalName: "Noutbuk", targetAmount: 10000000.
   - "Noutbuk maqsadini 12 mln ga o'zgartir" -> actionType: "update_goal", goalName: "Noutbuk", targetAmount: 12000000.
   - "Noutbuk maqsadiga 500 ming qo'shdim" / "hissa qo'shdim" -> actionType: "contribute_goal", goalName: "Noutbuk", amount: 500000.

3. "clarification" qachon qo'yiladi:
   - Foydalanuvchi amal bajarmoqchi, lekin zarur summa aytilmagan (masalan: "Tushlik qildim" yoki "Noutbuk maqsadi yaratmoqchiman").
   - clarificationQuestion maydoniga o'zbek tilida bitta qisqa aniqlashtiruvchi savol yozing.

4. "financial_query" qachon qo'yiladi:
   - Foydalanuvchi o'z balansi, xarajatlari, kategoriyalari yoki budjeti haqida savol berganda (masalan: "Bu oy qancha pul sarfladim?", "Balansim qancha?"). actions: [].

5. "casual_chat" qachon qo'yiladi:
   - Oddiy salomlashuv, tashakkur yoki umumiy suhbat ("Salom", "Rahmat", "Qandaysan"). actions: [].

6. "summaryUzbek":
   - Foydalanuvchiga amallarni tasdiqlash uchun aniq, chiroyli va tushunarli o'zbekcha xulosa (preview).
   - Masalan: "Quyidagi 2 ta xarajatni qayd etishni tasdiqlaysizmi?\\n• Tushlik: 45 000 so‘m\\n• Taksi: 15 000 so‘m"`;
}

/** Deterministic Uzbek confirmation text for the extracted actions. */
export function buildActionSummary(actions: ExtractedActionItem[]): string {
  if (actions.length === 1) {
    const a = actions[0];
    if (a.actionType === 'create_transaction') {
      return `${formatMoney(a.amount, a.currency)} miqdorida ${a.transactionType === 'income' ? 'daromadni' : 'xarajatni'} («${a.description}») qayd etishni tasdiqlaysizmi?`;
    } else if (a.actionType === 'create_goal') {
      return `«${a.goalName}» uchun ${formatMoney(a.targetAmount || a.amount, a.currency)} jamg‘arma maqsadini yaratishni tasdiqlaysizmi?`;
    } else if (a.actionType === 'update_goal') {
      return `«${a.goalName}» maqsadi miqdorini ${formatMoney(a.targetAmount || a.amount, a.currency)}ga o‘zgartirishni tasdiqlaysizmi?`;
    } else if (a.actionType === 'contribute_goal') {
      return `«${a.goalName || 'Jamg‘arma'}» maqsadiga ${formatMoney(a.amount, a.currency)} qo‘shishni tasdiqlaysizmi?`;
    }
  } else if (actions.length > 1) {
    const lines = actions.map((a, i) => {
      const typeText = a.transactionType === 'income' ? 'Daromad' : 'Xarajat';
      return `${i + 1}. ${a.description} (${typeText}): ${formatMoney(a.amount, a.currency)}`;
    });
    return `Quyidagi ${actions.length} ta operatsiyani qayd etishni tasdiqlaysizmi?\n\n` + lines.join('\n');
  }
  return '';
}

/**
 * Without a named currency, a plain amount below this is read as dollars for a
 * dollar user ("kofe 4"); a bigger one ("taksi 20000") is clearly so'm.
 */
const USD_DEFAULT_MAX = 10_000;

/**
 * Puts the user's display currency on new transactions and goals whose currency the
 * message did not name. Goal updates/contributions keep the goal's own currency rules.
 * Rebuilds the confirmation text when anything changed.
 */
export function applyDefaultCurrency(result: ExtractionResult, defaultCurrency: DisplayCurrency): ExtractionResult {
  if (defaultCurrency !== 'USD' || !result.actions.length) return result;
  let changed = false;
  const actions = result.actions.map((a) => {
    if (a.currencyExplicit !== false) return a;
    if (a.actionType !== 'create_transaction' && a.actionType !== 'create_goal') return a;
    const amount = Number(a.targetAmount || a.amount);
    if (!(amount > 0) || amount >= USD_DEFAULT_MAX || !isAmountWithinLimit(amount, 'USD')) return a;
    if (a.currency === 'USD') return a;
    changed = true;
    return { ...a, currency: 'USD' };
  });
  if (!changed) return result;
  return { ...result, actions, summaryUzbek: buildActionSummary(actions) || result.summaryUzbek };
}

/**
 * Sanitizes input to prevent personal identifiable information (PII) from being sent to external AI
 */
export function sanitizeUserInputForAi(text: string): string {
  return text
    // 16-digit card numbers
    .replace(/\b(?:\d[ -]?){15}\d\b/g, '[KARTA]')
    // Phone numbers (Uzbekistan and international format)
    .replace(/(?:\+?998[\s-]?)?(?:9[0-9]|7[0-9]|8[8-9]|3[3-4])[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g, '[TELEFON]')
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // Bearer authorization tokens
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}\b/gi, '[TOKEN]')
    // API keys / tokens (common patterns)
    .replace(/\b(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}|(?:sk-|key-|AIza)[A-Za-z0-9_-]{15,})\b/g, '[TOKEN]');
}

/**
 * Extracts structured financial intent and actions from a user text message
 */
export async function extractFinancialActions(
  userText: string,
  contextOrOptions?: string | ExtractionOptions
): Promise<ExtractionResult> {
  const options: ExtractionOptions =
    typeof contextOrOptions === 'string'
      ? { userFinancialContextText: contextOrOptions }
      : contextOrOptions || {};
  const { userFinancialContextText, budget } = options;
  const allowedCategories = {
    expense: options.categories?.expense?.length ? options.categories.expense : defaultCategoryNames('expense'),
    income: options.categories?.income?.length ? options.categories.income : defaultCategoryNames('income'),
  };
  const trimmed = userText.trim();
  if (!trimmed && !options.audio) {
    return {
      intent: 'casual_chat',
      actions: [],
      summaryUzbek: 'Iltimos, xabaringizni yozing.',
    };
  }

  const sanitizedText = sanitizeUserInputForAi(trimmed);
  const nowAt = options.now ?? new Date();
  const { date: todayDate, time: currentTime } = nowTashkent(nowAt);
  const systemPrompt = buildExtractionSystemPrompt(
    todayDate,
    currentTime,
    yesterdayTashkent(nowAt),
    allowedCategories
  );

  let fullPrompt = options.audio
    ? `FOYDALANUVCHI OVOZLI XABAR YUBORDI (audio ilova qilingan).
ENG MUHIM QOIDA: faqat audioda HAQIQATAN eshitilgan inson nutqini yozing. Hech narsa o'ylab topmang.
- Agar audioda aniq nutq bo'lmasa (sukut, shovqin, musiqa, signal) yoki so'zlarni aniq tushunib bo'lmasa: "transcript": "", "intent": "casual_chat", "actions": [].
- Yuqoridagi tizim ko'rsatmasidagi misol gaplarni va misol summalarni HECH QACHON transcript sifatida yozmang.
1. "transcript": aytilgan gaplarni so'zma-so'z, aytilgan tilda yozing (o'zbek, rus yoki aralash). Hech narsa qo'shmang va o'zgartirmang.
2. Keyin faqat shu transcript asosida, xuddi matnli xabar kabi tahlil qiling va JSON sxemasiga "transcript": string maydonini qo'shib qaytaring.
3. Summalarni so'z bilan aytilgan bo'lsa raqamga aylantiring: "N ming" = N × 1 000, "N million" = N × 1 000 000, "yarim million" = 500 000, ruscha "tisyach" = ming.`
    : `FOYDALANUVCHI XABARI: "${sanitizedText}"`;
  if (userFinancialContextText) {
    fullPrompt += `\n\nFOYDALANUVCHINING MAVJUD MA'LUMOTLARI:\n${sanitizeUserInputForAi(userFinancialContextText)}`;
  }

  try {
    const geminiRes = await generateGeminiJson<RawGeminiOutput>(
      fullPrompt,
      systemPrompt,
      undefined,
      budget ? budget.perCallMs : 30000,
      options.audio
        ? {
            budget,
            // Voice: GEMINI_MODEL first (decision Q3); OpenRouter is text-only, so never for audio.
            modelOrder: 'primary',
            allowOpenRouter: false,
            extraParts: [{ inlineData: { mimeType: options.audio.mimeType, data: options.audio.base64 } }],
          }
        : { budget }
    );
    const parsed = geminiRes.data;
    const transcript = options.audio
      ? (typeof parsed.transcript === 'string' ? parsed.transcript.trim().slice(0, 1000) : '')
      : undefined;

    let intent: FinancialIntentType = 'casual_chat';
    if (parsed.intent === 'action_proposal') intent = 'action_proposal';
    else if (parsed.intent === 'financial_query') intent = 'financial_query';
    else if (parsed.intent === 'clarification') intent = 'clarification';

    // Validate and sanitize actions
    const sanitizedActions: ExtractedActionItem[] = [];

    if (Array.isArray(parsed.actions) && parsed.actions.length > MAX_ACTIONS_PER_MESSAGE) {
      return {
        intent: 'clarification',
        actions: [],
        transcript,
        clarificationQuestion: TOO_MANY_ACTIONS_MESSAGE,
        summaryUzbek: TOO_MANY_ACTIONS_MESSAGE,
      };
    }

    let amountTooLarge = false;

    // Did the user name a currency at all? If not, the AI's guess is ignored and the
    // default (so'm, or the user's display currency) is used instead.
    const namedCurrency = mentionedCurrency(options.audio ? transcript : trimmed);
    let currencyReplaced = false;

    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      for (const act of parsed.actions) {
        const rawAmount = Number(act.amount) || Number(act.targetAmount) || 0;
        const aiCurrency = String(act.currency || '').toUpperCase();
        const currencyExplicit = Boolean(namedCurrency);
        const currency = currencyExplicit
          ? aiCurrency === 'USD' || aiCurrency === 'UZS'
            ? aiCurrency
            : namedCurrency!
          : 'UZS';
        if (aiCurrency && aiCurrency !== currency) currencyReplaced = true;
        const date = act.date && isValidCalendarDate(act.date) ? act.date : todayDate;
        const time = act.time && isValidTimeString(act.time) ? act.time.slice(0, 5) : currentTime;

        const checkedAmount = act.actionType === 'create_goal' || act.actionType === 'update_goal'
          ? Number(act.targetAmount) || rawAmount
          : rawAmount;
        if (checkedAmount > 0 && !isAmountWithinLimit(checkedAmount, currency)) {
          amountTooLarge = true;
          continue;
        }

        if (act.actionType === 'create_goal') {
          const targetAmount = Number(act.targetAmount) || rawAmount;
          if (targetAmount > 0) {
            sanitizedActions.push({
              actionType: 'create_goal',
              goalName: (act.goalName || 'Jamg‘arma maqsadi').trim(),
              targetAmount,
              amount: targetAmount,
              currency,
              currencyExplicit,
              description: `Maqsad: ${(act.goalName || 'Jamg‘arma').trim()}`,
              targetDate: act.targetDate && isValidCalendarDate(act.targetDate) ? act.targetDate : undefined,
              date,
              time,
            });
          }
        } else if (act.actionType === 'update_goal') {
          const targetAmount = Number(act.targetAmount) || rawAmount;
          if (targetAmount > 0) {
            sanitizedActions.push({
              actionType: 'update_goal',
              goalName: (act.goalName || 'Jamg‘arma maqsadi').trim(),
              targetAmount,
              amount: targetAmount,
              currency,
              currencyExplicit,
              description: `Maqsadni yangilash: ${(act.goalName || 'Jamg‘arma').trim()}`,
              targetDate: act.targetDate && isValidCalendarDate(act.targetDate) ? act.targetDate : undefined,
              date,
              time,
            });
          }
        } else if (act.actionType === 'contribute_goal') {
          if (rawAmount > 0) {
            sanitizedActions.push({
              actionType: 'contribute_goal',
              goalName: (act.goalName || '').trim(),
              amount: rawAmount,
              currency,
              currencyExplicit,
              description: `Hissa: ${(act.goalName || 'Jamg‘arma').trim()}`,
              date,
              time,
            });
          }
        } else {
          // Standard transaction (expense or income)
          if (rawAmount > 0) {
            const txType = act.transactionType === 'income' ? 'income' : 'expense';
            sanitizedActions.push({
              actionType: 'create_transaction',
              transactionType: txType,
              amount: rawAmount,
              currency,
              currencyExplicit,
              description: (act.description || (txType === 'income' ? 'Daromad' : 'Xarajat')).trim(),
              categoryName: pickAllowedName(act.categoryName, allowedCategories[txType]),
              date,
              time,
            });
          }
        }
      }
    }

    // Never save part of a message when one amount is out of range: ask to fix it.
    if (amountTooLarge) {
      return {
        intent: 'clarification',
        actions: [],
        transcript,
        clarificationQuestion: AMOUNT_TOO_LARGE_MESSAGE,
        summaryUzbek: AMOUNT_TOO_LARGE_MESSAGE,
      };
    }

    // If actions were extracted, guarantee intent is action_proposal
    if (sanitizedActions.length > 0) {
      intent = 'action_proposal';
    } else if (intent === 'action_proposal' && sanitizedActions.length === 0) {
      // Ambiguous: user wanted an action but amount was missing
      intent = 'clarification';
    }

    // Gemini's own preview is kept unless we changed a currency it wrote into it.
    let summaryUzbek = currencyReplaced ? '' : parsed.summaryUzbek?.trim() || '';
    if (!summaryUzbek) summaryUzbek = buildActionSummary(sanitizedActions);

    const result: ExtractionResult = {
      intent,
      actions: sanitizedActions,
      clarificationQuestion: parsed.clarificationQuestion || undefined,
      transcript,
      summaryUzbek: summaryUzbek || 'Iltimos, ma’lumotingizni tasdiqlang.',
    };
    return options.defaultCurrency ? applyDefaultCurrency(result, options.defaultCurrency) : result;
  } catch (err: unknown) {
    const budgetExceeded = isAiBudgetExceeded(err);
    console.error(
      '[ActionExtractionEngine] Extraction error:',
      budgetExceeded ? 'AI time budget exhausted' : err instanceof Error ? err.message : err
    );
    // Keep intent 'financial_query' for backwards compatibility (web advisor), but mark the
    // error so the Telegram bot can ask the user to try again instead of guessing.
    return {
      intent: 'financial_query',
      actions: [],
      summaryUzbek: 'Xabaringiz qabul qilindi.',
      error: budgetExceeded ? 'budget_exceeded' : 'ai_unavailable',
    };
  }
}

