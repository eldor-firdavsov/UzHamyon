'use client';

import React, { useEffect } from 'react';
import { Flame } from 'lucide-react';
import { haptic } from '@/lib/ui/haptics';
import { useClosing } from '@/lib/ui/useClosing';
import { useI18n } from '@/lib/i18n/client';

const KEY_PREFIX = 'uzh_nudge_';

/** True when the nudge was not shown yet today on this device. */
export function shouldShowNudgeToday(today: string): boolean {
  try {
    return window.localStorage.getItem(KEY_PREFIX + today) !== '1';
  } catch {
    return false; // storage blocked: never nag on every open
  }
}

export function markNudgeShown(today: string): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + today, '1');
    // Keep storage tidy: drop older nudge keys.
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + today) window.localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

interface DailyNudgeProps {
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * Dims the screen and points at the + button: "Bugungi xarajatni qo‘shamizmi?".
 * The + button itself is highlighted by MobileNavBar (highlightAdd) and stays above the dim.
 */
export default function DailyNudge({ onAccept, onDismiss }: DailyNudgeProps) {
  const { t } = useI18n();
  const { closing, close } = useClosing(onDismiss);
  useEffect(() => {
    haptic('medium');
  }, []);

  return (
    <>
      <div className="uz-nudge-backdrop" data-closing={closing} onClick={close} aria-hidden="true" />
      <button type="button" className="uz-nudge-bubble" data-closing={closing} onClick={onAccept}>
        <Flame size={22} color="#FFB020" fill="#FFB020" style={{ flex: '0 0 22px' }} aria-hidden="true" />
        <span>{t.streak.nudge}</span>
      </button>
    </>
  );
}
