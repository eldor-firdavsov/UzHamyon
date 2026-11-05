'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

import {
  updateProfileSchema,
  type AuthActionResult,
} from './schemas';

/**
 * Authentication is Telegram-only.
 *
 * Users are identified and signed in exclusively through the verified Telegram
 * WebApp initData flow (`/api/auth/telegram`). Email/password registration and
 * login actions were intentionally removed so no parallel credential-based
 * authentication path can be used.
 */

export async function logoutAction(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Error during logout:', err);
  }
  redirect('/login');
}

export async function updateProfileAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
  };

  const validated = updateProfileSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      fieldErrors: validated.error.flatten().fieldErrors,
      error: 'Iltimos, quyidagi xatoliklarni to‘g‘rilang.',
    };
  }

  const { firstName, lastName } = validated.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'Profilni yangilash uchun tizimga kirgan bo‘lishingiz kerak.',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
  };
}
