import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram/bot';
import {
  claimWebhookUpdate,
  completeWebhookUpdate,
  failWebhookUpdate,
} from '@/lib/telegram/webhookIdempotency';

export const maxDuration = 30;

function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /timeout|network|econnrefused|fetch failed|503|502|429|socket|database connection|deadlock|temporarily/i.test(
      msg
    ) || (err instanceof Error && err.name === 'TimeoutError')
  );
}

export async function POST(req: NextRequest) {
  // Optional Telegram webhook secret validation
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secretToken) {
    const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (headerSecret !== secretToken) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  let updateId: number | undefined;

  try {
    const update = await req.json();
    if (!update || typeof update.update_id !== 'number') {
      return NextResponse.json({ ok: false, error: 'Invalid update payload' }, { status: 400 });
    }

    updateId = update.update_id;
    const validUpdateId = update.update_id;
    const chatId =
      typeof update.message?.chat?.id === 'number'
        ? update.message.chat.id
        : typeof update.callback_query?.message?.chat?.id === 'number'
        ? update.callback_query.message.chat.id
        : undefined;

    const userId =
      typeof update.message?.from?.id === 'number'
        ? update.message.from.id
        : typeof update.callback_query?.from?.id === 'number'
        ? update.callback_query.from.id
        : undefined;

    const claim = await claimWebhookUpdate(validUpdateId, chatId, userId);
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
      await completeWebhookUpdate(validUpdateId);
      return NextResponse.json({ ok: true });
    } catch (procErr: unknown) {
      const errorMsg = procErr instanceof Error ? procErr.message : String(procErr);
      await failWebhookUpdate(validUpdateId, errorMsg);

      // Distinguish transient vs permanent errors:
      // Transient errors return 500 so Telegram will retry the update.
      // Permanent errors return 200 so Telegram does not endlessly loop.
      if (isTransientError(procErr)) {
        console.warn(`[Webhook] Transient failure on update ${updateId}, returning 500 for retry:`, errorMsg);
        return NextResponse.json(
          { ok: false, error: errorMsg, retryable: true },
          { status: 500 }
        );
      }

      console.error(`[Webhook] Permanent failure on update ${updateId}:`, errorMsg);
      return NextResponse.json(
        { ok: false, error: errorMsg, retryable: false },
        { status: 200 }
      );
    }
  } catch (err: unknown) {
    console.error('Error in /api/telegram/webhook:', err);
    if (updateId) {
      await failWebhookUpdate(updateId, String(err)).catch(() => {});
    }
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
