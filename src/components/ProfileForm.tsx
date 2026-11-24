'use client';

import { useActionState, useState } from 'react';
import { updateProfileAction } from '@/app/auth/actions';
import { type AuthActionResult } from '@/app/auth/schemas';
import { Check, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

interface ProfileFormProps {
  initialFirstName: string;
  initialLastName: string;
  email: string;
}

/** Name as an inset list; the save button shows only after a change. */
export default function ProfileForm({ initialFirstName, initialLastName, email }: ProfileFormProps) {
  const { t, lang } = useI18n();
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(updateProfileAction, null);
  const [first, setFirst] = useState(initialFirstName);
  const [last, setLast] = useState(initialLastName);
  const [saved, setSaved] = useState({ first: initialFirstName, last: initialLastName });
  const [lastState, setLastState] = useState(state);

  // A successful save becomes the new baseline (render-time sync, no effect).
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setSaved({ first, last });
  }

  const dirty = first.trim() !== saved.first.trim() || last.trim() !== saved.last.trim();
  const fieldError = state?.fieldErrors?.firstName?.[0] || state?.fieldErrors?.lastName?.[0];

  const rowClass = 'flex items-center gap-3 px-4 min-h-[52px]';
  const inputClass =
    'flex-1 min-w-0 bg-transparent text-right text-[16px] text-[#111511] placeholder-[#AEB4AA] outline-none';

  return (
    <form id="profile-edit-form" action={formAction} className="flex flex-col gap-2">
      <div className="uz-m-list">
        <label className={rowClass}>
          <span className="text-[16px] font-medium w-28 shrink-0">{t.settings.firstName}</span>
          <input
            id="profile-first-name-input"
            name="firstName"
            type="text"
            required
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder={t.settings.firstName}
            className={inputClass}
          />
        </label>
        <div className="h-px bg-[#ECEFE8] ml-4" />
        <label className={rowClass}>
          <span className="text-[16px] font-medium w-28 shrink-0">{t.settings.lastName}</span>
          <input
            id="profile-last-name-input"
            name="lastName"
            type="text"
            required
            value={last}
            onChange={(e) => setLast(e.target.value)}
            placeholder={t.settings.lastName}
            className={inputClass}
          />
        </label>
        <input type="hidden" name="email" value={email} />
      </div>

      {(fieldError || state?.error) && (
        <p id="profile-error-banner" role="alert" className="px-4 text-[13px] font-semibold text-[#C62F21]">
          {lang === 'uz' ? fieldError || state?.error : t.common.cannotSave}
        </p>
      )}
      {state?.success && !dirty && (
        <p id="profile-success-banner" role="status" className="px-4 text-[13px] font-semibold text-[#2E7D32] inline-flex items-center gap-1">
          <Check className="h-3.5 w-3.5" /> {t.common.saved}
        </p>
      )}

      {dirty && (
        <button
          id="profile-save-button"
          type="submit"
          disabled={isPending}
          className="min-h-[48px] rounded-2xl bg-[#163300] text-[#9FE870] text-[16px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isPending ? t.common.saving : t.common.save}
        </button>
      )}
    </form>
  );
}
