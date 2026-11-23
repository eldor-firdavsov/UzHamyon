import { SupabaseClient } from '@supabase/supabase-js';
import { getStreakForUser } from '@/lib/streak/service';
import type { StreakSummary } from '@/lib/streak/compute';
import type { DisplayCurrency, FxRate } from '@/lib/fx/currency';
import { getUsdUzsRate } from '@/lib/fx/rates';
import { getPreferredCurrency } from '@/lib/profile/preferredCurrency';

export interface HydratedTransaction {
  id: string;
  type: 'in' | 'ex';
  amount: number;
  cat: string;
  desc: string;
  date: string;
  currency?: string;
}

export interface HydratedBudget {
  id: string;
  cat: string;
  limit: number;
  currency?: string;
}

export interface HydratedGoal {
  id: string;
  name: string;
  target: number;
  date: string;
  /** financial_goals.current_amount — the real saved amount. */
  saved: number;
  currency?: string;
  status?: string;
  /** Loaded on demand from /api/goals/:id/contributions. */
  contribs: Array<{ a: number; d: string; note?: string | null; source?: string }>;
  contribsLoaded?: boolean;
}

export interface DashboardHydrationData {
  initialTransactions: HydratedTransaction[];
  initialBudgets: HydratedBudget[];
  initialGoals: HydratedGoal[];
  /** Logging streak; null when it could not be loaded (the client fetches it then). */
  initialStreak: StreakSummary | null;
  /** Currency the user sees everything in. */
  initialCurrency: DisplayCurrency;
  /** USD → UZS rate used to convert between so'm and dollars. */
  initialFx: FxRate;
}

/**
 * Loads server-side hydration data for a user with automatic admin fallback
 * to prevent cold-start 0 balance drops when cookies are in-flight or partitioned.
 */
export async function getDashboardHydrationData(
  supabase: SupabaseClient,
  userId: string
): Promise<DashboardHydrationData> {
  const [txRes, budgetsRes, goalsRes, initialStreak, initialCurrency, initialFx] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, type, amount, currency, description, transaction_date, categories(name)')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(300),
    supabase
      .from('budgets')
      .select('id, amount, currency, categories(name)')
      .eq('user_id', userId),
    supabase
      .from('financial_goals')
      .select('id, name, target_amount, target_date, current_amount, currency, status')
      .eq('user_id', userId),
    getStreakForUser(supabase, userId).catch((err) => {
      console.error('[hydration] streak failed:', err);
      return null;
    }),
    getPreferredCurrency(supabase, userId),
    getUsdUzsRate(),
  ]);

  let rawTransactions = txRes.data || [];
  let rawBudgets = budgetsRes.data || [];
  let rawGoals = goalsRes.data || [];

  // Fallback resilience: if cookie session was refreshed mid-flight and RLS returned empty data,
  // query with authenticated userId via admin client to guarantee initial SSR data is never 0 for existing users
  if (rawTransactions.length === 0) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      try {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
        const adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const [adminTx, adminBudgets, adminGoals] = await Promise.all([
          adminClient
            .from('transactions')
            .select('id, type, amount, currency, description, transaction_date, categories(name)')
            .eq('user_id', userId)
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(300),
          adminClient
            .from('budgets')
            .select('id, amount, currency, categories(name)')
            .eq('user_id', userId),
          adminClient
            .from('financial_goals')
            .select('id, name, target_amount, target_date, current_amount, currency, status')
            .eq('user_id', userId),
        ]);
        if (adminTx.data && adminTx.data.length > 0) {
          rawTransactions = adminTx.data;
        }
        if (adminBudgets.data && adminBudgets.data.length > 0) {
          rawBudgets = adminBudgets.data;
        }
        if (adminGoals.data && adminGoals.data.length > 0) {
          rawGoals = adminGoals.data;
        }
      } catch (err) {
        console.error('Failed fallback admin hydration:', err);
      }
    }
  }

  const initialTransactions: HydratedTransaction[] = rawTransactions.map((t: any) => ({
    id: t.id,
    type: (t.type === 'income' ? 'in' : 'ex') as 'in' | 'ex',
    amount: Number(t.amount) || 0,
    cat:
      (Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name) ||
      (t.type === 'income' ? 'Boshqa daromad' : 'Boshqa'),
    desc: t.description || '',
    date: t.transaction_date || '',
    currency: t.currency || 'UZS',
  }));

  const initialBudgets: HydratedBudget[] = rawBudgets.map((b: any) => ({
    id: b.id,
    cat: Array.isArray(b.categories)
      ? b.categories[0]?.name || 'Umumiy'
      : b.categories?.name || 'Umumiy',
    limit: Number(b.amount) || 0,
    currency: b.currency || 'UZS',
  }));

  const initialGoals: HydratedGoal[] = rawGoals.map((g: any) => ({
    id: g.id,
    name: g.name,
    target: Number(g.target_amount) || 0,
    date: g.target_date || '',
    saved: Number(g.current_amount) || 0,
    currency: g.currency || 'UZS',
    status: g.status || 'in_progress',
    contribs: [],
    contribsLoaded: false,
  }));

  return { initialTransactions, initialBudgets, initialGoals, initialStreak, initialCurrency, initialFx };
}
