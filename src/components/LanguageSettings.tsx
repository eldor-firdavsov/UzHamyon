'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { LANG_OPTIONS, type Lang } from '@/lib/i18n/config';

/** Settings → Language: the whole Mini App and the bot switch to the picked language. */
export default function LanguageSettings() {
  const { t, lang, setLang } = useI18n();
  const [saving, setSaving] = useState<Lang | null>(null);

  const pick = async (next: Lang) => {
    if (next === lang || saving) return;
    setSaving(next);
    try {
      await setLang(next);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-labelledby="language-settings-title">
      <h2 id="language-settings-title" className="px-4 text-[13px] font-semibold uppercase tracking-wide text-[#6B7068]">
        {t.language.title}
      </h2>
      <div className="uz-m-list" role="radiogroup" aria-labelledby="language-settings-title">
        {LANG_OPTIONS.map((o) => {
          const selected = lang === o.id;
          return (
            <button
              key={o.id}
              id={`language-option-${o.id}`}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={o.id}
              className="uz-lang-row"
              disabled={Boolean(saving)}
              onClick={() => void pick(o.id)}
            >
              <span className="uz-lang-row-flag" aria-hidden="true">{o.flag}</span>
              <span>{o.native}</span>
              <span className="uz-lang-row-ck" aria-hidden="true">
                {saving === o.id ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  selected && <Check size={20} strokeWidth={2.8} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
