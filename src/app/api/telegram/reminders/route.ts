import { NextRequest, NextResponse, after } from 'next/server';
import {
  getRegisteredTelegramUsers,
  broadcastDailyTransactionReminders,
  runDailyGoalDeadlineNotices,
  REMINDER_TIME_BUDGET_MS,
} from '@/lib/telegram/reminders';
import { isCronAuthorized as isCronHeaderAuthorized } from '@/lib/telegram/requestAuth';

// Safe on the Vercel Hobby plan. The broadcast stops after REMINDER_TIME_BUDGET_MS (45 s)
// and, if users are left, continues in a fresh invocation (see below).
export const maxDuration = 60;

/** Max number of chained continuations for one daily run (≈ 20 × 45 s × 25 msg/s). */
const MAX_CONTINUATIONS = 20;

/** Every request needs `Authorization: Bearer $CRON_SECRET` (see requestAuth.ts). */
function isCronAuthorized(req: NextRequest): boolean {
  return isCronHeaderAuthorized(req.headers.get('authorization'));
}

/**
 * Answers immediately and runs the work in after(), within this invocation's maxDuration.
 * If the time budget runs out, the next invocation is triggered the same way, so no request
 * ever waits on a long broadcast.
 */
function runBroadcast(req: NextRequest, logLabel: string) {
  const url = new URL(req.url);
  const continuation = Math.max(0, Math.min(MAX_CONTINUATIONS, Number(url.searchParams.get('continuation')) || 0));
  const authorization = req.headers.get('authorization') || '';

  after(async () => {
    try {
      // Goal deadline notices only once per day, in the first invocation (bounded).
      const goalDeadlines = continuation === 0 ? await runDailyGoalDeadlineNotices() : null;
      const result = await broadcastDailyTransactionReminders(undefined, { timeBudgetMs: REMINDER_TIME_BUDGET_MS });
      console.log(
        `[Reminders] run ${continuation}: total=${result.total} sent=${result.sent} blocked=${result.blocked} skipped=${result.skipped} ` +
          `failed=${result.failed} remaining=${result.remaining} tracking=${result.trackingAvailable}` +
          (goalDeadlines ? ` goalDeadlines=${goalDeadlines.sent}/${goalDeadlines.claimed}` : '')
      );

      // Continue only with tracking (migration 014), which skips users already reminded today.
      if (result.remaining && result.trackingAvailable && continuation < MAX_CONTINUATIONS) {
        const next = new URL(url.toString());
        next.searchParams.set('trigger', 'true');
        next.searchParams.set('continuation', String(continuation + 1));
        const res = await fetch(next.toString(), {
          method: 'GET',
          headers: { authorization },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) console.error(`[Reminders] continuation ${continuation + 1} failed: HTTP ${res.status}`);
      } else if (result.remaining) {
        console.warn('[Reminders] Time budget reached; not continuing (no tracking or max continuations).');
      }
    } catch (err) {
      console.error(`[Reminders] ${logLabel} execution error:`, err instanceof Error ? err.message : err);
    }
  });

  return NextResponse.json({
    ok: true,
    accepted: true,
    service: 'UzHamyon Daily 20:00 Transaction Reminder',
    timezone: 'Asia/Tashkent (UTC+5)',
    triggered_at: new Date().toISOString(),
    continuation,
  });
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const shouldExecute = url.searchParams.get('trigger') === 'true' || req.headers.has('x-vercel-cron');

  if (shouldExecute) {
    return runBroadcast(req, 'GET');
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
  return runBroadcast(req, 'POST');
}
