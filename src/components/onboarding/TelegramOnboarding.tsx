'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  User,
  Loader2,
  Target,
  Compass,
  TrendingUp,
  Wallet,
  BarChart3,
  PiggyBank,
  TrendingDown,
  Search,
  Shield,
  Plane,
  Scale,
  Sprout,
  HelpCircle,
  Settings,
  PartyPopper,
} from 'lucide-react';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';
import { completeOnboardingAction } from '@/app/onboarding/actions';
import { createClient } from '@/lib/supabase/client';

interface TelegramOnboardingProps {
  initialFirstName?: string;
  onCompleted?: () => void;
}

const TELEGRAM_FINANCIAL_GOALS = [
  { id: 'track_expenses', label: 'Xarajatlarimni nazorat qilish', icon: BarChart3 },
  { id: 'save_more', label: 'Ko‘proq pul jamg‘arish', icon: PiggyBank },
  { id: 'reduce_debt', label: 'Qarzlarimni kamaytirish', icon: TrendingDown },
  { id: 'understand_flow', label: 'Pulim qayerga ketayotganini tushunish', icon: Search },
  { id: 'emergency_fund', label: 'Favqulodda vaziyatlar uchun zaxira yaratish', icon: Shield },
  { id: 'big_purchase', label: 'Katta xarid yoki safar uchun pul yig‘ish', icon: Plane },
  { id: 'balance_flow', label: 'Daromad va xarajatlarimni muvozanatlash', icon: Scale },
  { id: 'better_habits', label: 'Moliyaviy odatlarimni yaxshilash', icon: Sprout },
];

