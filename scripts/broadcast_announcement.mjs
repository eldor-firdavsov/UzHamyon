#!/usr/bin/env node
/**
 * One-off announcement to every Telegram user of the bot.
 *
 *   Dry run (default — counts recipients, prints the message, sends nothing):
 *     node --dns-result-order=ipv4first --env-file=.env.local scripts/broadcast_announcement.mjs
 *   Send for real:
 *     node --dns-result-order=ipv4first --env-file=.env.local scripts/broadcast_announcement.mjs --send
 *   Send only to one chat first (a test):
 *     ... scripts/broadcast_announcement.mjs --send --only=<telegram_id>
 *
 * Skips users who blocked the bot (telegram_blocked_at) and marks new blocks.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const miniappUrl = process.env.TELEGRAM_MINIAPP_URL || 'https://uzhamyon.vercel.app/';

const SEND = process.argv.includes('--send');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function message(firstName) {
  return [
    `🔥 <b>${esc(firstName)}, UzHamyon yangilandi!</b>`,
    '',
    '✨ Yangi, sodda dizayn',
    '⚡ Xarajat 2 soniyada — sevimlilaringiz bir bosishda',
    '🔥 Seriya: har kuni yozing, olovingiz o‘sib boradi',
    '🤖 AI qaytdi: «Pulim qayerga ketyapti?» deb so‘rang',
    '',
    'Bugundan seriyani boshlaymizmi? 👇',
  ].join('\n');
}
const BUTTON = '🔥 Seriyani boshlash';

if (!supabaseUrl || !serviceKey || !botToken) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or TELEGRAM_BOT_TOKEN.');
  process.exit(1);
}
const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toRecipient(p) {
  let tgId = null;
  const m = p.email?.match(/^tg_(\d+)@telegram\.uzhamyon\.uz$/);
  if (m) tgId = Number(m[1]);
  if (!tgId && p.onboarding_data?.telegram_id) {
    const n = parseInt(String(p.onboarding_data.telegram_id), 10);
    if (n > 0) tgId = n;
  }
  if (!tgId) return null;
  const name = p.first_name?.trim();
  return { userId: p.id, telegramId: tgId, firstName: name && name !== 'Foydalanuvchi' ? name : 'Salom' };
}

async function loadRecipients() {
  const filter = 'email.like.tg_%@telegram.uzhamyon.uz,onboarding_data->>telegram_id.not.is.null';
  const byTg = new Map();
  let afterId;
  let tracking = true;
  for (;;) {
    const build = (withTracking) => {
      let q = db.from('profiles').select('id, first_name, email, onboarding_data').or(filter).order('id').limit(500);
      if (afterId) q = q.gt('id', afterId);
      if (withTracking) q = q.is('telegram_blocked_at', null);
      return q;
    };
    let { data, error } = await build(tracking);
    if (error && tracking && /telegram_blocked_at/.test(error.message || '')) {
      tracking = false;
      ({ data, error } = await build(false));
    }
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const p of data) {
      const r = toRecipient(p);
      if (r && !byTg.has(r.telegramId)) byTg.set(r.telegramId, r);
    }
    afterId = data[data.length - 1].id;
    if (data.length < 500) break;
  }
  return { recipients: [...byTg.values()], tracking };
}

async function send(r) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: r.telegramId,
        text: message(r.firstName),
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: BUTTON, web_app: { url: miniappUrl } }]] },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.ok) return 'sent';
    if (res.status === 429) {
      await sleep(Math.min(Number(body.parameters?.retry_after) || 1, 30) * 1000);
      continue;
    }
    if (res.status === 403 || /blocked|deactivated|chat not found/i.test(body.description || '')) return 'blocked';
    return 'failed';
  }
  return 'failed';
}

const { recipients, tracking } = await loadRecipients();
const targets = ONLY ? recipients.filter((r) => String(r.telegramId) === ONLY) : recipients;
console.log(`Recipients: ${recipients.length}${ONLY ? ` (sending to ${targets.length} matching --only)` : ''}`);
console.log('--- message preview ---\n' + message('Aziz') + `\n[${BUTTON}] → ${miniappUrl}\n-----------------------`);

if (!SEND) {
  console.log('Dry run: nothing sent. Add --send to deliver.');
  process.exit(0);
}

const tally = { sent: 0, blocked: 0, failed: 0 };
const blockedIds = [];
for (const r of targets) {
  const out = await send(r);
  tally[out] += 1;
  if (out === 'blocked') blockedIds.push(r.userId);
  await sleep(45); // stays under Telegram's ~30 messages/second limit
}
if (tracking && blockedIds.length) {
  await db.from('profiles').update({ telegram_blocked_at: new Date().toISOString() }).in('id', blockedIds);
}
console.log(`Done: sent ${tally.sent}, blocked ${tally.blocked}, failed ${tally.failed}.`);
