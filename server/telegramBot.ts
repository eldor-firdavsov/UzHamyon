/**
 * Local long-polling runner (development only).
 * Env vars come from `npm run telegram:bot`, which passes --env-file=.env.local (#49).
 * Note: Telegram refuses getUpdates while a webhook is set for the same bot token.
 */
import { runTelegramPolling } from '../src/lib/telegram/bot.ts';

const controller = new AbortController();

process.on('SIGINT', () => {
  console.log('\nStopping Telegram bot...');
  controller.abort();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nStopping Telegram bot...');
  controller.abort();
  process.exit(0);
});

runTelegramPolling(controller.signal).catch((err) => {
  console.error('Fatal error in Telegram bot poller:', err);
  process.exit(1);
});
