'use server';

async function getSupabase() {
  if (typeof window !== 'undefined') {
    const { createClient } = await import('@/lib/supabase/client');
    return createClient();
  }
  const { createClient } = await import('@/lib/supabase/server');
  return await createClient();
}
import {
  onboardingAccountSchema,
  completeOnboardingSchema,
  type CompleteOnboardingInput,
} from '@/lib/onboarding/schemas';

export interface OnboardingActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Creates a new Supabase auth user during onboarding Step 2.
 */
export async function createOnboardingAccountAction(
  prevState: OnboardingActionResult | null,
  formData: FormData
): Promise<OnboardingActionResult<{ email: string; userId: string; requiresVerification?: boolean }>> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const validated = onboardingAccountSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      fieldErrors: validated.error.flatten().fieldErrors,
      error: 'Iltimos, ma’lumotlarni to‘g‘ri kiriting.',
    };
  }

  const { email, password } = validated.data;

  try {
    const supabase = await getSupabase();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('already registered') ||
        msg.includes('user already exists')
      ) {
        return {
          success: false,
          error: 'Ushbu elektron pochta manziliga ega hisob allaqachon mavjud. Iltimos, kirish sahifasidan foydalaning.',
        };
      }
      if (msg.includes('rate limit') || msg.includes('too many requests')) {
        return {
          success: false,
          error: 'Juda ko‘p urinishlar qilindi. Iltimos, biroz kutib qayta urining.',
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        success: false,
        error: 'Ushbu elektron pochta manziliga ega hisob allaqachon mavjud. Iltimos, kirish sahifasidan foydalaning.',
      };
    }

    // If signUp did not auto-create a session (e.g. email verification disabled in project), try sign in
    let sessionUser = data.user;
    if (!data.session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('confirm') || msg.includes('not verified')) {
          return {
            success: true,
            data: {
              email,
              userId: data.user?.id || '',
              requiresVerification: true,
            },
          };
        }
      } else if (signInData.user) {
        sessionUser = signInData.user;
      }
    }

    const userId = sessionUser?.id || data.user?.id || '';

    // Initialize or update profile to mark onboarding as in-progress at step 3
    if (userId) {
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          onboarding_completed: false,
          onboarding_step: 3,
          updated_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();
    }

    return {
      success: true,
      data: {
        email,
        userId,
        requiresVerification: false,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in createOnboardingAccountAction:', err);
    return {
      success: false,
      error: `Hisob yaratishda xatolik yuz berdi: ${errorMsg}`,
    };
  }
}

/**
 * Retrieves the current user's onboarding state from their profile
 */
export async function getOnboardingStateAction(): Promise<
  OnboardingActionResult<{
    userId: string;
    email: string;
    firstName: string;
    onboardingStep: number;
    onboardingCompleted: boolean;
    onboardingData: Record<string, unknown> | null;
    declaredMonthlyIncome: number;
    declaredMonthlyExpenses: number;
  }>
> {
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Avtorizatsiyadan o‘tish talab qilinadi' };
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr) {
      return { success: false, error: profErr.message };
    }

    const meta = user.user_metadata || {};
    const firstName = profile?.first_name || meta.first_name || '';
    const onboardingStep = profile?.onboarding_step || 1;
    const onboardingCompleted = profile?.onboarding_completed ?? false;
    const onboardingData = (profile?.onboarding_data as Record<string, unknown>) || null;
    const declaredMonthlyIncome = Number(profile?.declared_monthly_income) || 0;
    const declaredMonthlyExpenses = Number(profile?.declared_monthly_expenses) || 0;

    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email || '',
        firstName,
        onboardingStep,
        onboardingCompleted,
        onboardingData,
        declaredMonthlyIncome,
        declaredMonthlyExpenses,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Holatni yuklashda xatolik yuz berdi';
    return { success: false, error: msg };
  }
}

/**
 * Saves draft progress (step index and current form state) to profiles
 */
export async function saveOnboardingStepAction(
  step: number,
  draftData: Record<string, unknown>
): Promise<OnboardingActionResult> {
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Avtorizatsiyadan o‘tish talab qilinadi' };
    }

    const updatePayload: Record<string, unknown> = {
      onboarding_step: step,
      onboarding_data: draftData,
      updated_at: new Date().toISOString(),
    };

    if (typeof draftData.first_name === 'string' && draftData.first_name.trim()) {
      updatePayload.first_name = draftData.first_name.trim();
    }
    if (typeof draftData.declared_monthly_income === 'number') {
      updatePayload.declared_monthly_income = draftData.declared_monthly_income;
    }
    if (typeof draftData.declared_monthly_expenses === 'number') {
      updatePayload.declared_monthly_expenses = draftData.declared_monthly_expenses;
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Jarayonni saqlashda xatolik';
    return { success: false, error: msg };
  }
}

/**
 * Completes onboarding:
 * - Updates user profile with first_name, declared_monthly_income, declared_monthly_expenses, target_monthly_expenses
 * - Stores goals and category estimates inside profile.onboarding_data
 * - Sets onboarding_completed: true
 * - CRITICAL: Never inserts mock transactions or fake goals into financial_goals or transactions.
 */
export async function completeOnboardingAction(
  rawInput: CompleteOnboardingInput
): Promise<OnboardingActionResult> {
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Avtorizatsiyadan o‘tish talab qilinadi' };
    }

    const validated = completeOnboardingSchema.safeParse(rawInput);
    if (!validated.success) {
      const err = validated.error.issues?.[0]?.message || 'Kiritilgan ma’lumotlarda xatolik bor';
      return { success: false, error: err };
    }

    const {
      first_name,
      declared_monthly_income,
      declared_monthly_expenses,
      goals,
      custom_goal,
      category_expenses,
    } = validated.data;

    // 1. Fetch existing profile to preserve existing financial_start_date if present
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('financial_start_date')
      .eq('id', user.id)
      .maybeSingle();

    const todayDateStr = new Date().toISOString().split('T')[0];
    const effectiveFinancialStartDate = existingProfile?.financial_start_date || todayDateStr;

    // 2. Persist to profiles table.
    // Financial estimates and intentions stay strictly in profile and onboarding_data.
    const { error: profileUpdateErr } = await supabase
      .from('profiles')
      .update({
        first_name,
        declared_monthly_income,
        declared_monthly_expenses,
        target_monthly_expenses: declared_monthly_expenses,
        financial_start_date: effectiveFinancialStartDate,
        onboarding_completed: true,
        onboarding_step: 8,
        onboarding_data: {
          goals,
          custom_goal: custom_goal || null,
          category_expenses,
          completed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileUpdateErr) {
      return {
        success: false,
        error: `Profilni yangilashda xatolik: ${profileUpdateErr.message}`,
      };
    }

    // 3. Also update auth user metadata if first_name changed
    await supabase.auth.updateUser({
      data: {
        first_name,
      },
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ro‘yxatdan o‘tishni yakunlashda xatolik yuz berdi';
    return { success: false, error: msg };
  }
}
