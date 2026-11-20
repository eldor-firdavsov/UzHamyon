/** Telegram haptics when inside the Mini App, a short vibration elsewhere; never throws. */
type HapticKind = 'light' | 'medium' | 'success' | 'warning';

interface TelegramHaptics {
  impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
}

export function haptic(kind: HapticKind = 'light'): void {
  if (typeof window === 'undefined') return;
  try {
    const hf = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: TelegramHaptics } } })
      .Telegram?.WebApp?.HapticFeedback;
    if (hf) {
      if (kind === 'success' || kind === 'warning') hf.notificationOccurred?.(kind);
      else hf.impactOccurred?.(kind);
      return;
    }
    if ('vibrate' in navigator) navigator.vibrate(kind === 'success' ? [8, 40, 8] : 6);
  } catch {
    // Haptics are a nicety; ignore unsupported environments.
  }
}
