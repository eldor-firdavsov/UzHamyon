/**
 * USD → UZS exchange rate for the display-currency switch.
 *
 * 1. Central Bank of Uzbekistan (official daily rate)
 * 2. open.er-api.com (free, no key) if the CBU is unreachable
 * 3. FALLBACK_USD_UZS, marked source 'fallback' so the UI can say "taxminiy"
 *
 * Cached in memory per server instance for an hour; a failed lookup is retried after 5 minutes.
 */
import { FALLBACK_USD_UZS, isValidRate, parseDotDate, type FxRate } from './currency.ts';
import { todayTashkent } from '../time/tashkent.ts';

const CBU_URL = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/';
const ER_API_URL = 'https://open.er-api.com/v6/latest/USD';
const TTL_MS = 60 * 60 * 1000;
const FAILED_TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 2500;

let cached: { rate: FxRate; expiresAt: number } | null = null;
let inflight: Promise<FxRate> | null = null;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fromCbu(): Promise<FxRate> {
  const data = (await getJson(CBU_URL)) as Array<{ Ccy?: string; Rate?: string; Nominal?: string; Date?: string }>;
  const row = Array.isArray(data) ? data.find((r) => r?.Ccy === 'USD') : null;
  const rate = Number(row?.Rate) / (Number(row?.Nominal) || 1);
  if (!isValidRate(rate)) throw new Error('CBU: no USD rate');
  return { usdUzs: rate, date: parseDotDate(row?.Date) || todayTashkent(), source: 'cbu' };
}

async function fromErApi(): Promise<FxRate> {
  const data = (await getJson(ER_API_URL)) as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
  const rate = Number(data?.rates?.UZS);
  if (data?.result !== 'success' || !isValidRate(rate)) throw new Error('er-api: no UZS rate');
  const date = data.time_last_update_unix
    ? new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10)
    : todayTashkent();
  return { usdUzs: Math.round(rate * 100) / 100, date, source: 'er-api' };
}

function fallbackRate(): FxRate {
  const env = Number(process.env.FX_USD_UZS_FALLBACK);
  return { usdUzs: isValidRate(env) ? env : FALLBACK_USD_UZS, date: todayTashkent(), source: 'fallback' };
}

async function lookup(): Promise<FxRate> {
  for (const source of [fromCbu, fromErApi]) {
    try {
      return await source();
    } catch (err) {
      console.warn('[fx] rate source failed:', err instanceof Error ? err.message : err);
    }
  }
  return fallbackRate();
}

/** Current USD → UZS rate. Never throws. */
export async function getUsdUzsRate(): Promise<FxRate> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.rate;
  inflight ??= lookup()
    .then((rate) => {
      cached = { rate, expiresAt: Date.now() + (rate.source === 'fallback' ? FAILED_TTL_MS : TTL_MS) };
      return rate;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Test hook. */
export function __resetFxCache(): void {
  cached = null;
  inflight = null;
}
