#!/usr/bin/env node
/**
 * Registers the Telegram webhook with a secret token and an explicit allowed_updates list.
 *
 * Usage (reads env vars, never prints secret values):
 *   npm run telegram:set-webhook
 *   # or with a production env file:
 *   node --env-file=.env.production.local scripts/set_webhook.mjs
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN       (required)
 *   TELEGRAM_WEBHOOK_SECRET  (required) 1-256 chars, only A-Z a-z 0-9 _ -
 *   WEBHOOK_URL              (optional) default https://uzhamyon.vercel.app/api/telegram/webhook
 *   TELEGRAM_MINIAPP_URL     (optional) default https://uzhamyon.vercel.app/ — also sets the
 *                            default "UzHamyon" menu button for ALL chats (so the bot no longer
 *                            calls setChatMenuButton on every message).
 */

const DEFAULT_WEBHOOK_URL = 'https://uzhamyon.vercel.app/api/telegram/webhook';
const ALLOWED_UPDATES = ['message', 'callback_query'];

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const webhookUrl = process.env.WEBHOOK_URL?.trim() || DEFAULT_WEBHOOK_URL;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!token) fail('TELEGRAM_BOT_TOKEN is not set.');
if (!secret) fail('TELEGRAM_WEBHOOK_SECRET is not set.');
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  fail('TELEGRAM_WEBHOOK_SECRET must be 1-256 characters of A-Z, a-z, 0-9, "_" or "-".');
}
if (!/^https:\/\//.test(webhookUrl)) fail('WEBHOOK_URL must start with https://');

async function callBotApi(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) {
    fail(`${method} failed: ${data?.description || `HTTP ${res.status}`}`);
  }
  return data.result;
}

console.log(`Setting webhook → ${webhookUrl}`);
console.log(`allowed_updates: ${JSON.stringify(ALLOWED_UPDATES)}`);

await callBotApi('setWebhook', {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ALLOWED_UPDATES,
  drop_pending_updates: false,
});

const miniAppUrl = process.env.TELEGRAM_MINIAPP_URL?.trim() || 'https://uzhamyon.vercel.app/';
await callBotApi('setChatMenuButton', {
  menu_button: { type: 'web_app', text: 'UzHamyon', web_app: { url: miniAppUrl } },
});
console.log(`✅ Default menu button set → ${miniAppUrl}`);

const info = await callBotApi('getWebhookInfo');
console.log('✅ Webhook set. Current info (no secrets):');
console.log(
  JSON.stringify(
    {
      url: info.url,
      allowed_updates: info.allowed_updates,
      pending_update_count: info.pending_update_count,
      last_error_date: info.last_error_date,
      last_error_message: info.last_error_message,
      max_connections: info.max_connections,
    },
    null,
    2
  )
);
