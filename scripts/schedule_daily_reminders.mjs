#!/usr/bin/env node

/**
 * UzHamyon — Standalone Background Scheduler for Daily 20:00 (Asia/Tashkent) Reminders
 *
 * Runs continuously and automatically triggers broadcastDailyTransactionReminders()
 * every day at 20:00 Tashkent time (UTC+5).
 *
 * Usage:
 *   node --dns-result-order=ipv4first --env-file=.env.local scripts/schedule_daily_reminders.mjs
 */

import { broadcastDailyTransactionReminders } from '../src/lib/telegram/reminders.ts';

function getNext20TashkentDate() {
  const now = new Date();
  const tashkentTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' });
  const tashkentDate = new Date(tashkentTimeStr);

  const target = new Date(tashkentDate);
  target.setHours(20, 0, 0, 0);

  // If 20:00 already passed today in Tashkent, schedule for tomorrow 20:00
  if (target.getTime() <= tashkentDate.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const msUntilTarget = target.getTime() - tashkentDate.getTime();
  return { targetTashkent: target, msUntilTarget };
}

function scheduleNext() {
  const { targetTashkent, msUntilTarget } = getNext20TashkentDate();
  const hoursUntil = (msUntilTarget / (1000 * 60 * 60)).toFixed(2);

  console.log(`\n⏰ [UzHamyon Scheduler] Keyingi eslatma vaqti: ${targetTashkent.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })} (Toshkent vaqti bilan)`);
  console.log(`⏳ Kutilmoqda: ${hoursUntil} soat (${msUntilTarget} ms)...\n`);

  setTimeout(async () => {
    console.log(`\n🔔 [${new Date().toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent' })}] Soat 20:00 bo‘ldi! Barcha foydalanuvchilarga eslatma yuborilmoqda...`);
    try {
      const res = await broadcastDailyTransactionReminders();
      console.log(`✅ Eslatmalar yuborildi: Jami: ${res.total}, Yuborildi: ${res.sent}, Bloklagan: ${res.blocked}, Xato: ${res.failed}`);
    } catch (err) {
      console.error('❌ Eslatma yuborishda xatolik:', err);
    }

    // Schedule for the next day
    scheduleNext();
  }, msUntilTarget);
}

console.log('🚀 UzHamyon Daily 20:00 Reminder Scheduler ishga tushdi.');
console.log('Vaqt mintaqasi: Asia/Tashkent (UTC+5). Har kuni soat 20:00 da avtomatik ishlaydi.');

scheduleNext();

