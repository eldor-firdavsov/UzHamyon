import { NextRequest, NextResponse, after } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegram/bot';
import {
  claimWebhookUpdate,
  completeWebhookUpdate,
  failWebhookUpdate,
} from '@/lib/telegram/webhookIdempotency';

export const maxDuration = 30;

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

    // Respond to Telegram immediately with 200 OK while processing update in background via Next.js after().
    // This completely prevents 504 Gateway Timeouts from Vercel function limits and stops Telegram duplicate delivery loops.
    after(async () => {
      try {
        await handleTelegramUpdate(update);
        await completeWebhookUpdate(validUpdateId);
      } catch (procErr: unknown) {
        const errorMsg = procErr instanceof Error ? procErr.message : String(procErr);
        await failWebhookUpdate(validUpdateId, errorMsg);
        console.error(`[Webhook background] Error processing update ${validUpdateId}:`, errorMsg);
      }
    });

    return NextResponse.json({ ok: true });
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
