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

export const TOO_MANY_ACTIONS_MESSAGE =
  `Bitta xabarda ko‘pi bilan ${MAX_ACTIONS_PER_MESSAGE} ta amal yozish mumkin. Iltimos, xabarni bir nechta qismga bo‘lib yuboring. 🙏`;

export const AMOUNT_TOO_LARGE_MESSAGE =
  'Summa juda katta ko‘rinadi (bitta amal uchun eng ko‘pi 1 000 000 000 so‘m yoki 100 000 dollar). Iltimos, summani tekshirib, qayta yozing.';