export default function TelegramOnboarding({
  initialFirstName = '',
  onCompleted,
}: TelegramOnboardingProps) {
  const [step, setStep] = useState<number>(1);
  const [preferredName, setPreferredName] = useState<string>(initialFirstName || '');
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['track_expenses', 'save_more']);
  const [noSpecificGoal, setNoSpecificGoal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleGoal = (id: string) => {
    if (noSpecificGoal) setNoSpecificGoal(false);
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectNoSpecificGoal = () => {
    setNoSpecificGoal(true);
    setSelectedGoals([]);
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const goalsToSave = noSpecificGoal ? ['no_specific_goal'] : selectedGoals;

    try {
      const res = await completeOnboardingAction({
        first_name: preferredName.trim() || initialFirstName || 'Foydalanuvchi',
        declared_monthly_income: 0,
        declared_monthly_expenses: 0,
        goals: goalsToSave,
        custom_goal: '',
        category_expenses: {},
      });

      if (!res.success) {
        // Fallback: update profile directly via client if server session cookie hadn't arrived
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('onboarding_data')
            .eq('id', user.id)
            .maybeSingle();
          const existingData =
            (existingProfile?.onboarding_data as Record<string, unknown> | null) || {};

          const { error: clientErr } = await supabase
            .from('profiles')
            .update({
              first_name: preferredName.trim() || initialFirstName || 'Foydalanuvchi',
              onboarding_completed: true,
              onboarding_step: 8,
              onboarding_data: {
                ...existingData,
                goals: goalsToSave,
                completed_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (clientErr) {
            setErrorMsg(res.error || clientErr.message);
            setIsSubmitting(false);
            return;
          }
        } else {
          setErrorMsg(res.error || 'Saqlashda xatolik yuz berdi');
          setIsSubmitting(false);
          return;
        }
      }

      if (onCompleted) {
        onCompleted();
      } else {
        window.location.replace('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kutilmagan xatolik';
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F5] text-[#171B16] flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto w-full antialiased">
      {/* Header with Logo and Progress Dots */}
      <header className="pt-2 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UzHamyonLogo variant="icon" size="sm" />
          <span className="font-extrabold text-base text-[#171B16] tracking-tight">UzHamyon</span>
        </div>

        {/* 5-step progress pill */}
        <div className="flex items-center gap-1.5 bg-white border border-[#E8EBE5] px-2.5 py-1 rounded-full shadow-2xs">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-5 bg-[#163300]'
                  : s < step
                  ? 'w-2 bg-[#9FE870]'
                  : 'w-2 bg-[#E8EBE5]'
              }`}
            />
          ))}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center py-4">
        {/* SCREEN 1: Welcome */}
        {step === 1 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8EBE5] shadow-xs space-y-6 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shadow-2xs border border-[#9FE870]/40">
              <Sprout className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171B16]">
                Moliyaviy tartibni bugundan boshlang
              </h1>
              <p className="text-sm text-[#697168] leading-relaxed">
                UzHamyon sizga pulingizni nazorat qilish, xarajatlaringizni tushunish va maqsadlaringiz sari harakat qilishda yordam beradi.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#F0F2ED] text-xs text-[#697168]">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#26834A] shrink-0" />
                <span>Telegram orqali avtomatik xavfsiz ulanish</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#26834A] shrink-0" />
                <span>Email yoki parol kiritish talab qilinmaydi</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#26834A] shrink-0" />
                <span>Shaxsiy moliyaviy ma’lumotlar to‘liq himoyalangan</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 rounded-2xl bg-[#163300] hover:bg-[#204400] px-6 py-3 text-sm font-bold text-[#9FE870] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <span>Davom etish</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* SCREEN 2: Preferred Name */}
        {step === 2 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8EBE5] shadow-xs space-y-6 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shadow-2xs border border-[#9FE870]/40">
              <User className="w-7 h-7 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#171B16]">
                Sizga qanday murojaat qilaylik?
              </h2>
              <p className="text-xs sm:text-sm text-[#697168]">
                Telegram profilingizdagi ism kiritildi. Xohlasangiz tahrirlashingiz mumkin.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="telegram-preferred-name" className="block text-xs font-bold uppercase tracking-wider text-[#697168]">
                Ismingiz
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#959E94]" />
                <input
                  id="telegram-preferred-name"
                  type="text"
                  required
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="Ismingizni kiriting"
                  className="w-full min-h-[48px] rounded-2xl border border-[#E8EBE5] bg-white py-3 pl-10 pr-4 text-sm font-semibold text-[#171B16] placeholder-[#959E94] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/40 transition-all shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[48px] px-4 rounded-2xl border border-[#E8EBE5] bg-white text-[#697168] hover:text-[#171B16] font-bold text-sm transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!preferredName.trim()}
                className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-[#163300] hover:bg-[#204400] px-6 py-3 text-sm font-bold text-[#9FE870] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <span>Davom etish</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: Financial Goals */}
        {step === 3 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8EBE5] shadow-xs space-y-5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#171B16]">
                UzHamyon yordamida nimaga erishmoqchisiz?
              </h2>
              <p className="text-xs text-[#697168] leading-relaxed">
                O‘zingiz uchun muhim bo‘lgan maqsadlarni tanlang. Bu bizga sizga mosroq tajriba taqdim etishga yordam beradi.
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {TELEGRAM_FINANCIAL_GOALS.map((goal) => {
                const isSelected = selectedGoals.includes(goal.id);
                const GoalIcon = goal.icon;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => toggleGoal(goal.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-[#163300] bg-[#F0F9E9] text-[#163300] shadow-2xs'
                        : 'border-[#E8EBE5] bg-white text-[#171B16] hover:border-[#163300]/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                          isSelected
                            ? 'bg-[#163300] text-[#9FE870] border-[#163300]'
                            : 'bg-[#F0F9E9] text-[#163300] border-[#9FE870]/40'
                        }`}
                      >
                        <GoalIcon className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold truncate">{goal.label}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-[#163300] border-[#163300] text-[#9FE870]'
                          : 'border-[#E8EBE5] bg-white'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}

              {/* Exclusive "No specific goal" option */}
              <button
                type="button"
                onClick={handleSelectNoSpecificGoal}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  noSpecificGoal
                    ? 'border-[#163300] bg-[#F0F9E9] text-[#163300] shadow-2xs'
                    : 'border-[#E8EBE5] bg-white text-[#697168] hover:border-[#163300]/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                      noSpecificGoal
                        ? 'bg-[#163300] text-[#9FE870] border-[#163300]'
                        : 'bg-[#F7F8F5] text-[#697168] border-[#E8EBE5]'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 stroke-[2]" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold">Hozircha aniq maqsadim yo‘q</span>
                </div>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                    noSpecificGoal
                      ? 'bg-[#163300] border-[#163300] text-[#9FE870]'
                      : 'border-[#E8EBE5] bg-white'
                  }`}
                >
                  {noSpecificGoal && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[48px] px-4 rounded-2xl border border-[#E8EBE5] bg-white text-[#697168] hover:text-[#171B16] font-bold text-sm transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={selectedGoals.length === 0 && !noSpecificGoal}
                className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-[#163300] hover:bg-[#204400] px-6 py-3 text-sm font-bold text-[#9FE870] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <span>Davom etish</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 4: Optional Financial Preferences */}
        {step === 4 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8EBE5] shadow-xs space-y-6 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shadow-2xs border border-[#9FE870]/40">
              <Settings className="w-7 h-7 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#171B16]">
                Ilova parametrlari
              </h2>
              <p className="text-xs sm:text-sm text-[#697168]">
                Siz uchun standart qulay parametrlar avtomatik belgilandi. Istalgan vaqtda sozlamalardan o‘zgartirishingiz mumkin.
              </p>
            </div>

            <div className="space-y-3 divide-y divide-[#F0F2ED]">
              <div className="pt-2 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#171B16]">Asosiy valyuta</div>
                  <div className="text-[11px] text-[#697168]">O‘zbek so‘mi</div>
                </div>
                <span className="px-3 py-1 rounded-xl bg-[#163300] text-[#9FE870] font-bold text-xs">
                  UZS — So‘m
                </span>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#171B16]">Hisobot davri</div>
                  <div className="text-[11px] text-[#697168]">Har oyning 1-sanasidan</div>
                </div>
                <span className="text-xs font-semibold text-[#171B16] bg-[#F7F8F5] border border-[#E8EBE5] px-2.5 py-1 rounded-xl">
                  Oylik
                </span>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#171B16]">AI Maslahatchi</div>
                  <div className="text-[11px] text-[#697168]">UzHamyon AI modeli</div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#26834A] bg-[#EDF7F0] border border-[#26834A]/20 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Faol</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="min-h-[48px] px-4 rounded-2xl border border-[#E8EBE5] bg-white text-[#697168] hover:text-[#171B16] font-bold text-sm transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-[#163300] hover:bg-[#204400] px-6 py-3 text-sm font-bold text-[#9FE870] transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <span>Davom etish</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 5: Completion */}
        {step === 5 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8EBE5] shadow-xs space-y-6 text-center animate-in fade-in duration-200">
            <div className="w-20 h-20 rounded-3xl bg-[#F0F9E9] text-[#163300] flex items-center justify-center shadow-xs border border-[#9FE870]/50 mx-auto">
              <PartyPopper className="w-10 h-10 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171B16]">
                Hammasi tayyor!
              </h2>
              <p className="text-xs sm:text-sm text-[#697168] leading-relaxed max-w-sm mx-auto">
                Endi UzHamyon orqali daromad va xarajatlaringizni kuzatishingiz, moliyaviy holatingizni tahlil qilishingiz va maqsadlaringiz sari harakat qilishingiz mumkin.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleComplete}
              disabled={isSubmitting}
              className="w-full min-h-[50px] inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#163300] hover:bg-[#204400] px-6 py-3.5 text-sm font-bold text-[#9FE870] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#9FE870]" />
                  <span>Boshlanmoqda...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-[#9FE870]" />
                  <span>UzHamyon’ni boshlash</span>
                </>
              )}
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-2 text-[11px] text-[#959E94]">
        UzHamyon — O‘zbekiston uchun aqlli shaxsiy moliya
      </footer>
    </div>
  );
}
