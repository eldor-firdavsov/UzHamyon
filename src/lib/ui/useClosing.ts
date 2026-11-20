'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Exit animation length; keep in sync with the uz-*-out keyframes in prototype.css. */
export const CLOSE_MS = 220;

/**
 * Lets a sheet play its exit animation before it unmounts.
 * `close()` marks it closing (style with [data-closing="true"]) and calls `onClose` after CLOSE_MS.
 * With reduced motion the close is immediate.
 */
export function useClosing(onClose: () => void): { closing: boolean; close: () => void } {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  }, [onClose]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const close = useCallback(() => {
    if (timer.current) return;
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    if (reduce) {
      latest.current();
      return;
    }
    setClosing(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setClosing(false);
      latest.current();
    }, CLOSE_MS);
  }, []);

  return { closing, close };
}
