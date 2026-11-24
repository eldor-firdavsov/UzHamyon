/**
 * Display currency (so'm ⇄ dollar) — pure helpers, safe in the browser and on the server.
 *
 * Every row keeps the currency it was saved in. The Mini App converts amounts into the
 * user's chosen currency at the current USD→UZS rate (Central Bank of Uzbekistan).
 */

import type { Lang } from '../i18n/config.ts';
import { somLabel } from '../i18n/format.ts';

export type DisplayCurrency = 'UZS' | 'USD';

export const DISPLAY_CURRENCIES: DisplayCurrency[] = ['UZS', 'USD'];

/** Used only when no live rate can be fetched; the UI marks it as approximate. */
export const FALLBACK_USD_UZS = 12_600;

export type FxSource = 'cbu' | 'er-api' | 'fallback';

export interface FxRate {
  /** So'm for 1 US dollar. */
  usdUzs: number;
  /** Rate date, YYYY-MM-DD. */
  date: string;
  source: FxSource;
}

export function toDisplayCurrency(value: unknown): DisplayCurrency {
  return String(value || '').trim().toUpperCase() === 'USD' ? 'USD' : 'UZS';
}

export function isValidRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 100 && rate < 1_000_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rounds to what the currency can hold: whole so'm, cents for dollars. */
export function roundFor(currency: string, n: number): number {
  return toDisplayCurrency(currency) === 'UZS' ? Math.round(n) : round2(n);
}

/**
 * Converts between so'm and dollars. Same currency → unchanged.
 * Unknown currencies (e.g. EUR) are returned unchanged: there is no rate for them.
 */
export function convertAmount(
  amount: number,
  from: string | null | undefined,
  to: string | null | undefined,
  usdUzs: number
): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const f = String(from || 'UZS').toUpperCase();
  const t = String(to || 'UZS').toUpperCase();
  if (f === t) return n;
  if (!isValidRate(usdUzs)) return n;
  if (f === 'USD' && t === 'UZS') return Math.round(n * usdUzs);
  if (f === 'UZS' && t === 'USD') return round2(n / usdUzs);
  return n;
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Absolute amount as digits: "1 250 000" (so'm), "1 250.5" → "1 250.50" (dollar).
 * Whole dollar amounts drop ".00".
 */
export function formatAmount(n: number, currency: string): string {
  const abs = Math.abs(Number(n) || 0);
  if (toDisplayCurrency(currency) === 'UZS') return groupThousands(String(Math.round(abs)));
  const fixed = round2(abs).toFixed(2);
  const [i, d] = fixed.split('.');
  return groupThousands(i) + (d === '00' ? '' : `.${d}`);
}

/** Short unit shown next to numbers. */
export function unitLabel(currency: string, lang: Lang = 'uz'): string {
  return toDisplayCurrency(currency) === 'USD' ? '$' : somLabel(lang);
}

/** "12 000 so‘m" / "$12.50" (no sign). */
export function formatWithUnit(n: number, currency: string, lang: Lang = 'uz'): string {
  return toDisplayCurrency(currency) === 'USD' ? `$${formatAmount(n, 'USD')}` : `${formatAmount(n, 'UZS')} ${somLabel(lang)}`;
}

/** Spoken name, for labels and toasts. */
export function currencyName(currency: string): string {
  return toDisplayCurrency(currency) === 'USD' ? 'dollar' : 'so‘m';
}

const USD_MARKERS = /(\$|\busd\b|dollar|dolar|доллар|бакс|\bbaks)/i;
const UZS_MARKERS = /(so['‘’ʻ`]?m\b|\bsum\b|\bсум|\bсўм|\buzs\b|\bmln\b|\bmillion|\bming\b|\bтыс|\bмлн)/i;

/**
 * Which currency the user named in a chat message, if any.
 * "ming" / "mln" are so'm words in everyday Uzbek ("50 ming" is never dollars).
 */
export function mentionedCurrency(text: string | null | undefined): DisplayCurrency | null {
  const s = String(text || '');
  if (!s.trim()) return null;
  if (USD_MARKERS.test(s)) return 'USD';
  if (UZS_MARKERS.test(s)) return 'UZS';
  return null;
}

/** "23.11.2026" → "2026-11-23"; returns '' when not a date. */
export function parseDotDate(s: string | null | undefined): string {
  const m = String(s || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
