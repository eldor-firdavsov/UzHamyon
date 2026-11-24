import { botTexts } from '../i18n/bot.ts';

/**
 * Safety limits for AI-proposed actions (checked in extraction, the RPC and the fallback path).
 * The DB column NUMERIC(12,2) allows up to 9 999 999 999.99; these caps stay well below it.
 */
export const MAX_ACTIONS_PER_MESSAGE = 10;

export const MAX_AMOUNT_BY_CURRENCY: Record<string, number> = {
  UZS: 1_000_000_000,
  USD: 100_000,
};

export function maxAmountFor(currency: string | undefined): number {
  return MAX_AMOUNT_BY_CURRENCY[(currency || 'UZS').toUpperCase()] ?? MAX_AMOUNT_BY_CURRENCY.UZS;
}

export function isAmountWithinLimit(amount: number, currency: string | undefined): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= maxAmountFor(currency);
}

export const TOO_MANY_ACTIONS_MESSAGE = botTexts('uz').tooManyActions;

export const AMOUNT_TOO_LARGE_MESSAGE = botTexts('uz').amountTooLarge;
