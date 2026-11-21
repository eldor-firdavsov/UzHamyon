'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  Flame,
  Loader2,
  PiggyBank,
  Plane,
  Scale,
  Search,
  Shield,
  Sparkles,
  Sprout,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { completeOnboardingAction } from '@/app/onboarding/actions';
import { createClient } from '@/lib/supabase/client';

interface TelegramOnboardingProps {
  initialFirstName?: string;
  onCompleted?: () => void;
}

const TELEGRAM_FINANCIAL_GOALS = [
  { id: 'track_expenses', label: 'Xarajatni kuzatish', icon: BarChart3 },
  { id: 'save_more', label: 'Pul jamg‘arish', icon: PiggyBank },
  { id: 'reduce_debt', label: 'Qarzdan chiqish', icon: TrendingDown },
  { id: 'understand_flow', label: 'Pul qayerga ketadi', icon: Search },
  { id: 'emergency_fund', label: 'Zaxira yig‘ish', icon: Shield },
  { id: 'big_purchase', label: 'Katta xarid, safar', icon: Plane },
  { id: 'balance_flow', label: 'Kirim-chiqim muvozanati', icon: Scale },
  { id: 'better_habits', label: 'Yaxshi odatlar', icon: Sprout },
];

/** Re-creates the session from Telegram initData. True when a fresh session was set. */
async function reauthWithTelegram(): Promise<boolean> {
  try {
    const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : undefined;
    if (!initData) return false;
    const r = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ initData }),
    });
    const data = await r.json().catch(() => null);
    if (!data?.success || !data.session) return false;
    await createClient().auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    return true;
  } catch {
    return false;
  }
}

export default function TelegramOnboarding({
  initialFirstName = '',
  onCompleted,
}: TelegramOnboardingProps) {
  const [step, setStep] = useState<number>(1);
  const [preferredName, setPreferredName] = useState<string>(initialFirstName || '');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const go = (next: number) => {
    setDir(next > step ? 'fwd' : 'back');
    setStep(next);
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const goalsToSave = selectedGoals.length ? selectedGoals : ['no_specific_goal'];

    try {
      const input = {
        first_name: preferredName.trim() || initialFirstName || 'Foydalanuvchi',
        declared_monthly_income: 0,
        declared_monthly_expenses: 0,
        goals: goalsToSave,
        custom_goal: '',
        category_expenses: {},
      };
      let res = await completeOnboardingAction(input);

      // Inside Telegram the login cookies are sometimes gone by the last step (iOS WebView).
      // Log in again with Telegram's own initData, then retry once.
      if (!res.success && (await reauthWithTelegram())) {
        res = await completeOnboardingAction(input);
      }

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
        // Straight into quick add: the first expense is the step that keeps people.
        window.location.replace('/dashboard?sheet=tx&first=1');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kutilmagan xatolik';
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  const fromTelegram = !!initialFirstName && preferredName === initialFirstName;

  return (
    <div className="uz-ob" data-step={step}>
      {step > 1 && (
        <header className="uz-ob-top">
          <button type="button" className="uz-ob-back" aria-label="Orqaga" onClick={() => go(step - 1)} disabled={isSubmitting}>
            <ChevronLeft size={24} strokeWidth={2.4} />
          </button>
          <div className="uz-ob-dots" aria-label={`${step - 1}-qadam, jami 2`}>
            <i data-on={step >= 2} />
            <i data-on={step >= 3} />
          </div>
          <span style={{ width: 44 }} aria-hidden="true" />
        </header>
      )}

      <main key={step} className="uz-ob-step" data-dir={dir}>
        {step === 1 && (
          <>
            <div className="uz-ob-hero">
              <span className="uz-ob-mark" aria-hidden="true">
                <span />
              </span>
              <h1>Pulingiz nazoratda</h1>
              <p>Har kuni bir necha soniya.</p>
            </div>
            <ul className="uz-ob-feats">
              <li><span><Zap size={20} strokeWidth={2.4} /></span>Bir bosishda yozing</li>
              <li><span><Flame size={20} strokeWidth={2.4} /></span>Har kuni seriyani o‘stiring</li>
              <li><span><Sparkles size={20} strokeWidth={2.4} /></span>AI qisqa maslahat beradi</li>
            </ul>
            <div className="uz-ob-foot">
              <button type="button" className="uz-ob-cta" data-tone="lime" onClick={() => go(2)}>
                Boshlash <ArrowRight size={20} strokeWidth={2.6} />
              </button>
              <p className="uz-ob-note">Telegram orqali kirasiz — parol kerak emas</p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="uz-ob-title">
              <h1>Ismingiz?</h1>
              <p>{fromTelegram ? 'Telegramdan olindi. O‘zgartirish mumkin.' : 'Shunday murojaat qilamiz.'}</p>
            </div>
            <input
              className="uz-ob-input uz-big-input"
              value={preferredName}
              maxLength={40}
              autoComplete="given-name"
              aria-label="Ismingiz"
              placeholder="Ism"
              onChange={(e) => setPreferredName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && preferredName.trim() && go(3)}
            />
            <div className="uz-ob-foot">
              <button type="button" className="uz-ob-cta" onClick={() => go(3)} disabled={!preferredName.trim()}>
                Davom etish
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="uz-ob-title">
              <h1>Nima uchun kerak?</h1>
              <p>Ixtiyoriy. Bir nechtasini tanlang.</p>
            </div>
            <div className="uz-ob-goals">
              {TELEGRAM_FINANCIAL_GOALS.map((goal, i) => {
                const on = selectedGoals.includes(goal.id);
                const Icon = goal.icon;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    className="uz-ob-goal"
                    aria-pressed={on}
                    style={{ animationDelay: `${60 + i * 35}ms` }}
                    onClick={() => toggleGoal(goal.id)}
                    disabled={isSubmitting}
                  >
                    <span className="uz-ob-goal-ic"><Icon size={22} strokeWidth={2.2} /></span>
                    <span className="uz-ob-goal-tx">{goal.label}</span>
                    <span className="uz-ob-goal-ck" aria-hidden="true">{on && <Check size={14} strokeWidth={3.2} />}</span>
                  </button>
                );
              })}
            </div>
            <div className="uz-ob-foot">
              {errorMsg && <div className="uz-qa-error" role="alert">{errorMsg}</div>}
              <button type="button" className="uz-ob-cta" onClick={handleComplete} disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 size={20} className="animate-spin" /> Tayyorlanmoqda…</>
                ) : (
                  'Boshlash'
                )}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
