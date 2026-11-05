import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram/bot';
import {
  claimWebhookUpdate,
  completeWebhookUpdate,
  failWebhookUpdate,
} from '@/lib/telegram/webhookIdempotency';

export async function POST(req: NextRequest) {
  // Optional Telegram webhook secret validation
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secretToken) {
    const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (headerSecret !== secretToken) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const update = await req.json();
    if (update && typeof update.update_id === 'number') {
      const updateId: number = update.update_id;
      const chatId = typeof update.message?.chat?.id === 'number' ? update.message.chat.id : undefined;
      const userId = typeof update.message?.from?.id === 'number' ? update.message.from.id : undefined;

      const claim = await claimWebhookUpdate(updateId, chatId, userId);
      if (!claim.canProcess) {
        // Duplicate or concurrent request: respond 200 immediately to acknowledge Telegram
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: claim.reason,
        });
      }

      try {
        await handleTelegramUpdate(update);
        await completeWebhookUpdate(updateId);
      } catch (procErr: unknown) {
        const errorMsg = procErr instanceof Error ? procErr.message : String(procErr);
        await failWebhookUpdate(updateId, errorMsg);
        throw procErr;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Error in /api/telegram/webhook:', err);
    // Always return 200 to Telegram so it doesn't endlessly retry unrecoverable payload errors
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
