import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UzHamyonPrototypeApp from '@/components/prototype/UzHamyonPrototypeApp';
import { getDashboardHydrationData } from '@/lib/data/hydration';

export const metadata = {
  title: 'Bosh sahifa — UzHamyon',
  description: 'UzHamyon shaxsiy moliya boshqaruv markazi',
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fast check: uncompleted onboarding redirects immediately via HTTP 307
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profile && profile.onboarding_completed === false) {
    redirect('/onboarding');
  }

  const profileName = profile?.first_name ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}` : '';
  const metaName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || user.user_metadata?.full_name || user.user_metadata?.name || '';
  const emailPrefix = (user.email || '').split('@')[0] || '';
  const cleanEmailName = emailPrefix.replace(/[0-9_.-]/g, ' ').trim();
  const formattedEmailName = cleanEmailName ? cleanEmailName.charAt(0).toUpperCase() + cleanEmailName.slice(1).toLowerCase() : '';
  const displayName = profileName || metaName || formattedEmailName || 'Foydalanuvchi';

  // Server-side hydration data for instant zero-lag SSR
  // Server-side hydration data with resilient admin fallback for cold-start Telegram WebView
  const { initialTransactions, initialBudgets, initialGoals } = await getDashboardHydrationData(
    supabase,
    user.id
  );

  return (
    <UzHamyonPrototypeApp
      initialTab="dash"
      initialUserName={displayName}
      userEmail={user.email}
      initialTransactions={initialTransactions}
      initialBudgets={initialBudgets}
      initialGoals={initialGoals}
    />
  );
}
