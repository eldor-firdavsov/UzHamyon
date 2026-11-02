import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import TelegramOnboarding from '@/components/onboarding/TelegramOnboarding';
import { createClient } from '@/lib/supabase/client';

export default function OnboardingPage() {
  const [searchParams] = useSearchParams();
  const isTgParam = searchParams.get('tg') === '1';

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [initialFirstName, setInitialFirstName] = useState('');
  const [initialStep, setInitialStep] = useState(1);
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);
  const [initialIncome, setInitialIncome] = useState(0);
  const [initialExpenses, setInitialExpenses] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isTelegramUser, setIsTelegramUser] = useState(isTgParam);

  useEffect(() => {
    async function loadUserState() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setCurrentUser({ id: user.id, email: user.email || '' });
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.onboarding_completed) {
            setOnboardingCompleted(true);
          }

          const meta = user.user_metadata || {};
          const obData = (profile?.onboarding_data as Record<string, unknown>) || null;
          if (isTgParam || obData?.is_telegram || meta?.telegram_id) {
            setIsTelegramUser(true);
          }

          setInitialFirstName(profile?.first_name || meta.first_name || '');
          setInitialStep(Math.min(7, Math.max(1, profile?.onboarding_step || 1)));
          setInitialData(obData);
          setInitialIncome(Number(profile?.declared_monthly_income) || 0);
          setInitialExpenses(Number(profile?.declared_monthly_expenses) || 0);
        }
      } catch (err) {
        console.warn('Error loading onboarding state:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserState();
  }, [isTgParam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8F5] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#163300] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (onboardingCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isTelegramUser) {
    return (
      <TelegramOnboarding
        initialFirstName={initialFirstName}
        onCompleted={() => window.location.replace('/dashboard')}
      />
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-[#F7F8F5] text-[#171B16] flex flex-col justify-center items-center px-3 sm:px-4 py-4 sm:py-8 antialiased">
      <main className="w-full max-w-lg">
        <OnboardingWizard
          currentUser={currentUser}
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
