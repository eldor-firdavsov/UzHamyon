'use client';

import React, { useEffect, useState } from 'react';
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
import { useI18n } from '@/lib/i18n/client';
import { LANG_OPTIONS, langFromTelegram, type Lang } from '@/lib/i18n/config';

interface TelegramOnboardingProps {
  initialFirstName?: string;
  /** Language already saved on the profile (e.g. picked in the bot); null = not chosen yet. */
  savedLanguage?: Lang | null;
  onCompleted?: () => void;
}

const TELEGRAM_FINANCIAL_GOALS = [
  { id: 'track_expenses', icon: BarChart3 },
  { id: 'save_more', icon: PiggyBank },
  { id: 'reduce_debt', icon: TrendingDown },
  { id: 'understand_flow', icon: Search },
  { id: 'emergency_fund', icon: Shield },
  { id: 'big_purchase', icon: Plane },
  { id: 'balance_flow', icon: Scale },
  { id: 'better_habits', icon: Sprout },
] as const;

/** Screens: 0 language → 1 welcome → 2 name → 3 goals. */
const LAST_STEP = 3;

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
  savedLanguage = null,
  onCompleted,
}: TelegramOnboardingProps) {
  const { t, lang, setLang } = useI18n();
  const [step, setStep] = useState<number>(0);
  const [preferredName, setPreferredName] = useState<string>(initialFirstName || '');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');

  // Nothing chosen yet: pre-select Telegram's app language so the first screen already reads right.
  useEffect(() => {
    if (savedLanguage) return;
    const code = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (!code) return;
    const guess = langFromTelegram(code);
    if (guess !== lang) void setLang(guess, { persist: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickLanguage = (next: Lang) => {
    if (isSubmitting) return;
    void setLang(next);
  };

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
        first_name: preferredName.trim() || initialFirstName || t.common.user,
        language: lang,
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
              first_name: preferredName.trim() || initialFirstName || t.common.user,
              onboarding_completed: true,
              onboarding_step: 8,
              onboarding_data: {
                ...existingData,
                language: lang,
                goals: goalsToSave,
                completed_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (clientErr) {
            console.error('Onboarding save failed:', res.error, clientErr.message);
            setErrorMsg(lang === 'uz' ? res.error || clientErr.message : t.onboarding.saveError);
            setIsSubmitting(false);
            return;
          }
        } else {
          setErrorMsg(lang === 'uz' && res.error ? res.error : t.onboarding.saveError);
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
      console.error('Onboarding failed:', err);
      setErrorMsg(lang === 'uz' && err instanceof Error ? err.message : t.onboarding.unexpected);
      setIsSubmitting(false);
    }
  };

  const fromTelegram = !!initialFirstName && preferredName === initialFirstName;

  return (
    <div className="uz-ob" data-step={step}>
      {step > 1 && (
        <header className="uz-ob-top">
          <button type="button" className="uz-ob-back" aria-label={t.common.back} onClick={() => go(step - 1)} disabled={isSubmitting}>
            <ChevronLeft size={24} strokeWidth={2.4} />
          </button>
          <div className="uz-ob-dots" aria-label={t.onboarding.stepOf(step - 1, LAST_STEP - 1)}>
            <i data-on={step >= 2} />
            <i data-on={step >= 3} />
          </div>
          <span style={{ width: 44 }} aria-hidden="true" />
        </header>
      )}

      <main key={step} className="uz-ob-step" data-dir={dir}>
        {step === 0 && (
          <>
            <div className="uz-ob-title">
              <h1>{t.language.pickTitle}</h1>
              <p>{t.language.pickHint}</p>
            </div>
            <div className="uz-ob-langs" role="radiogroup" aria-label={t.language.title}>
              {LANG_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={lang === o.id}
                  lang={o.id}
                  className="uz-ob-lang"
                  onClick={() => pickLanguage(o.id)}
                >
                  <span className="uz-ob-lang-flag" aria-hidden="true">{o.flag}</span>
                  {o.native}
                  <span className="uz-ob-lang-ck" aria-hidden="true">{lang === o.id && <Check size={15} strokeWidth={3.2} />}</span>
                </button>
              ))}
            </div>
            <div className="uz-ob-foot">
              <button
                type="button"
                className="uz-ob-cta"
                data-tone="lime"
                onClick={() => {
                  // Save the shown language even when the pre-selected one was kept.
                  void setLang(lang);
                  go(1);
                }}
              >
                {t.language.continue} <ArrowRight size={20} strokeWidth={2.6} />
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="uz-ob-hero">
              <span className="uz-ob-mark" aria-hidden="true">
                <span />
              </span>
              <h1>{t.onboarding.heroTitle}</h1>
              <p>{t.onboarding.heroSub}</p>
            </div>
            <ul className="uz-ob-feats">
              <li><span><Zap size={20} strokeWidth={2.4} /></span>{t.onboarding.feat1}</li>
              <li><span><Flame size={20} strokeWidth={2.4} /></span>{t.onboarding.feat2}</li>
              <li><span><Sparkles size={20} strokeWidth={2.4} /></span>{t.onboarding.feat3}</li>
            </ul>
            <div className="uz-ob-foot">
              <button type="button" className="uz-ob-cta" data-tone="lime" onClick={() => go(2)}>
                {t.onboarding.start} <ArrowRight size={20} strokeWidth={2.6} />
              </button>
              <p className="uz-ob-note">{t.onboarding.noPassword}</p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="uz-ob-title">
              <h1>{t.onboarding.nameTitle}</h1>
              <p>{fromTelegram ? t.onboarding.nameFromTelegram : t.onboarding.nameHint}</p>
            </div>
            <input
              className="uz-ob-input uz-big-input"
              value={preferredName}
              maxLength={40}
              autoComplete="given-name"
              aria-label={t.onboarding.nameTitle}
              placeholder={t.onboarding.namePlaceholder}
              onChange={(e) => setPreferredName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && preferredName.trim() && go(3)}
            />
            <div className="uz-ob-foot">
              <button type="button" className="uz-ob-cta" onClick={() => go(3)} disabled={!preferredName.trim()}>
                {t.onboarding.continue}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="uz-ob-title">
              <h1>{t.onboarding.goalsTitle}</h1>
              <p>{t.onboarding.goalsHint}</p>
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
                    <span className="uz-ob-goal-tx">{t.onboarding.goals[goal.id]}</span>
                    <span className="uz-ob-goal-ck" aria-hidden="true">{on && <Check size={14} strokeWidth={3.2} />}</span>
                  </button>
                );
              })}
            </div>
            <div className="uz-ob-foot">
              {errorMsg && <div className="uz-qa-error" role="alert">{errorMsg}</div>}
              <button type="button" className="uz-ob-cta" onClick={handleComplete} disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 size={20} className="animate-spin" /> {t.onboarding.preparing}</>
                ) : (
                  t.onboarding.start
                )}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
