'use client';

import { useEffect } from 'react';

// Global ref counter to safely handle nested or sequential modals
let lockCount = 0;
let savedScrollY = 0;
let originalPosition = '';
let originalTop = '';
let originalWidth = '';
let originalOverflow = '';
let originalTouchAction = '';

/**
 * Locks background body scrolling when a modal or bottom sheet is open.
 * Restores the exact scroll position upon closing without jump or page shift.
 * Compatible with iOS WKWebView (Telegram), Android Chrome, and Safari.
 */
export function useModalScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      originalPosition = document.body.style.position;
      originalTop = document.body.style.top;
      originalWidth = document.body.style.width;
      originalOverflow = document.body.style.overflow;
      originalTouchAction = document.body.style.touchAction;

      // Lock body at exact scroll position to prevent iOS and Android background rubber-banding
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;

        window.scrollTo({
          top: savedScrollY,
          left: 0,
          behavior: 'instant' as ScrollBehavior,
        });
      }
    };
  }, [isOpen]);
}
