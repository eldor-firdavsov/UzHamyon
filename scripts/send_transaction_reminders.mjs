#!/usr/bin/env node

/**
 * UzHamyon — Telegram Transaction Reminder Broadcaster & Menu Button Setup
 *
 * Usage:
 *   node --dns-result-order=ipv4first --env-file=.env.local scripts/send_transaction_reminders.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const miniappUrl = process.env.TELEGRAM_MINIAPP_URL || 'https://uzhamyon.vercel.app/';

if (!supabaseUrl || !serviceKey || !botToken) {
  console.error('❌ Xato: Muhit o‘zgaruvchilari (SUPABASE_URL, SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN) to‘liq emas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function callTelegram(method, payload = {}) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function main() {
  console.log('🚀 UzHamyon: Telegram Menu Button sozlash va Eslatma yuborish boshlandi...\n');

  // 1. Setup Chat Menu Button globally
  console.log('📱 1. Chatning chap tarafidagi Mini App menyu tugmasi («UzHamyon») o‘rnatilmoqda...');
  try {
    const menuRes = await callTelegram('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: 'UzHamyon',
        web_app: { url: miniappUrl },
      },
    });
    if (menuRes.ok) {
      console.log('   ✅ Chat Menu Button (chap tarafdagi Mini App tugmasi) barcha foydalanuvchilar uchun muvaffaqiyatli o‘rnatildi!\n');
    } else {
      console.warn('   ⚠️ Menu button o‘rnatishda javob:', menuRes);
    }
  } catch (err) {
    console.error('   ❌ Menu button o‘rnatishda xatolik:', err.message);
  }

  // 2. Query registered Telegram users from Supabase profiles
  console.log('👥 2. Bazadan Telegram foydalanuvchilari yuklanmoqda...');
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, first_name, email, onboarding_data');

  if (error || !profiles) {
    console.error('❌ Foydalanuvchilarni olishda xatolik:', error);
    process.exit(1);
  }

  const userMap = new Map();
  for (const p of profiles) {
    let tgId = null;
    if (p.email?.startsWith('tg_') && p.email?.includes('@telegram.uzhamyon.uz')) {
      const raw = p.email.replace('tg_', '').replace('@telegram.uzhamyon.uz', '');
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) tgId = parsed;
    }
    const obData = p.onboarding_data;
    if (!tgId && obData?.telegram_id) {
      const parsed = parseInt(String(obData.telegram_id), 10);
      if (!isNaN(parsed) && parsed > 0) tgId = parsed;
    }

    if (tgId && !userMap.has(tgId)) {
      const rawName = p.first_name?.trim();
      const firstName = rawName && rawName !== 'Foydalanuvchi' ? rawName : 'aziz foydalanuvchi';
      userMap.set(tgId, {
        userId: p.id,
        telegramId: tgId,
        firstName,
        username: typeof obData?.telegram_username === 'string' ? obData.telegram_username : null,
      });
    }
  }

  const users = Array.from(userMap.values());
  console.log(`   Topilgan jami unikal Telegram foydalanuvchilari soni: ${users.length} ta.\n`);

  if (users.length === 0) {
    console.log('⚠️ Hech qanday Telegram foydalanuvchisi topilmadi.');
    return;
  }

  // 3. Broadcast reminder to each user
  console.log('✉️ 3. Har bir foydalanuvchiga eslatma xabarlari yuborilmoqda:');
  let sentCount = 0;
  let blockedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const userLabel = user.username ? `@${user.username}` : user.firstName;

    // Also set specific chat menu button for this chat
    await callTelegram('setChatMenuButton', {
      chat_id: user.telegramId,
      menu_button: {
        type: 'web_app',
        text: 'UzHamyon',
        web_app: { url: miniappUrl },
      },
    }).catch(() => {});

    const reminderText = `Assalomu alaykum, <b>${user.firstName}</b>! 👋\n\nBugungi daromad va xarajatlaringizni UzHamyon'ga kiritishni unutmadingizmi? ✍️\n\nMoliyaviy nazorat va jamg‘arma maqsadlariga erishishning eng muhim qoidasi — har kungi xarajatlarni o‘z vaqtida qayd etib borishdir.\n\n<b>Siz uchun 2 ta juda oson yo‘l bor:</b>\n1️⃣ <b>Quyidagi tugma orqali</b> UzHamyon ilovasini ochib kiritish;\n2️⃣ <b>Shu yerning o‘ziga xabar yozish</b> (UzHamyon AI darhol tushunadi):\n   • <i>«Tushlikka 45 000 so‘m ishlatdim»</i>\n   • <i>«Bozorlik 200 000 so‘m»</i>\n   • <i>«Taksiga 18 000 so‘m»</i>\n   • <i>«Oylik maoshim 5 000 000 so‘m tushdi»</i>\n\nIlovani ochish uchun pastdagi tugmani bosing yoki chatning pastki chap burchagidagi <b>«UzHamyon»</b> menyu tugmasidan foydalaning! 👇`;

    try {
      const sendRes = await callTelegram('sendMessage', {
        chat_id: user.telegramId,
        text: reminderText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚀 UzHamyon'ni ochish",
                web_app: { url: miniappUrl },
              },
            ],
          ],
        },
      });

      if (sendRes.ok) {
        sentCount++;
        console.log(`   [${i + 1}/${users.length}] ✅ Yuborildi: ${userLabel} (ID: ${user.telegramId})`);
      } else {
        const desc = sendRes.description || 'Xato';
        if (/blocked|deactivated|not found/i.test(desc)) {
          blockedCount++;
          console.log(`   [${i + 1}/${users.length}] 🛑 Botni bloklagan: ${userLabel} (ID: ${user.telegramId})`);
        } else {
          failedCount++;
          console.log(`   [${i + 1}/${users.length}] ❌ Xatolik: ${userLabel} (ID: ${user.telegramId}) - ${desc}`);
        }
      }
    } catch (sendErr) {
      failedCount++;
      console.log(`   [${i + 1}/${users.length}] ❌ Tarmoq xatoligi: ${userLabel} (ID: ${user.telegramId}) - ${sendErr.message}`);
    }

    // Rate-limit pause (80ms)
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log('\n📊 Xulosa:');
  console.log(`   • Jami foydalanuvchilar: ${users.length}`);
  console.log(`   • Muvaffaqiyatli yuborildi: ${sentCount}`);
  console.log(`   • Bloklagan / nofaol: ${blockedCount}`);
  console.log(`   • Boshqa xatoliklar: ${failedCount}`);
  console.log('\n🏁 Yakunlandi!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

