import { NextRequest, NextResponse } from 'next/server';
import {
  getRegisteredTelegramUsers,
  broadcastDailyTransactionReminders,
} from '@/lib/telegram/reminders';

export async function GET() {
  try {
    const recipients = await getRegisteredTelegramUsers();
    return NextResponse.json({
      ok: true,
      count: recipients.length,
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
  // Validate authorization via secret header or cron secret
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();

  const authHeader = req.headers.get('authorization');
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');

  const isAuthorized =
    (!webhookSecret && !cronSecret) ||
    (secretHeader && secretHeader === webhookSecret) ||
    (authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!isAuthorized) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await broadcastDailyTransactionReminders();
    return NextResponse.json({
      ok: true,
      message: `${result.sent} ta foydalanuvchiga eslatma xabari muvaffaqiyatli yuborildi`,
      result,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
