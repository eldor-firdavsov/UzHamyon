/**
 * The ONE balance formula, shared by the Mini App, the AI advisor and analytics (#27):
 *
 *   balance = Σ income − Σ expense − Σ goal savings      (per currency, never mixed — #28)
 *
 * Goal savings = current_amount of every goal (whatever its status): that money is set
 * aside until the user withdraws it back to the balance.
 *
 * Pure function: no I/O, safe in the browser and on the server.
 */

export const PRIMARY_CURRENCY = 'UZS';

export interface BalanceTransactionInput {
  type: string; // 'income' | 'expense' (also accepts the Mini App's 'in' | 'ex')
  amount: number | string;
  currency?: string | null;
}

export interface BalanceGoalInput {
  current_amount?: number | string | null;
  currency?: string | null;
}

export interface CurrencyBalance {
  currency: string;
  income: number;
  expense: number;
  goalSavings: number;
  /** income − expense − goalSavings */
  balance: number;
  /** income − expense (cash flow, before setting money aside) */
  net: number;
}

export interface BalanceSummary {
  /** Always contains the primary currency (UZS), even with no data. */
  byCurrency: Record<string, CurrencyBalance>;
  primary: CurrencyBalance;
  /** Currencies other than UZS that have any data (e.g. ['USD']). */
  otherCurrencies: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeCurrency(currency?: string | null): string {
  const c = (currency || PRIMARY_CURRENCY).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : PRIMARY_CURRENCY;
}

function emptyBalance(currency: string): CurrencyBalance {
  return { currency, income: 0, expense: 0, goalSavings: 0, balance: 0, net: 0 };
}

export function computeBalances(
  transactions: BalanceTransactionInput[],
  goals: BalanceGoalInput[] = []
): BalanceSummary {
  const byCurrency: Record<string, CurrencyBalance> = {
    [PRIMARY_CURRENCY]: emptyBalance(PRIMARY_CURRENCY),
  };
  const get = (c: string) => (byCurrency[c] ??= emptyBalance(c));

  for (const t of transactions) {
    const amount = Number(t.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const bucket = get(normalizeCurrency(t.currency));
    if (t.type === 'income' || t.type === 'in') bucket.income += amount;
    else if (t.type === 'expense' || t.type === 'ex') bucket.expense += amount;
  }

  for (const g of goals) {
    const saved = Number(g.current_amount);
    if (!Number.isFinite(saved) || saved <= 0) continue;
    get(normalizeCurrency(g.currency)).goalSavings += saved;
  }

  for (const b of Object.values(byCurrency)) {
    b.income = round2(b.income);
    b.expense = round2(b.expense);
    b.goalSavings = round2(b.goalSavings);
    b.net = round2(b.income - b.expense);
    b.balance = round2(b.income - b.expense - b.goalSavings);
  }

  const otherCurrencies = Object.keys(byCurrency)
    .filter((c) => c !== PRIMARY_CURRENCY)
    .filter((c) => {
      const b = byCurrency[c];
      return b.income !== 0 || b.expense !== 0 || b.goalSavings !== 0;
    })
    .sort();

  return { byCurrency, primary: byCurrency[PRIMARY_CURRENCY], otherCurrencies };
}
