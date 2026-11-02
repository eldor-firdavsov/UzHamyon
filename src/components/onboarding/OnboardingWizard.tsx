'use client';

import React, { useState } from 'react';

import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle,
  Car,
  Home,
  PiggyBank,
  TrendingDown,
  Compass,
  ShieldCheck,
  Target,
  Utensils,
  Zap,
  Wifi,
  HeartPulse,
  GraduationCap,
  Film,
  ShoppingBag,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Sparkles,
} from 'lucide-react';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';
import CurrencyInput, { formatWithSpaces } from './CurrencyInput';
import {
  saveOnboardingStepAction,
  completeOnboardingAction,
  createOnboardingAccountAction,
} from '@/app/onboarding/actions';
import {
  ONBOARDING_GOAL_OPTIONS,
  ONBOARDING_EXPENSE_CATEGORIES,
} from '@/lib/onboarding/schemas';

interface OnboardingWizardProps {
  currentUser?: { id: string; email: string } | null;
  initialFirstName?: string;
  initialStep?: number;
  initialData?: Record<string, unknown> | null;
  initialIncome?: number;
  initialExpenses?: number;
}

export default function OnboardingWizard({
  currentUser = null,
  initialFirstName = '',
  initialStep = 1,
  initialData = null,
  initialIncome = 0,
  initialExpenses = 0,
}: OnboardingWizardProps) {


  // If user already authenticated, minimum step is 1, but if step 1 is requested, they can view Welcome
  const [step, setStep] = useState<number>(() => {
    if (initialStep >= 1 && initialStep <= 7) return initialStep;
    return currentUser ? 3 : 1;
  });

  const [user, setUser] = useState<{ id: string; email: string } | null>(currentUser);

  // Step 2 (Account Creation) State
  const [accountEmail, setAccountEmail] = useState<string>(currentUser?.email || '');
  const [accountPassword, setAccountPassword] = useState<string>('');
  const [accountConfirmPassword, setAccountConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});
  const [isCreatingAccount, setIsCreatingAccount] = useState<boolean>(false);
  const [verificationPending, setVerificationPending] = useState<boolean>(false);

  // Step 3 (User Name) State
  const [firstName, setFirstName] = useState<string>(
    initialFirstName || (initialData?.first_name as string) || ''
  );

  // Step 4 (Financial Goals) State
  const [selectedGoals, setSelectedGoals] = useState<string[]>(() => {
    if (Array.isArray(initialData?.goals)) return initialData.goals as string[];
    if (Array.isArray(initialData?.selected_goal_keys)) return initialData.selected_goal_keys as string[];
    return ['savings'];
  });
  const [customGoal, setCustomGoal] = useState<string>(
    (initialData?.custom_goal as string) || ''
  );

  // Step 5 (Monthly Income) State
  const [monthlyIncome, setMonthlyIncome] = useState<number>(
    initialIncome || Number(initialData?.declared_monthly_income) || 0
  );

  // Step 6 (Monthly Expenses) State
  const [categoryExpenses, setCategoryExpenses] = useState<Record<string, number>>(() => {
    const saved = initialData?.category_expenses as Record<string, number> | undefined;
    if (saved && typeof saved === 'object') return saved;
    const defaults: Record<string, number> = {};
    ONBOARDING_EXPENSE_CATEGORIES.forEach((c) => {
      defaults[c.id] = c.defaultAmount;
    });
    return defaults;
  });

  // Global action status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Calculated totals
  const totalExpenses = Object.values(categoryExpenses).reduce((acc, val) => acc + (val || 0), 0);
  const potentialSavings = monthlyIncome - totalExpenses;

  // Background draft sync
  const persistDraft = async (nextStep: number, extraData?: Record<string, unknown>) => {
    if (!user) return;
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName,
        declared_monthly_income: monthlyIncome,
        declared_monthly_expenses: totalExpenses,
        goals: selectedGoals,
        custom_goal: customGoal,
        category_expenses: categoryExpenses,
        ...extraData,
      };
      await saveOnboardingStepAction(nextStep, payload);
    } catch {
      // Draft save error should not block UI flow
    }
  };

  // Step Navigation Handlers
  const handleWelcomeNext = () => {
    setGeneralError(null);
    if (user) {
      setStep(3);
      persistDraft(3);
    } else {
      setStep(2);
    }
  };

  const handleAccountCreationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setAccountErrors({});

    const errors: Record<string, string> = {};
    if (!accountEmail.trim() || !accountEmail.includes('@')) {
      errors.email = 'Haqiqiy elektron pochta manzilini kiriting';
    }
    if (!accountPassword || accountPassword.length < 8) {
      errors.password = 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak';
    }
    if (accountPassword !== accountConfirmPassword) {
      errors.confirmPassword = 'Kiritilgan parollar bir-biriga mos kelmadi';
    }

    if (Object.keys(errors).length > 0) {
      setAccountErrors(errors);
      return;
    }

    setIsCreatingAccount(true);
    try {
      const formData = new FormData();
      formData.set('email', accountEmail.trim());
      formData.set('password', accountPassword);
      formData.set('confirmPassword', accountConfirmPassword);

      const res = await createOnboardingAccountAction(null, formData);

      if (!res.success) {
        if (res.fieldErrors) {
          const mapped: Record<string, string> = {};
          Object.entries(res.fieldErrors).forEach(([k, msgs]) => {
            if (msgs?.[0]) mapped[k] = msgs[0];
          });
          setAccountErrors(mapped);
        }
        setGeneralError(res.error || 'Hisob yaratishda xatolik yuz berdi');
        setIsCreatingAccount(false);
        return;
      }

      if (res.data?.requiresVerification) {
        setVerificationPending(true);
        setIsCreatingAccount(false);
        return;
      }

      if (res.data?.userId) {
        setUser({ id: res.data.userId, email: res.data.email });
      }

      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kutilmagan xatolik yuz berdi';
      setGeneralError(msg);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleNameNext = () => {
    setGeneralError(null);
    if (!firstName.trim()) {
      setGeneralError('Iltimos, ismingizni kiriting');
      return;
    }
    const next = 4;
    setStep(next);
    persistDraft(next, { first_name: firstName.trim() });
  };

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) => {
      if (prev.includes(goalId)) {
        // Prevent deselecting if it's the only one
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== goalId);
      }
      return [...prev, goalId];
    });
  };

  const handleGoalsNext = () => {
    setGeneralError(null);
    if (selectedGoals.length === 0) {
      setGeneralError('Kamida bitta maqsadni tanlang');
      return;
    }
    const next = 5;
    setStep(next);
    persistDraft(next, { goals: selectedGoals, custom_goal: customGoal });
  };

  const handleIncomeNext = () => {
    setGeneralError(null);
    if (monthlyIncome < 0) {
      setGeneralError('Daromad manfiy bo‘lishi mumkin emas');
      return;
    }
    const next = 6;
    setStep(next);
    persistDraft(next, { declared_monthly_income: monthlyIncome });
  };

  const handleCategoryAmountChange = (catId: string, val: number) => {
    setCategoryExpenses((prev) => ({
      ...prev,
      [catId]: Math.max(0, val),
    }));
  };

  const handleExpensesNext = () => {
    setGeneralError(null);
    const next = 7;
    setStep(next);
    persistDraft(next, {
      declared_monthly_expenses: totalExpenses,
      category_expenses: categoryExpenses,
    });
  };

  const handleCompleteOnboarding = async () => {
    setGeneralError(null);
    setIsSubmitting(true);

    try {
      const res = await completeOnboardingAction({
        first_name: firstName.trim() || 'Foydalanuvchi',
        declared_monthly_income: monthlyIncome,
        declared_monthly_expenses: totalExpenses,
        goals: selectedGoals,
        custom_goal: customGoal.trim() || null,
        category_expenses: categoryExpenses,
      });

      if (!res.success) {
        setGeneralError(res.error || 'Ma’lumotlarni saqlashda xatolik yuz berdi');
        setIsSubmitting(false);
        return;
      }

      // Hard navigation to dashboard so all server components reload fresh
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Jarayonni yakunlashda xatolik yuz berdi';
      setGeneralError(msg);
      setIsSubmitting(false);
    }
  };

  // Back button navigation
  const handleBack = () => {
    setGeneralError(null);
    if (step <= 1) return;
    if (step === 3 && user && !accountPassword) {
      // If user came into onboarding already authenticated, jumping back from step 3 goes to step 1
      setStep(1);
      return;
    }
    setStep((prev) => prev - 1);
  };

  // Helper icon renderer for goals
  const renderGoalIcon = (iconName: string) => {
    switch (iconName) {
      case 'Car':
        return <Car className="w-5 h-5" />;
      case 'Home':
        return <Home className="w-5 h-5" />;
      case 'PiggyBank':
        return <PiggyBank className="w-5 h-5" />;
      case 'TrendingDown':
        return <TrendingDown className="w-5 h-5" />;
      case 'Compass':
        return <Compass className="w-5 h-5" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5" />;
      case 'CheckCircle':
        return <CheckCircle className="w-5 h-5" />;
      case 'Target':
      default:
        return <Target className="w-5 h-5" />;
    }
  };

  // Helper icon renderer for categories
  const renderCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Home':
        return <Home className="w-4 h-4 text-[#163300]" />;
      case 'Utensils':
        return <Utensils className="w-4 h-4 text-[#163300]" />;
      case 'Car':
        return <Car className="w-4 h-4 text-[#163300]" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-[#163300]" />;
      case 'Wifi':
        return <Wifi className="w-4 h-4 text-[#163300]" />;
      case 'HeartPulse':
        return <HeartPulse className="w-4 h-4 text-[#163300]" />;
      case 'GraduationCap':
        return <GraduationCap className="w-4 h-4 text-[#163300]" />;
      case 'Film':
        return <Film className="w-4 h-4 text-[#163300]" />;
      case 'ShoppingBag':
        return <ShoppingBag className="w-4 h-4 text-[#163300]" />;
      case 'MoreHorizontal':
      default:
        return <MoreHorizontal className="w-4 h-4 text-[#163300]" />;
    }
  };

  return (
    <div className="w-full">
      {/* Onboarding Shell Card */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8 relative">
        {/* Top Header: Back Button & Step Indicator */}
        <div className="flex items-center justify-between mb-6 min-h-[36px]">
          {step > 1 ? (
            <button
              id="onboarding-back-button"
              type="button"
              onClick={handleBack}
              disabled={isSubmitting || isCreatingAccount}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors p-1.5 -ml-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163300]/20"
              aria-label="Orqaga qaytish"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Orqaga</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <UzHamyonLogo variant="icon" size="sm" />
              <span className="font-semibold text-sm tracking-tight text-[#163300]">UzHamyon</span>
            </div>
          )}

          {step > 1 && (
            <div className="flex items-center gap-2">
              <span
                id="onboarding-step-indicator"
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EBEEE8] text-[#163300]"
              >
                {step} / 7
              </span>
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {generalError && (
          <div
            id="onboarding-error-banner"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-[#DC2626] animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] mt-0.5" />
            <span className="font-medium leading-relaxed">{generalError}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1 — WELCOME SCREEN                                                   */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div id="onboarding-step-1" className="text-center py-4 space-y-6">
            <div className="flex justify-center mb-2">
              <UzHamyonLogo variant="full" size="lg" />
            </div>

            <div className="space-y-3 max-w-md mx-auto">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#163300] leading-snug">
                Xarajatlaringizni nazorat qiling. Ko‘proq pul jamg‘aring.
              </h1>
              <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
                Pul qayerga ketayotganini tushuning, moliyaviy maqsadlaringizni belgilang va jamg‘arishni boshlang.
              </p>
            </div>

            <div className="pt-4 max-w-sm mx-auto">
              <button
                id="welcome-start-button"
                type="button"
                onClick={handleWelcomeNext}
                className="w-full min-h-[52px] rounded-2xl bg-[#163300] hover:bg-[#1f4700] text-[#9FE870] font-semibold text-base flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-[#9FE870]/30"
              >
                <span>Boshlash</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2 — ACCOUNT CREATION                                                 */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div id="onboarding-step-2" className="space-y-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#163300]">
                Hisobingizni yarating
              </h2>
              <p className="text-xs sm:text-sm text-[#52525B]">
                UzHamyon hisobini oching va moliyaviy ma’lumotlaringiz xavfsiz saqlansin.
              </p>
            </div>

            {user ? (
              <div className="rounded-2xl border border-[#D8DED3] bg-[#F8F9FA] p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#163300] text-[#9FE870] flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <p className="text-xs text-[#52525B] font-medium">Siz tizimga kirdingiz</p>
                    <p className="text-sm font-semibold text-[#18181B]">{user.email}</p>
                  </div>
                </div>
                <button
                  id="account-logged-in-continue-button"
                  type="button"
                  onClick={() => {
                    setStep(3);
                    persistDraft(3);
                  }}
                  className="w-full min-h-[48px] rounded-xl bg-[#163300] hover:bg-[#1f4700] text-[#9FE870] font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <span>Davom etish</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : verificationPending ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3 text-center">
                <Mail className="w-8 h-8 text-emerald-600 mx-auto" />
                <h3 className="text-base font-semibold text-emerald-900">
                  Pochtani tasdiqlash xabari yuborildi
                </h3>
                <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
                  <strong>{accountEmail}</strong> manziliga tasdiqlash havolasi yuborildi. Iltimos, pochtangizni tekshirib havolani bosing va qayta kiring.
                </p>
                <div className="pt-2">
                  <a
                    href="/login"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#163300] text-[#9FE870] text-xs font-semibold"
                  >
                    Kirish sahifasiga o‘tish
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAccountCreationSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="onboarding-email"
                    className="block text-xs sm:text-sm font-medium text-[#18181B] mb-1.5"
                  >
                    Elektron pochta manzili
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                    <input
                      id="onboarding-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      placeholder="siz@example.com"
                      className="w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#18181B] placeholder-[#71717A] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#163300]/15 transition-all"
                    />
                  </div>
                  {accountErrors.email && (
                    <p className="mt-1 text-xs text-[#DC2626] font-medium">{accountErrors.email}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="onboarding-password"
                    className="block text-xs sm:text-sm font-medium text-[#18181B] mb-1.5"
                  >
                    Parol
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                    <input
                      id="onboarding-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="Kamida 8 ta belgi"
                      className="w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-11 text-sm text-[#18181B] placeholder-[#71717A] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#163300]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B] p-1.5 rounded-lg focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {accountErrors.password && (
                    <p className="mt-1 text-xs text-[#DC2626] font-medium">{accountErrors.password}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="onboarding-confirm-password"
                    className="block text-xs sm:text-sm font-medium text-[#18181B] mb-1.5"
                  >
                    Parolni tasdiqlang
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                    <input
                      id="onboarding-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={accountConfirmPassword}
                      onChange={(e) => setAccountConfirmPassword(e.target.value)}
                      placeholder="Parolni qayta kiriting"
                      className="w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-11 text-sm text-[#18181B] placeholder-[#71717A] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#163300]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B] p-1.5 rounded-lg focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {accountErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-[#DC2626] font-medium">{accountErrors.confirmPassword}</p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    id="account-creation-submit-button"
                    type="submit"
                    disabled={isCreatingAccount}
                    className="w-full min-h-[48px] rounded-xl bg-[#163300] hover:bg-[#1f4700] text-[#9FE870] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingAccount ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Hisob yaratilmoqda...</span>
                      </>
                    ) : (
                      <>
                        <span>Hisob yaratish</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <p className="text-center text-xs text-[#52525B] pt-1">
                  Hisobingiz bormi?{' '}
                  <a
                    href="/login"
                    className="font-semibold text-[#163300] hover:underline"
                  >
                    Kirish
                  </a>
                </p>
              </form>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3 — USER NAME                                                        */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div id="onboarding-step-3" className="space-y-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#163300]">
                Sizni qanday chaqiraylik?
              </h2>
              <p className="text-xs sm:text-sm text-[#52525B]">
                Ismingizni kiriting. UzHamyon sizga shunday murojaat qiladi.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="user-name-input"
                  className="block text-xs sm:text-sm font-medium text-[#18181B] mb-1.5"
                >
                  Ismingiz yoki murojaat nomi
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71717A]" />
                  <input
                    id="user-name-input"
                    type="text"
                    autoFocus
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Masalan: Sardor"
                    className="w-full min-h-[50px] rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-11 pr-3.5 text-base text-[#18181B] placeholder-[#71717A] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#163300]/15 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="user-name-continue-button"
                  type="button"
                  onClick={handleNameNext}
                  className="w-full min-h-[48px] rounded-xl bg-[#163300] hover:bg-[#1f4700] text-[#9FE870] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99]"
                >
                  <span>Davom etish</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4 — FINANCIAL GOALS                                                  */}
        {/* ========================================================================= */}
        {step === 4 && (
          <div id="onboarding-step-4" className="space-y-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#163300]">
                Moliyaviy maqsadingiz nima?
              </h2>
              <p className="text-xs sm:text-sm text-[#52525B]">
                UzHamyon sizga nimaga erishishda yordam berishini tanlang.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ONBOARDING_GOAL_OPTIONS.map((g) => {
                const isSelected = selectedGoals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGoal(g.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#163300] bg-[#F3F8F2] text-[#163300] font-medium shadow-xs'
                        : 'border-[#E5E7EB] bg-white text-[#18181B] hover:border-[#D8DED3]'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#163300] text-[#9FE870]'
                          : 'bg-[#EBEEE8] text-[#163300]'
                      }`}
                    >
                      {renderGoalIcon(g.icon)}
                    </div>
                    <span className="text-xs sm:text-sm leading-snug flex-1">{g.label}</span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-[#163300] bg-[#163300] text-[#9FE870]'
                          : 'border-[#D8DED3] bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedGoals.includes('other') && (
              <div className="pt-1 animate-fadeIn">
                <label
                  htmlFor="custom-goal-input"
                  className="block text-xs font-medium text-[#52525B] mb-1.5"
                >
                  Boshqa maqsadingiz haqida qisqacha yozing
                </label>
                <input
                  id="custom-goal-input"
                  type="text"
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  placeholder="Masalan: Yangi dasturlash noutbuki xaridi"
                  className="w-full min-h-[46px] rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-sm text-[#18181B] placeholder-[#71717A] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#163300]/15"
                />
              </div>
            )}

            <div className="pt-2">
              <button
                id="goals-continue-button"
                type="button"
                onClick={handleGoalsNext}
                className="w-full min-h-[48px] rounded-xl bg-[#163300] hover:bg-[#1f4700] text-[#9FE870] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99]"
              >
                <span>Davom etish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5 — MONTHLY INCOME                                                   */}
        {/* ========================================================================= */}
        {step === 5 && (
          <div id="onboarding-step-5" className="space-y-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#163300]">
                Oylik daromadingiz qancha?
              </h2>
              <p className="text-xs sm:text-sm text-[#52525B]">
                O‘rtacha oyda qancha daromad olishingizni kiriting.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-[#18181B] mb-2">
                  Taxminiy oylik daromad miqdori
                </label>
                <CurrencyInput
                  id="monthly-income-input"
                  value={monthlyIncome}
                  onChange={setMonthlyIncome}
                  placeholder="0"
                  autoFocus
                />
              </div>

              {/* Quick Select Preset Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[5000000, 10000000, 15000000, 25000000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMonthlyIncome(preset)}
                    className="px-3 py-1.5 rounded-xl border border-[#D8DED3] bg-[#F8F9FA] hover:bg-[#EBEEE8] text-xs font-medium text-[#163300] transition-colors"
                  >
                    {formatWithSpaces(preset)} so‘m
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 text-xs text-[#52525B] leading-relaxed">
                💡 <strong>Eslatma:</strong> Bu miqdor shaxsiy moliyaviy prognoz uchun taxminiy ko‘rsatkich bo‘lib, hisobingizda real tranzaksiya yaratmaydi.
              </div>

              <div className="pt-2">
                <button
                  id="income-continue-button"
                  type="button"
                  onClick={handleIncomeNext}
                  className="w-full min-h-[48px] rounded-xl bg-[#163300] hover:bg-[#1f4700] text-[#9FE870] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99]"
                >
                  <span>Davom etish</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 6 — MONTHLY EXPENSES                                                 */}
        {/* ========================================================================= */}
        {step === 6 && (
          <div id="onboarding-step-6" className="space-y-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#163300]">
                Oylik xarajatlaringiz qancha?
              </h2>
              <p className="text-xs sm:text-sm text-[#52525B]">
                Har oy pulingiz asosan qaysi yo‘nalishlarga sarflanishini kiriting.
              </p>
            </div>

            {/* Expense Categories List */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {ONBOARDING_EXPENSE_CATEGORIES.map((c) => {
                const currentVal = categoryExpenses[c.id] || 0;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[#E5E7EB] bg-white hover:border-[#D8DED3] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#EBEEE8] flex items-center justify-center shrink-0">
                        {renderCategoryIcon(c.icon)}
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-[#18181B] truncate">
                        {c.name}
                      </span>
                    </div>

                    <div className="relative w-36 sm:w-44 shrink-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={currentVal > 0 ? formatWithSpaces(currentVal) : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/g, '');
                          handleCategoryAmountChange(c.id, raw ? parseInt(raw, 10) : 0);
                        }}
                        placeholder="0"
                        className="w-full text-right font-mono font-semibold text-xs sm:text-sm rounded-xl border border-[#D8DED3] bg-[#F8F9FA] py-2 pl-2 pr-12 text-[#18181B] focus:border-[#163300] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#163300]"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#71717A]">
                        so‘m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Running Total & Remaining Bar */}
            <div className="rounded-2xl border border-[#D8DED3] bg-[#F3F8F2] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#52525B]">
                <span>Kiritilgan oylik daromad:</span>
                <span className="font-semibold text-[#18181B]">
                  {formatWithSpaces(monthlyIncome)} so‘m
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#52525B]">
                <span>Jami taxminiy xarajat:</span>
                <span className="font-semibold text-[#18181B]">
                  {formatWithSpaces(totalExpenses)} so‘m
                </span>
              </div>
              <div className="border-t border-[#D8DED3]/60 pt-2 flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-[#163300]">Taxminiy qolgan mablag‘:</span>
                <span
                  className={`font-bold ${
                    potentialSavings > 0
                      ? 'text-[#163300]'
                      : potentialSavings === 0
                      ? 'text-[#52525B]'
                      : 'text-[#DC2626]'
                  }`}
                >
                  {formatWithSpaces(potentialSavings)} so‘m
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="expenses-continue-button"
                type="button"
                onClick={handleExpensesNext}
                className="w-full min-h-[48px] rounded-xl bg-[#163300] hover:bg-[#1f4700] text-[#9FE870] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99]"
              >
                <span>Natijalarni ko‘rish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 7 — PERSONALIZED FINANCIAL RESULTS                                   */}
        {/* ========================================================================= */}
        {step === 7 && (
          <div id="onboarding-step-7" className="space-y-5">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EBEEE8] text-[#163300] mb-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Shaxsiy moliyaviy prognoz</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#163300]">
                Moliyaviy imkoniyatlaringiz
              </h2>
            </div>

            {/* Income & Expense Summary Strip */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-3">
                <p className="text-[11px] text-[#52525B]">Oylik daromad</p>
                <p className="text-sm sm:text-base font-bold text-[#18181B] truncate">
                  {formatWithSpaces(monthlyIncome)} so‘m
                </p>
              </div>
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-3">
                <p className="text-[11px] text-[#52525B]">Oylik xarajatlar</p>
                <p className="text-sm sm:text-base font-bold text-[#18181B] truncate">
                  {formatWithSpaces(totalExpenses)} so‘m
                </p>
              </div>
            </div>

            {/* Potential Savings or Helpful Notice */}
            {potentialSavings > 0 ? (
              <div className="space-y-3.5">
                <div className="rounded-2xl bg-[#163300] text-white p-4 sm:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#9FE870] font-medium">Potensial oylik jamg‘arma</p>
                    <p className="text-xl sm:text-2xl font-bold text-white">
                      +{formatWithSpaces(potentialSavings)} so‘m
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-[#9FE870]">
                    <PiggyBank className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#71717A]">
                    Jamg‘arish istiqboli
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* 1 Month */}
                    <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-3">
                      <span className="text-[11px] font-medium text-[#71717A] block">1 oydan so‘ng</span>
                      <p className="text-sm sm:text-base font-bold text-[#18181B] mt-0.5">
                        ~{formatWithSpaces(potentialSavings * 1)} so‘m
                      </p>
                    </div>

                    {/* 3 Months */}
                    <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-3">
                      <span className="text-[11px] font-medium text-[#71717A] block">3 oydan so‘ng</span>
                      <p className="text-sm sm:text-base font-bold text-[#18181B] mt-0.5">
                        ~{formatWithSpaces(potentialSavings * 3)} so‘m
                      </p>
                    </div>

                    {/* 6 Months */}
                    <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-3">
                      <span className="text-[11px] font-medium text-[#71717A] block">6 oydan so‘ng</span>
                      <p className="text-sm sm:text-base font-bold text-[#18181B] mt-0.5">
                        ~{formatWithSpaces(potentialSavings * 6)} so‘m
                      </p>
                    </div>

                    {/* 12 Months */}
                    <div className="rounded-2xl border border-[#163300]/20 bg-[#F3F8F2] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#163300]">1 yildan so‘ng</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#163300]/10 text-[#163300]">12 oy</span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-[#163300] mt-0.5">
                        ~{formatWithSpaces(potentialSavings * 12)} so‘m
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#D8DED3] bg-[#F8F9FA] p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 text-xs sm:text-sm">
                    <h3 className="font-bold text-[#18181B]">
                      Xarajatlar daromadga teng yoki yuqori
                    </h3>
                    <p className="text-[#52525B] leading-relaxed">
                      Oylik xarajatlaringiz daromadingizdan ko‘proq yoki unga teng. UzHamyon orqali xarajatlarni optimallashtirib, jamg‘arishni boshlashingiz mumkin.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#52525B]">
                  <span>Ma’lumotlarni o‘zgartirish kerakmi?</span>
                  <button
                    type="button"
                    onClick={() => setStep(6)}
                    className="font-semibold text-[#163300] hover:underline"
                  >
                    Xarajatlarni qayta ko‘rish
                  </button>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[11px] text-[#71717A] text-center">
              * Kiritilgan ma&apos;lumotlar asosida taxminiy hisob-kitob
            </p>

            {/* Primary CTA */}
            <div className="pt-2">
              <button
                id="complete-onboarding-button"
                type="button"
                disabled={isSubmitting}
                onClick={handleCompleteOnboarding}
                className="w-full min-h-[50px] rounded-xl bg-[#163300] hover:bg-[#1f4700] text-[#9FE870] font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Dashboard yuklanmoqda...</span>
                  </>
                ) : (
                  <>
                    <span>Dashboardga o‘tish</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
