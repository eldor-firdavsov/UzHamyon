import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram/bot';

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    if (update && update.update_id) {
      await handleTelegramUpdate(update);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Error in /api/telegram/webhook:', err);
    // Always return 200 to Telegram so it doesn't endlessly retry failed updates
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    bot: '@uz_hamyonbot',
    service: 'UzHamyon Telegram Webhook',
  });
}
