/**
 * The ONE money formatter for user-facing text (bot messages, AI answers, previews) — #43.
 *
 *   formatMoney(45000)            → "45 000 so‘m"
 *   formatMoney(1250.5, 'USD')    → "1 250.50 dollar"
 *   formatMoney(1250, 'EUR')      → "1 250 EUR"
 *
 * - Thousands are separated with a normal space (never NBSP, so text matching works).
 * - so'm amounts are rounded to whole so'm; other currencies keep up to 2 decimals.
 * - "so‘m" uses U+2018, like the rest of the bot texts.
 */

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatAmountNumber(amount: number, decimals: 0 | 2): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (decimals === 0) return sign + groupThousands(String(Math.round(abs)));
  const fixed = (Math.round(abs * 100) / 100).toFixed(2);
  const [i, d] = fixed.split('.');
  return sign + groupThousands(i) + (d === '00' ? '' : `.${d}`);
}

export function formatMoney(amount: number | string | null | undefined, currency: string = 'UZS'): string {
  const n = Number(amount) || 0;
  const cur = (currency || 'UZS').toUpperCase();
  if (cur === 'UZS') return `${formatAmountNumber(n, 0)} so‘m`;
  if (cur === 'USD') return `${formatAmountNumber(n, 2)} dollar`;
  return `${formatAmountNumber(n, 2)} ${cur}`;
}
