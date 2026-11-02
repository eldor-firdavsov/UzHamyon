import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import TelegramOnboarding from '@/components/onboarding/TelegramOnboarding';

export const metadata = {
  title: 'Moliyaviy rejalashtirish — UzHamyon',
  description: 'UzHamyon yangi foydalanuvchi moliyaviy onboarding tajribasi',
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ tg?: string }>;
}) {
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const isTgParam = params?.tg === '1';

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is already authenticated:
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // If onboarding is already completed, returning users go directly to dashboard
    if (profile && profile.onboarding_completed === true) {
      redirect('/dashboard');
    }

    const meta = user.user_metadata || {};
    const initialFirstName = profile?.first_name || meta.first_name || '';
    const initialData = (profile?.onboarding_data as Record<string, unknown>) || null;
    const isTelegramUser = isTgParam || !!initialData?.is_telegram || !!meta?.telegram_id;

    if (isTelegramUser) {
      return <TelegramOnboarding initialFirstName={initialFirstName} />;
    }

    const initialStep = Math.min(7, Math.max(1, profile?.onboarding_step || 1));
    const initialIncome = Number(profile?.declared_monthly_income) || 0;
    const initialExpenses = Number(profile?.declared_monthly_expenses) || 0;

    return (
      <div className="min-h-screen min-h-dvh bg-[#F7F8F5] text-[#171B16] flex flex-col justify-center items-center px-3 sm:px-4 py-4 sm:py-8 antialiased">
        <main className="w-full max-w-lg">
          <OnboardingWizard
            currentUser={{ id: user.id, email: user.email || '' }}
            initialFirstName={initialFirstName}
            initialStep={initialStep}
            initialData={initialData}
            initialIncome={initialIncome}
            initialExpenses={initialExpenses}
          />
        </main>
      </div>
    );
  }

  if (isTgParam) {
    return <TelegramOnboarding initialFirstName="" />;
  }

  // Guest user starting the onboarding experience from Welcome screen
  return (
    <div className="min-h-screen min-h-dvh bg-[#F7F8F5] text-[#171B16] flex flex-col justify-center items-center px-3 sm:px-4 py-4 sm:py-8 antialiased">
      <main className="w-full max-w-lg">
        <OnboardingWizard
          currentUser={null}
          initialStep={1}
          initialFirstName=""
          initialData={null}
          initialIncome={0}
          initialExpenses={0}
        />
      </main>
    </div>
  );
}
