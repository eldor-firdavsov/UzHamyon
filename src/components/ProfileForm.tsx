'use client';

import { useActionState } from 'react';
import { updateProfileAction } from '@/app/auth/actions';
import { type AuthActionResult } from '@/app/auth/schemas';
import { User, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Lock } from 'lucide-react';

interface ProfileFormProps {
  initialFirstName: string;
  initialLastName: string;
  email: string;
}

export default function ProfileForm({
  initialFirstName,
  initialLastName,
  email,
}: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    updateProfileAction,
    null
  );

  return (
    <form id="profile-edit-form" action={formAction} className="space-y-5">
      {state?.success && (
        <div
          id="profile-success-banner"
          className="flex items-center gap-3 rounded-2xl border border-[#9FE870]/60 bg-[#F0F9E9] p-4 text-sm text-[#163300] shadow-xs animate-in fade-in duration-200"
        >
          <div className="h-7 w-7 rounded-full bg-[#163300] text-[#9FE870] flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-[#163300]">Muvaffaqiyatli saqlandi!</div>
            <div className="text-xs text-[#2b520a]">Profil ma’lumotlaringiz yangilandi.</div>
          </div>
        </div>
      )}

      {state?.error && (
        <div
          id="profile-error-banner"
          className="flex items-center gap-3 rounded-2xl border border-[#D64D4D]/30 bg-[#FDF1F1] p-4 text-sm text-[#D64D4D] shadow-xs animate-in fade-in duration-200"
        >
          <div className="h-7 w-7 rounded-full bg-[#D64D4D] text-white flex items-center justify-center shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-[#D64D4D]">Xatolik yuz berdi</div>
            <div className="text-xs text-[#9c2424]">{state.error}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div>
          <label
            htmlFor="profile-first-name-input"
            className="block text-xs font-bold uppercase tracking-wider text-[#697168] mb-2"
          >
            Ism
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#959E94]" />
            <input
              id="profile-first-name-input"
              name="firstName"
              type="text"
              required
              defaultValue={initialFirstName}
              placeholder="Ismingizni kiriting"
              className="w-full min-h-[48px] rounded-2xl border border-[#E8EBE5] bg-white py-3 pl-10 pr-4 text-sm font-medium text-[#171B16] placeholder-[#959E94] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/40 transition-all shadow-2xs"
            />
          </div>
          {state?.fieldErrors?.firstName && (
            <p className="mt-1.5 text-xs font-semibold text-[#D64D4D] flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>{state.fieldErrors.firstName[0]}</span>
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="profile-last-name-input"
            className="block text-xs font-bold uppercase tracking-wider text-[#697168] mb-2"
          >
            Familiya
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#959E94]" />
            <input
              id="profile-last-name-input"
              name="lastName"
              type="text"
              required
              defaultValue={initialLastName}
              placeholder="Familiyangizni kiriting"
              className="w-full min-h-[48px] rounded-2xl border border-[#E8EBE5] bg-white py-3 pl-10 pr-4 text-sm font-medium text-[#171B16] placeholder-[#959E94] focus:border-[#163300] focus:outline-none focus:ring-2 focus:ring-[#9FE870]/40 transition-all shadow-2xs"
            />
          </div>
          {state?.fieldErrors?.lastName && (
            <p className="mt-1.5 text-xs font-semibold text-[#D64D4D] flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>{state.fieldErrors.lastName[0]}</span>
            </p>
          )}
        </div>

        {/* Telegram Identity — never expose the internal derived address */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="profile-email-display"
              className="block text-xs font-bold uppercase tracking-wider text-[#697168]"
            >
              Telegram hisobi
            </label>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#26834A] bg-[#EDF7F0] border border-[#26834A]/20 px-2 py-0.5 rounded-full">
              <ShieldCheck className="h-3 w-3" />
              <span>Tasdiqlangan</span>
            </span>
          </div>

          <div className="relative">
            <div className="w-full min-h-[48px] rounded-2xl border border-[#E8EBE5] bg-[#F7F8F5] py-3 pl-10 pr-10 text-sm font-medium text-[#171B16] flex items-center">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#959E94]" />
              <span>Telegram identifikatingizga bog‘langan</span>
            </div>
            <input
              id="profile-email-display"
              type="hidden"
              name="email"
              value={email}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-[#697168]">
            Kirish faqat Telegram orqali amalga oshiriladi. Alohida elektron pochta yoki parol yo‘q.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          id="profile-save-button"
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#163300] hover:bg-[#204400] px-7 py-3 text-sm font-bold text-[#9FE870] transition-all shadow-xs active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#9FE870]" />
              <span>Saqlanmoqda...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-[#9FE870]" />
              <span>Profilni saqlash</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
