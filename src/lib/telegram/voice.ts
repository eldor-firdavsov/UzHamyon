/**
 * Voice / audio messages (Phase 2): validation and in-memory download.
 *
 * Nothing is written to disk or the database: the file is downloaded into memory,
 * base64-encoded for Gemini's inlineData part and dropped after the request.
 */

import { callBotApi, getBotToken } from './botApi.ts';
import { botTexts } from '../i18n/bot.ts';
import type { Lang } from '../i18n/config.ts';

/** Longest voice message we analyse (seconds). */
export const VOICE_MAX_SECONDS = 60;
/** Telegram Bot API getFile download limit. */
export const TELEGRAM_DOWNLOAD_MAX_BYTES = 20 * 1024 * 1024;
/** Our own cap for inline audio (Gemini allows 20 MB per request incl. prompt). 60 s OGG/Opus ≈ 0.1–0.5 MB. */
export const VOICE_MAX_BYTES = 10 * 1024 * 1024;

/** Audio MIME types Gemini lists as supported (docs, checked 2026-11-18). */
export const GEMINI_AUDIO_MIME_TYPES = new Set([
  'audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac',
  'audio/mpeg', 'audio/m4a', 'audio/l16', 'audio/opus', 'audio/alaw', 'audio/mulaw', 'audio/webm',
]);

export interface TelegramAudioLike {
  file_id: string;
  file_unique_id?: string;
  duration?: number;
  mime_type?: string;
  file_size?: number;
}

export type VoiceRejectReason = 'too_long' | 'too_large' | 'unsupported_type';

/** Voice replies in Uzbek (kept for existing callers); use voiceMessages(lang) for others. */
export const VOICE_MESSAGES = botTexts('uz').voice;

export function voiceMessages(lang: Lang = 'uz') {
  return botTexts(lang).voice;
}

/** Normalizes Telegram's mime_type to one Gemini lists; voice notes are OGG/Opus → audio/ogg. */
export function normalizeAudioMimeType(mime: string | undefined, isVoice: boolean): string | null {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  if (!m) return isVoice ? 'audio/ogg' : null;
  if (m === 'audio/x-wav' || m === 'audio/wave') return 'audio/wav';
  if (m === 'audio/x-m4a' || m === 'audio/mp4') return 'audio/m4a';
  if (m === 'audio/x-flac') return 'audio/flac';
  if (m === 'audio/x-aac') return 'audio/aac';
  return GEMINI_AUDIO_MIME_TYPES.has(m) ? m : null;
}

/** Checks Telegram's metadata BEFORE downloading anything. */
export function validateAudioMeta(
  media: TelegramAudioLike,
  isVoice: boolean
): { ok: true; mimeType: string } | { ok: false; reason: VoiceRejectReason } {
  if (typeof media.duration === 'number' && media.duration > VOICE_MAX_SECONDS) {
    return { ok: false, reason: 'too_long' };
  }
  if (typeof media.file_size === 'number' && media.file_size > Math.min(VOICE_MAX_BYTES, TELEGRAM_DOWNLOAD_MAX_BYTES)) {
    return { ok: false, reason: 'too_large' };
  }
  const mimeType = normalizeAudioMimeType(media.mime_type, isVoice);
  if (!mimeType) return { ok: false, reason: 'unsupported_type' };
  return { ok: true, mimeType };
}

export function rejectMessageFor(reason: VoiceRejectReason, lang: Lang = 'uz'): string {
  const m = voiceMessages(lang);
  if (reason === 'too_long') return m.tooLong;
  if (reason === 'too_large') return m.tooLarge;
  return m.unsupported;
}

/**
 * getFile → download into memory → base64. Returns null on any failure (logged without the token).
 */
export async function downloadTelegramFileBase64(
  fileId: string,
  options: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<{ base64: string; bytes: number } | null> {
  const maxBytes = options.maxBytes ?? VOICE_MAX_BYTES;
  const info = await callBotApi<{ file_path?: string; file_size?: number }>('getFile', { file_id: fileId });
  const filePath = info?.ok ? info.result?.file_path : undefined;
  if (!filePath) return null;
  if (typeof info?.result?.file_size === 'number' && info.result.file_size > maxBytes) return null;

  try {
    const res = await fetch(`https://api.telegram.org/file/bot${getBotToken()}/${filePath}`, {
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
    });
    if (!res.ok) {
      console.error(`[Voice] download failed: HTTP ${res.status}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > maxBytes) {
      console.warn(`[Voice] downloaded size ${buf.byteLength} B is outside the allowed range`);
      return null;
    }
    return { base64: buf.toString('base64'), bytes: buf.byteLength };
  } catch (err) {
    console.error('[Voice] download error:', err instanceof Error ? err.name : 'Error');
    return null;
  }
}
