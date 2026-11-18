import { NextRequest, NextResponse } from 'next/server';
import {
  getRegisteredTelegramUsers,
  broadcastDailyTransactionReminders,
  runDailyGoalDeadlineNotices,
} from '@/lib/telegram/reminders';
import { isCronAuthorized as isCronHeaderAuthorized } from '@/lib/telegram/requestAuth';

/** Every request needs `Authorization: Bearer $CRON_SECRET` (see requestAuth.ts). */
function isCronAuthorized(req: NextRequest): boolean {
  return isCronHeaderAuthorized(req.headers.get('authorization'));
}

async function runBroadcast(logLabel: string) {
  try {
    // Small and bounded, so it runs before the (longer) reminder broadcast.
    const goalDeadlines = await runDailyGoalDeadlineNotices();
    const result = await broadcastDailyTransactionReminders();
    return NextResponse.json({
      ok: true,
      service: 'UzHamyon Daily 20:00 Transaction Reminder',
      timezone: 'Asia/Tashkent (UTC+5)',
      triggered_at: new Date().toISOString(),
      message: `${result.sent} ta foydalanuvchiga soat 20:00 eslatma xabari yuborildi`,
      result: { total: result.total, sent: result.sent, blocked: result.blocked, failed: result.failed },
      goal_deadline_notices: goalDeadlines,
    });
  } catch (err) {
    console.error(`[Reminders] ${logLabel} execution error:`, err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const shouldExecute = url.searchParams.get('trigger') === 'true' || req.headers.has('x-vercel-cron');

  if (shouldExecute) {
    return runBroadcast('GET');
  }

  // Authenticated status view: counts only, never personal data.
  try {
    const recipients = await getRegisteredTelegramUsers();
    return NextResponse.json({
      ok: true,
      service: 'UzHamyon Daily 20:00 Reminder Schedule',
      schedule: {
        time_tashkent: '20:00 (Asia/Tashkent, UTC+5)',
        cron_utc: '0 15 * * *',
      },
      registered_recipients_count: recipients.length,
    });
  } catch (err) {
    console.error('[Reminders] Status view error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return runBroadcast('POST');
}
