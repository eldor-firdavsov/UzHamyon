import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UzHamyonPrototypeApp from '@/components/prototype/UzHamyonPrototypeApp';

export const metadata = {
  title: 'Faoliyat — UzHamyon',
  description: 'Daromad va xarajatlaringizni kuzating va boshqaring.',
};

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const profileName = profile?.first_name ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}` : '';
  const metaName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || user.user_metadata?.full_name || '';
  const emailPrefix = (user.email || '').split('@')[0] || '';
  const cleanEmailName = emailPrefix.replace(/[0-9_.-]/g, ' ').trim();
  const displayName = profileName || metaName || (cleanEmailName ? cleanEmailName.charAt(0).toUpperCase() + cleanEmailName.slice(1).toLowerCase() : 'Foydalanuvchi');

  // Server-side hydration data for instant zero-lag SSR
  const [txRes, budgetsRes, goalsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, type, amount, description, transaction_date, categories(name)')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(300),
    supabase
      .from('budgets')
      .select('id, amount, categories(name)')
      .eq('user_id', user.id),
    supabase
      .from('goals')
      .select('id, name, target_amount, target_date, current_amount')
      .eq('user_id', user.id),
  ]);

  const initialTransactions = (txRes.data || []).map((t: {
    id: string;
    type: string;
    amount: number;
    description?: string;
    transaction_date?: string;
    categories?: { name?: string } | { name?: string }[] | null;
  }) => {
    const catName = Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name;
    return {
      id: t.id,
      type: (t.type === 'income' ? 'in' : 'ex') as 'in' | 'ex',
      amount: Number(t.amount) || 0,
      cat: catName || (t.type === 'income' ? 'Maosh' : 'Boshqa'),
      desc: t.description || catName || '',
      date: t.transaction_date || '2026-11-02',
    };
  });

  const initialBudgets = (budgetsRes.data || []).map((b: {
    id: string;
    amount: number;
    categories?: { name?: string } | { name?: string }[] | null;
  }) => {
    const catName = Array.isArray(b.categories) ? b.categories[0]?.name : b.categories?.name;
    return {
      id: b.id,
      cat: catName || 'Boshqa',
      limit: Number(b.amount) || 0,
    };
  });

  const initialGoals = (goalsRes.data || []).map((g: {
    id: string;
    name: string;
    target_amount?: number;
    target_date?: string;
    current_amount?: number;
  }) => ({
    id: g.id,
    name: g.name,
    target: Number(g.target_amount) || 0,
    date: g.target_date || '',
    contribs: [{ a: Number(g.current_amount) || 0, d: '2026-11-02' }],
  }));

  return (
    <UzHamyonPrototypeApp
      initialTab="act"
      initialUserName={displayName}
      userEmail={user.email}
      initialTransactions={initialTransactions}
      initialBudgets={initialBudgets}
      initialGoals={initialGoals}
    />
  );
}
