import { NextRequest, NextResponse } from 'next/server';
import {
  getRegisteredTelegramUsers,
  broadcastDailyTransactionReminders,
} from '@/lib/telegram/reminders';

function isCronAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  const authHeader = req.headers.get('authorization');
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  const isVercelCron = req.headers.has('x-vercel-cron');

  // If Vercel CRON_SECRET is configured, check bearer match
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // If TELEGRAM_WEBHOOK_SECRET is configured, check secret match
  if (webhookSecret && secretHeader === webhookSecret) return true;

  // Vercel Cron native invocation without CRON_SECRET configured
  if (isVercelCron && !cronSecret) return true;

  // Development/testing fallback when no secrets configured
  if (!cronSecret && !webhookSecret) return true;

  return false;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const triggerParam = url.searchParams.get('trigger');
  const isVercelCron = req.headers.has('x-vercel-cron');
  const shouldExecute = triggerParam === 'true' || isVercelCron;

  // 1. Cron / Automated trigger execution
  if (shouldExecute) {
    if (!isCronAuthorized(req)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized cron request' }, { status: 401 });
    }

    try {
      const result = await broadcastDailyTransactionReminders();
      return NextResponse.json({
        ok: true,
        service: 'UzHamyon Daily 20:00 Transaction Reminder',
        timezone: 'Asia/Tashkent (UTC+5)',
        triggered_at: new Date().toISOString(),
        message: `${result.sent} ta foydalanuvchiga soat 20:00 eslatma xabari muvaffaqiyatli yuborildi`,
        result,
      });
    } catch (err) {
      console.error('[Reminders] Execution error:', err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // 2. Read-only status & diagnostic view
  try {
    const recipients = await getRegisteredTelegramUsers();
    return NextResponse.json({
      ok: true,
      service: 'UzHamyon Daily 20:00 Reminder Schedule',
      schedule: {
        time_tashkent: '20:00 (Asia/Tashkent, UTC+5)',
        cron_utc: '0 15 * * *',
        next_run_description: 'Har kuni O‘zbekiston vaqti bilan soat 20:00 da (UTC 15:00)',
      },
      registered_recipients_count: recipients.length,
      recipients: recipients.map((r) => ({
        telegramId: r.telegramId,
        firstName: r.firstName,
        username: r.username,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized request' }, { status: 401 });
  }

  try {
    const result = await broadcastDailyTransactionReminders();
    return NextResponse.json({
      ok: true,
      service: 'UzHamyon Daily 20:00 Transaction Reminder',
      timezone: 'Asia/Tashkent (UTC+5)',
      triggered_at: new Date().toISOString(),
      message: `${result.sent} ta foydalanuvchiga soat 20:00 eslatma xabari muvaffaqiyatli yuborildi`,
      result,
    });
  } catch (err) {
    console.error('[Reminders] POST execution error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
