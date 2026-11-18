import { isProduction, safeEqual } from '../env.ts';

/**
 * Webhook: Telegram sends `x-telegram-bot-api-secret-token` with the secret registered via setWebhook.
 * Production: the secret MUST be configured and match. Development: optional.
 */
export function isTelegramWebhookAuthorized(headerSecret: string | null | undefined): boolean {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secretToken) {
    if (isProduction()) {
      console.error('[Webhook] TELEGRAM_WEBHOOK_SECRET is not configured; rejecting update.');
      return false;
    }
    return true;
  }
  return safeEqual(headerSecret, secretToken);
}

/**
 * Cron / reminder routes: require `Authorization: Bearer $CRON_SECRET`.
 * Vercel Cron sends this header automatically when CRON_SECRET is set.
 * Only outside production, with no CRON_SECRET configured, requests are allowed.
 */
export function isCronAuthorized(authorizationHeader: string | null | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    if (isProduction()) {
      console.error('[Cron] CRON_SECRET is not configured; rejecting request.');
      return false;
    }
    return true;
  }
  return safeEqual(authorizationHeader, `Bearer ${cronSecret}`);
}
