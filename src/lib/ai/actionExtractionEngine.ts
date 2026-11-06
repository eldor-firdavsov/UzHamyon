/**
 * UzHamyon AI Action Extraction Engine
 *
 * Uses Google Gemini API with structured JSON output to parse natural language messages
 * into verified, strongly-typed financial actions (single/multiple transactions, goals, savings).
 */

import { generateGeminiJson } from './geminiClient.ts';
import { getNowLocalDateString, getNowLocalTimeString, isValidCalendarDate } from '../transactions/dateTime.ts';

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
  description: string;
  categoryName?: string;
  date?: string;
  time?: string;
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
}

function formatUzbekMoney(amount: number, curr = 'UZS'): string {
  if (curr === 'USD') {
    return `${amount >= 1000 ? amount.toLocaleString('en-US') : amount} dollar`;
  }
  return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount)).replace(/[\u00a0\u202f]/g, ' ')} so‘m`;
}

/**
 * Builds the system instruction for Gemini action extraction
 */
function buildExtractionSystemPrompt(todayDate: string, currentTime: string): string {
  return `Siz UzHamyon moliyaviy platformasi uchun foydalanuvchi xabarlarini tahlil qiluvchi va strukturaviy amallarni ajratuvchi AI yordamchisiz.
Bugungi sana: ${todayDate}. Hozirgi vaqt: ${currentTime}. Asosiy valyuta: UZS (so'm).

Vazifangiz: Foydalanuvchi xabarini diqqat bilan o'qib, qat'iy JSON formatida quyidagi sxemaga mos javob qaytarish:
{
  "intent": "action_proposal" | "financial_query" | "clarification" | "casual_chat",
  "actions": [
    {
      "actionType": "create_transaction" | "create_goal" | "update_goal" | "contribute_goal",
      "transactionType": "expense" | "income",
      "amount": number,
      "currency": "UZS" | "USD",
      "description": string,
      "categoryName": string,
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
   - "kecha" desa: kechagi sana (${new Date(Date.now() - 86400000).toISOString().split('T')[0]}), "bugun" desa: ${todayDate}.

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
  userFinancialContextText?: string
): Promise<ExtractionResult> {
  const trimmed = userText.trim();
  if (!trimmed) {
    return {
      intent: 'casual_chat',
      actions: [],
      summaryUzbek: 'Iltimos, xabaringizni yozing.',
    };
  }

  const sanitizedText = sanitizeUserInputForAi(trimmed);
  const todayDate = getNowLocalDateString();
  const currentTime = getNowLocalTimeString();
  const systemPrompt = buildExtractionSystemPrompt(todayDate, currentTime);

  let fullPrompt = `FOYDALANUVCHI XABARI: "${sanitizedText}"`;
  if (userFinancialContextText) {
    fullPrompt += `\n\nFOYDALANUVCHINING MAVJUD MA'LUMOTLARI:\n${sanitizeUserInputForAi(userFinancialContextText)}`;
  }

  try {
    const geminiRes = await generateGeminiJson<RawGeminiOutput>(fullPrompt, systemPrompt);
    const parsed = geminiRes.data;

    let intent: FinancialIntentType = 'casual_chat';
    if (parsed.intent === 'action_proposal') intent = 'action_proposal';
    else if (parsed.intent === 'financial_query') intent = 'financial_query';
    else if (parsed.intent === 'clarification') intent = 'clarification';

    // Validate and sanitize actions
    const sanitizedActions: ExtractedActionItem[] = [];

    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      for (const act of parsed.actions) {
        const rawAmount = Number(act.amount) || Number(act.targetAmount) || 0;
        const currency = act.currency === 'USD' ? 'USD' : 'UZS';
        const date = act.date && isValidCalendarDate(act.date) ? act.date : todayDate;
        const time = act.time || currentTime;

        if (act.actionType === 'create_goal') {
          const targetAmount = Number(act.targetAmount) || rawAmount;
          if (targetAmount > 0) {
            sanitizedActions.push({
              actionType: 'create_goal',
              goalName: (act.goalName || 'Jamg‘arma maqsadi').trim(),
              targetAmount,
              amount: targetAmount,
              currency,
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
              description: (act.description || (txType === 'income' ? 'Daromad' : 'Xarajat')).trim(),
              categoryName: act.categoryName || undefined,
              date,
              time,
            });
          }
        }
      }
    }

    // If actions were extracted, guarantee intent is action_proposal
    if (sanitizedActions.length > 0) {
      intent = 'action_proposal';
    } else if (intent === 'action_proposal' && sanitizedActions.length === 0) {
      // Ambiguous: user wanted an action but amount was missing
      intent = 'clarification';
    }

    // Build default Uzbek summary preview if Gemini gave empty preview
    let summaryUzbek = parsed.summaryUzbek?.trim() || '';
    if (!summaryUzbek) {
      if (sanitizedActions.length === 1) {
        const a = sanitizedActions[0];
        if (a.actionType === 'create_transaction') {
          summaryUzbek = `${formatUzbekMoney(a.amount, a.currency)} miqdorida ${a.transactionType === 'income' ? 'daromadni' : 'xarajatni'} («${a.description}») qayd etishni tasdiqlaysizmi?`;
        } else if (a.actionType === 'create_goal') {
          summaryUzbek = `«${a.goalName}» uchun ${formatUzbekMoney(a.targetAmount || a.amount, a.currency)} jamg‘arma maqsadini yaratishni tasdiqlaysizmi?`;
        } else if (a.actionType === 'update_goal') {
          summaryUzbek = `«${a.goalName}» maqsadi miqdorini ${formatUzbekMoney(a.targetAmount || a.amount, a.currency)}ga o‘zgartirishni tasdiqlaysizmi?`;
        } else if (a.actionType === 'contribute_goal') {
          summaryUzbek = `«${a.goalName || 'Jamg‘arma'}» maqsadiga ${formatUzbekMoney(a.amount, a.currency)} qo‘shishni tasdiqlaysizmi?`;
        }
      } else if (sanitizedActions.length > 1) {
        const lines = sanitizedActions.map((a, i) => {
          const typeText = a.transactionType === 'income' ? 'Daromad' : 'Xarajat';
          return `${i + 1}. ${a.description} (${typeText}): ${formatUzbekMoney(a.amount, a.currency)}`;
        });
        summaryUzbek = `Quyidagi ${sanitizedActions.length} ta operatsiyani qayd etishni tasdiqlaysizmi?\n\n` + lines.join('\n');
      }
    }

    return {
      intent,
      actions: sanitizedActions,
      clarificationQuestion: parsed.clarificationQuestion || undefined,
      summaryUzbek: summaryUzbek || 'Iltimos, ma’lumotingizni tasdiqlang.',
    };
  } catch (err: unknown) {
    console.error('[ActionExtractionEngine] Extraction error:', err);
    // In case of provider error, fall back to safe clarification / query
    return {
      intent: 'financial_query',
      actions: [],
      summaryUzbek: 'Xabaringiz qabul qilindi.',
    };
  }
}

